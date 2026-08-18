-- Repair the first independent-trainer release on databases where 0165 has
-- already run. SQL NULL must stay on the legacy/official onboarding path, and
-- the original global clubs.name uniqueness must not block equal display names
-- in separate personal tenants.

alter table public.clubs drop constraint if exists clubs_name_key;

create or replace function public.complete_club_team_onboarding(
  target_user_id uuid, user_email text, user_full_name text, onboarding jsonb
) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  club_name_value text := trim(coalesce(onboarding->>'club_name', ''));
  team_name_value text := trim(coalesce(onboarding->>'team_name', ''));
  age_category_value text := nullif(trim(coalesce(onboarding->>'age_category', '')), '');
  personal_club_id uuid;
  personal_season_id uuid;
  personal_club_team_id uuid;
begin
  if onboarding->>'request_kind' is distinct from 'personal_trainer' then
    perform public.complete_official_club_team_onboarding(
      target_user_id, user_email, user_full_name, onboarding
    );
    return;
  end if;

  if club_name_value = '' or team_name_value = '' then
    raise exception 'PERSONAL_TRAINER_FIELDS_REQUIRED';
  end if;

  insert into public.clubs(name, normalized_name, status, created_by, is_personal)
  values (
    club_name_value,
    public.normalize_club_team_name(club_name_value),
    'active',
    target_user_id,
    true
  ) returning id into personal_club_id;

  insert into public.club_memberships(
    club_id, profile_id, role, status, function_role, team_scope
  ) values (
    personal_club_id, target_user_id, 'club_admin', 'active', 'club_admin', 'all'
  );
  update public.profiles set account_role = 'coach' where id = target_user_id;

  personal_season_id := public.ensure_active_club_season(personal_club_id);
  insert into public.club_teams(
    club_id, name, normalized_name, age_category, season_id,
    status, created_by, approved_by, approved_at
  ) values (
    personal_club_id, team_name_value,
    public.normalize_club_team_name(team_name_value), age_category_value,
    personal_season_id, 'active', target_user_id, target_user_id, now()
  ) returning id into personal_club_team_id;

  insert into public.teams(coach_id, name, age_group, club_name, club_team_id)
  values (
    target_user_id, team_name_value, age_category_value,
    club_name_value, personal_club_team_id
  );
end;
$$;

revoke all on function public.complete_club_team_onboarding(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_club_team_onboarding(uuid,text,text,jsonb)
  to service_role;

notify pgrst, 'reload schema';
