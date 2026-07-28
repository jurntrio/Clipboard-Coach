create table if not exists public.club_registration_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  club_id uuid references public.clubs(id) on delete cascade not null,
  technical_role text not null check (technical_role in ('club_admin', 'club_admin_viewer', 'trainer')),
  function_role text not null,
  expected_name text,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (timezone('utc'::text, now()) + interval '14 days'),
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.club_registration_invites enable row level security;
create policy "Club admins read registration invites" on public.club_registration_invites for select
using (public.is_active_club_admin(club_id, auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  accepted_at_value timestamptz;
  player_invite public.player_invites;
  club_invite public.club_registration_invites;
  supplied_name text;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.standard_tags (coach_id, name, is_protected, start_offset_seconds, end_offset_seconds)
  values (new.id, 'Start', true, 0, 0), (new.id, 'Goal', true, -10, 3),
    (new.id, 'Kans', false, -10, 3), (new.id, 'Opbouw', false, -5, 10),
    (new.id, 'Positiespel', false, -10, 5), (new.id, 'Hoekschop', false, -3, 10),
    (new.id, 'Vrije trap', false, -3, 10);

  if coalesce(new.raw_user_meta_data->>'legal_accepted', 'false') = 'true'
    and new.raw_user_meta_data->>'terms_version' is not null
    and new.raw_user_meta_data->>'privacy_version' is not null
    and new.raw_user_meta_data->>'legal_statement_version' is not null then
    begin accepted_at_value := (new.raw_user_meta_data->>'legal_accepted_at')::timestamptz;
    exception when others then accepted_at_value := timezone('utc'::text, now()); end;
    insert into public.legal_acceptances(user_id, terms_version, privacy_version, statement_version, locale, accepted_at)
    values (new.id, new.raw_user_meta_data->>'terms_version', new.raw_user_meta_data->>'privacy_version',
      new.raw_user_meta_data->>'legal_statement_version',
      case when new.raw_user_meta_data->>'legal_locale' = 'en' then 'en' else 'nl' end, accepted_at_value);
  end if;

  if new.raw_user_meta_data ? 'club_invite_token' then
    select * into club_invite from public.club_registration_invites
    where token = nullif(new.raw_user_meta_data->>'club_invite_token', '')::uuid
      and used_at is null and expires_at > timezone('utc'::text, now())
    for update;
    if club_invite.id is null then raise exception 'CLUB_INVITE_INVALID'; end if;
    supplied_name := regexp_replace(lower(trim(coalesce(new.raw_user_meta_data->>'full_name', ''))), '\s+', ' ', 'g');
    if club_invite.expected_name is not null
      and supplied_name <> regexp_replace(lower(trim(club_invite.expected_name)), '\s+', ' ', 'g')
    then raise exception 'CLUB_INVITE_NAME_MISMATCH'; end if;

    insert into public.club_memberships(club_id, profile_id, role, status, function_role, team_scope)
    values (club_invite.club_id, new.id, club_invite.technical_role, 'active', club_invite.function_role,
      case when club_invite.technical_role in ('club_admin', 'club_admin_viewer') then 'all' else 'none' end);
    update public.profiles set account_role = case
      when club_invite.technical_role = 'club_admin' then 'club_admin'
      when club_invite.technical_role = 'club_admin_viewer' then 'club_admin_viewer'
      else 'coach' end where id = new.id;
    insert into public.club_trainers(club_id, profile_id, display_name, invitation_status)
    values (club_invite.club_id, new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email), 'linked')
    on conflict (club_id, profile_id) where profile_id is not null do update
      set display_name = excluded.display_name, invitation_status = 'linked';
    update public.club_registration_invites set used_at = timezone('utc'::text, now()), used_by = new.id
    where id = club_invite.id and used_at is null;
  elsif new.raw_user_meta_data ? 'club_onboarding' then
    perform public.complete_club_team_onboarding(new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->'club_onboarding');
  end if;

  if new.raw_user_meta_data ? 'player_invite_token' then
    select * into player_invite from public.player_invites
    where token = nullif(new.raw_user_meta_data->>'player_invite_token', '')::uuid
      and used_at is null and expires_at > timezone('utc'::text, now());
    if player_invite.id is null then raise exception 'PLAYER_INVITE_INVALID'; end if;
    update public.profiles set account_role = 'player_parent' where id = new.id;
    insert into public.player_guardians(club_player_id, player_id, profile_id, access_scope, valid_from)
    values (player_invite.club_player_id, player_invite.player_id, new.id, 'from_acceptance', timezone('utc'::text, now()));
    update public.player_invites set used_at = timezone('utc'::text, now()), used_by = new.id where id = player_invite.id;
    if player_invite.club_player_id is not null then
      update public.club_players set
        address = coalesce(nullif(address, ''), new.raw_user_meta_data->>'child_address'),
        postal_code = coalesce(nullif(postal_code, ''), new.raw_user_meta_data->>'child_postal_code'),
        city = coalesce(nullif(city, ''), new.raw_user_meta_data->>'child_city'),
        email = coalesce(nullif(email, ''), new.raw_user_meta_data->>'child_email'),
        phone = coalesce(nullif(phone, ''), new.raw_user_meta_data->>'child_phone')
      where id = player_invite.club_player_id;
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
