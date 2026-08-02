-- Invalidate legacy plaintext invitations and store only SHA-256 token digests going forward.

delete from public.club_registration_invites;
delete from public.player_invites;

alter table public.club_registration_invites add column token_hash bytea;
alter table public.player_invites add column token_hash bytea;

alter table public.club_registration_invites drop column token;
alter table public.player_invites drop column token;

alter table public.club_registration_invites alter column token_hash set not null;
alter table public.player_invites alter column token_hash set not null;

create unique index club_registration_invites_token_hash_key
  on public.club_registration_invites(token_hash);
create unique index player_invites_token_hash_key
  on public.player_invites(token_hash);

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
    where token_hash = extensions.digest(nullif(new.raw_user_meta_data->>'club_invite_token', ''), 'sha256')
      and used_at is null and expires_at > timezone('utc'::text, now())
    for update;
    if club_invite.id is null then raise exception 'CLUB_INVITE_INVALID'; end if;
    supplied_name := regexp_replace(lower(trim(coalesce(new.raw_user_meta_data->>'full_name', ''))), '\s+', ' ', 'g');
    if club_invite.expected_name is not null
      and supplied_name <> regexp_replace(lower(trim(club_invite.expected_name)), '\s+', ' ', 'g')
    then raise exception 'CLUB_INVITE_NAME_MISMATCH'; end if;
    if club_invite.contact_email is not null
      and lower(trim(new.email)) <> lower(trim(club_invite.contact_email))
    then raise exception 'CLUB_INVITE_EMAIL_MISMATCH'; end if;

    if club_invite.target_account_role in ('platform_admin', 'admin_viewer') then
      update public.profiles set account_role = club_invite.target_account_role,
        phone_number = club_invite.contact_phone where id = new.id;
    else
      if club_invite.club_id is null then raise exception 'CLUB_INVITE_ASSIGNMENT_MISSING'; end if;
      if club_invite.club_team_id is not null and not exists (
        select 1 from public.club_teams where id = club_invite.club_team_id and club_id = club_invite.club_id
      ) then raise exception 'CLUB_INVITE_TEAM_INVALID'; end if;

      insert into public.club_memberships(club_id, profile_id, role, status, function_role, custom_role_name, team_scope)
      values (club_invite.club_id, new.id, club_invite.technical_role, 'active', club_invite.function_role,
        club_invite.custom_role_name, case
          when club_invite.technical_role in ('club_admin', 'club_admin_viewer', 'analyst') then 'all'
          when club_invite.club_team_id is not null then 'assigned' else 'none' end);
      update public.profiles set account_role = case
        when club_invite.technical_role = 'club_admin' then 'club_admin'
        when club_invite.technical_role = 'club_admin_viewer' then 'club_admin_viewer'
        when club_invite.technical_role = 'analyst' then 'analyst' else 'coach' end,
        phone_number = club_invite.contact_phone where id = new.id;
      insert into public.club_trainers(club_id, profile_id, display_name, phone_number, invitation_status)
      values (club_invite.club_id, new.id,
        coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), new.email),
        club_invite.contact_phone, 'linked')
      on conflict (club_id, profile_id) where profile_id is not null do update
        set display_name = excluded.display_name,
            phone_number = coalesce(excluded.phone_number, public.club_trainers.phone_number),
            invitation_status = 'linked';
      if club_invite.club_team_id is not null then
        insert into public.club_trainer_teams(trainer_id, club_team_id, role, status)
        select trainer.id, club_invite.club_team_id, 'coach', 'active'
        from public.club_trainers trainer
        where trainer.club_id = club_invite.club_id and trainer.profile_id = new.id
        on conflict (trainer_id, club_team_id) do update set status = 'active';
      end if;
    end if;
    update public.club_registration_invites
    set used_at = timezone('utc'::text, now()), used_by = new.id
    where id = club_invite.id and used_at is null;
  elsif new.raw_user_meta_data ? 'club_onboarding' then
    perform public.complete_club_team_onboarding(new.id, new.email,
      new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->'club_onboarding');
  end if;

  if new.raw_user_meta_data ? 'player_invite_token' then
    select * into player_invite from public.player_invites
    where token_hash = extensions.digest(nullif(new.raw_user_meta_data->>'player_invite_token', ''), 'sha256')
      and used_at is null and expires_at > timezone('utc'::text, now())
    for update;
    if player_invite.id is null then raise exception 'PLAYER_INVITE_INVALID'; end if;
    update public.profiles set account_role = 'player_parent' where id = new.id;
    insert into public.player_guardians(club_player_id, player_id, profile_id, access_scope, valid_from)
    values (player_invite.club_player_id, player_invite.player_id, new.id, 'from_acceptance', timezone('utc'::text, now()));
    update public.player_invites set used_at = timezone('utc'::text, now()), used_by = new.id
    where id = player_invite.id and used_at is null;
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
