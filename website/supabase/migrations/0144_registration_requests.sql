-- Registration asks for intent; a club admin assigns the definitive function and teams.
create table public.club_registration_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_kind text not null check (request_kind in ('staff','contact')),
  requested_function_role text,
  requested_custom_role text,
  requested_team_id uuid references public.club_teams(id) on delete set null,
  player_first_name text,
  player_last_name text,
  player_date_of_birth date,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (club_id, profile_id),
  check (
    (request_kind = 'staff' and player_first_name is null and player_last_name is null and player_date_of_birth is null)
    or
    (request_kind = 'contact' and player_first_name is not null and player_last_name is not null and player_date_of_birth is not null)
  )
);
create index club_registration_requests_pending_idx on public.club_registration_requests(club_id, status, created_at);
alter table public.club_registration_requests enable row level security;
revoke all on public.club_registration_requests from anon, authenticated;

create or replace function public.complete_club_team_onboarding(
  target_user_id uuid, user_email text, user_full_name text, onboarding jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  selected_club_id uuid;
  request_kind text := coalesce(onboarding->>'request_kind', 'legacy');
  selected_team_id uuid;
  requested_function text;
  custom_function text;
  first_name_value text;
  last_name_value text;
  birth_date_value date;
begin
  if request_kind = 'none' then return; end if;

  if onboarding->>'club_mode' = 'existing' and request_kind in ('staff','contact') then
    select id into selected_club_id from public.clubs
    where id = nullif(onboarding->>'club_id','')::uuid and status = 'active';
    if selected_club_id is null then raise exception 'ONBOARDING_CLUB_NOT_FOUND'; end if;

    if nullif(onboarding->>'team_id','') is not null then
      select id into selected_team_id from public.club_teams
      where id = (onboarding->>'team_id')::uuid and club_id = selected_club_id
        and status = 'active' and season_id in (
          select id from public.club_seasons where club_id = selected_club_id and status = 'ACTIVE'
        );
      if selected_team_id is null then raise exception 'ONBOARDING_TEAM_NOT_FOUND'; end if;
    end if;

    if request_kind = 'staff' then
      requested_function := nullif(trim(coalesce(onboarding->>'function_role','')), '');
      custom_function := nullif(trim(coalesce(onboarding->>'custom_role_name','')), '');
      if requested_function = 'custom' and custom_function is null then raise exception 'CUSTOM_ROLE_REQUIRED'; end if;
    else
      first_name_value := nullif(trim(coalesce(onboarding->>'player_first_name','')), '');
      last_name_value := nullif(trim(coalesce(onboarding->>'player_last_name','')), '');
      birth_date_value := nullif(onboarding->>'player_date_of_birth','')::date;
      if first_name_value is null or last_name_value is null or birth_date_value is null then
        raise exception 'CONTACT_PLAYER_FIELDS_REQUIRED';
      end if;
    end if;

    insert into public.club_registration_requests(
      club_id, profile_id, request_kind, requested_function_role, requested_custom_role,
      requested_team_id, player_first_name, player_last_name, player_date_of_birth
    ) values (
      selected_club_id, target_user_id, request_kind, requested_function, custom_function,
      selected_team_id, first_name_value, last_name_value, birth_date_value
    ) on conflict(club_id, profile_id) do update set
      request_kind=excluded.request_kind, requested_function_role=excluded.requested_function_role,
      requested_custom_role=excluded.requested_custom_role, requested_team_id=excluded.requested_team_id,
      player_first_name=excluded.player_first_name, player_last_name=excluded.player_last_name,
      player_date_of_birth=excluded.player_date_of_birth, status='pending', reviewed_by=null, reviewed_at=null;

    perform public.notify_club_admins_of_pending_request(
      selected_club_id, target_user_id, 'Nieuwe registratieaanvraag',
      coalesce(nullif(trim(user_full_name),''),user_email) ||
      case when request_kind='contact' then ' vraagt een koppeling als contactpersoon.'
           else ' vraagt toegang als staflid.' end ||
      ' Ga naar Clubbeheer > Goedkeuringen om functie en teams te bepalen.'
    );
    return;
  end if;

  perform public.complete_club_team_onboarding_before_first_admin(target_user_id,user_email,user_full_name,onboarding);
  if onboarding->>'club_mode' <> 'new' then return; end if;
  select club.id into selected_club_id from public.clubs club
  where club.created_by=target_user_id
    and club.normalized_name=public.normalize_club_team_name(onboarding->>'club_name')
  order by club.created_at desc limit 1;
  if selected_club_id is null then raise exception 'ONBOARDING_CREATED_CLUB_NOT_FOUND'; end if;
  update public.club_memberships set role='club_admin',status='active',function_role='club_admin',team_scope='all'
  where club_id=selected_club_id and profile_id=target_user_id;
  update public.profiles set account_role='club_admin' where id=target_user_id;
end $$;

revoke all on function public.complete_club_team_onboarding(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_club_team_onboarding(uuid,text,text,jsonb) to service_role;
notify pgrst, 'reload schema';
