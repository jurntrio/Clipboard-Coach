-- Fix voor de bekende, pre-existing bug in complete_club_team_onboarding() (0021): de lokale
-- plpgsql-variabele heette "trainer_id", identiek aan de kolom club_trainer_teams.trainer_id die
-- in "on conflict(trainer_id, club_team_id)" gebruikt wordt. Postgres kan dan niet meer bepalen
-- of "trainer_id" de variabele of de kolom bedoelt ("column reference trainer_id is ambiguous"),
-- en blokkeert daardoor élke nieuwe-club-registratie via signup (handle_new_user -> deze functie).
-- Geen datamodel-wijziging, enkel de lokale variabele hernoemd naar v_trainer_id (de v_-conventie
-- die sinds 0030 elders in dit project net voor dit soort botsingen gebruikt wordt).
create or replace function public.complete_club_team_onboarding(
  target_user_id uuid,
  user_email text,
  user_full_name text,
  onboarding jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  selected_club_id uuid;
  selected_team_id uuid;
  v_trainer_id uuid;
  mode text := onboarding->>'club_mode';
  team_mode text := onboarding->>'team_mode';
  requested_role text := coalesce(onboarding->>'team_role', 'coach');
  club_name_value text := trim(coalesce(onboarding->>'club_name', ''));
  registration_value text := nullif(trim(coalesce(onboarding->>'registration_number', '')), '');
  team_name_value text := trim(coalesce(onboarding->>'team_name', ''));
  similar_club record;
begin
  if requested_role not in ('coach', 'assistant_coach', 'team_manager') then
    requested_role := 'coach';
  end if;

  if mode = 'existing' then
    select id into selected_club_id from public.clubs
    where id = nullif(onboarding->>'club_id', '')::uuid and status = 'active';
    if selected_club_id is null then raise exception 'ONBOARDING_CLUB_NOT_FOUND'; end if;
  elsif mode = 'new' then
    if club_name_value = '' or team_name_value = '' then raise exception 'ONBOARDING_FIELDS_REQUIRED'; end if;
    if registration_value is not null then
      select id into selected_club_id from public.clubs
      where lower(trim(rbfa_registration_number)) = lower(registration_value);
      if selected_club_id is not null then
        raise exception 'DUPLICATE_REGISTRATION_USE_EXISTING';
      end if;
    end if;
    if selected_club_id is null then
      if exists(select 1 from public.clubs where normalized_name = public.normalize_club_team_name(club_name_value)) then
        raise exception 'DUPLICATE_CLUB_NAME_USE_EXISTING';
      end if;
      select * into similar_club from public.clubs
      where normalized_name = public.normalize_club_team_name(club_name_value)
         or similarity(normalized_name, public.normalize_club_team_name(club_name_value)) >= 0.72
      order by similarity(normalized_name, public.normalize_club_team_name(club_name_value)) desc limit 1;
      if found and not coalesce((onboarding->>'similar_club_acknowledged')::boolean, false) then
        raise exception 'SIMILAR_CLUB_REQUIRES_CONFIRMATION';
      end if;
      begin
        insert into public.clubs(name, normalized_name, rbfa_registration_number, status, created_by)
        values (club_name_value, public.normalize_club_team_name(club_name_value), registration_value, 'active', target_user_id)
        returning id into selected_club_id;
      exception when unique_violation then
        raise exception 'DUPLICATE_CLUB_USE_EXISTING';
      end;
    end if;
  else
    raise exception 'ONBOARDING_MODE_INVALID';
  end if;

  if mode = 'new' then
    insert into public.club_memberships(club_id, profile_id, role, status)
    values(selected_club_id, target_user_id, 'club_admin', 'active')
    on conflict(club_id, profile_id) do update set role = 'club_admin', status = 'active';
    update public.profiles set account_role = 'club_admin' where id = target_user_id;
  else
    insert into public.club_memberships(club_id, profile_id, role, status)
    values(selected_club_id, target_user_id, requested_role, 'active')
    on conflict(club_id, profile_id) do update set status = 'active';
  end if;

  if team_mode = 'existing' then
    select id into selected_team_id from public.club_teams
    where id = nullif(onboarding->>'team_id', '')::uuid
      and club_id = selected_club_id and status = 'active';
    if selected_team_id is null then raise exception 'ONBOARDING_TEAM_NOT_FOUND'; end if;
  elsif team_mode = 'new' or mode = 'new' then
    if team_name_value = '' then raise exception 'ONBOARDING_TEAM_REQUIRED'; end if;
    insert into public.club_teams(
      club_id, name, normalized_name, age_category, level_or_competition,
      status, created_by, approved_by, approved_at
    ) values (
      selected_club_id, team_name_value, public.normalize_club_team_name(team_name_value),
      nullif(trim(coalesce(onboarding->>'age_category', '')), ''),
      nullif(trim(coalesce(onboarding->>'level_or_competition', '')), ''),
      case when mode = 'new' then 'active' else 'pending' end, target_user_id,
      case when mode = 'new' then target_user_id else null end,
      case when mode = 'new' then timezone('utc'::text, now()) else null end
    )
    on conflict (club_id, normalized_name) where status not in ('rejected', 'archived', 'merged')
    do update set name = public.club_teams.name
    returning id into selected_team_id;
  else
    raise exception 'ONBOARDING_TEAM_MODE_INVALID';
  end if;

  insert into public.club_trainers(club_id, profile_id, display_name, invitation_status)
  values(selected_club_id, target_user_id, coalesce(nullif(trim(user_full_name), ''), user_email), 'linked')
  on conflict (club_id, profile_id) where profile_id is not null
  do update set invitation_status = 'linked'
  returning id into v_trainer_id;

  insert into public.club_trainer_teams(trainer_id, club_team_id, role, status)
  values(v_trainer_id, selected_team_id, requested_role,
    case when (select status from public.club_teams where id = selected_team_id) = 'pending' then 'pending' else 'active' end)
  on conflict(trainer_id, club_team_id) do update set role = excluded.role, status = excluded.status;
end;
$$;
revoke all on function public.complete_club_team_onboarding(uuid, text, text, jsonb) from public, anon, authenticated;
