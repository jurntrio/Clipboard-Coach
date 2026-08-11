-- A solo coach who creates a standalone team today (teams.coach_id, via
-- CreateTeamModal.tsx) lands in the legacy non-club system: no season model, no
-- club_admin, and a second, separately-maintained permission path in
-- website/src/app/api/teams/route.ts. New solo signups should instead get an
-- automatically provisioned, single-member "personal" club, so they run through
-- the same season-aware system as every other club -- just with the club-admin
-- chrome hidden in the UI (see the dashboard/club gating that ships alongside
-- this migration). Existing standalone teams are untouched: this trigger only
-- fires on new `teams` inserts going forward.
--
-- Deliberately does NOT create a club_trainers row for the coach: inserting into
-- club_trainers with profile_id set trips sync_trainer_identity_projection()
-- (0108), which links a permanent, delete-restricted person_accounts row --
-- profile_deletion_preserves_team_history.test.sql requires that creating a
-- standalone team never blocks later account deletion. club_admin access via
-- club_memberships alone is sufficient: canAccessTeam()/hasClubPermission() key
-- off club_memberships + team_scope, not club_trainer_teams (that table only
-- drives the narrower "which matches is this non-admin trainer assigned to"
-- view, per website/src/app/api/matches/hub/route.ts).

alter table public.clubs add column if not exists is_personal boolean not null default false;

create or replace function public.provision_personal_club_for_team()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_club_id uuid;
  v_season_id uuid;
  v_club_team_id uuid;
  trainer_name_value text;
  club_name_value text;
begin
  -- Reuse an existing personal club for this coach rather than spawning a new
  -- one per team, so a solo coach with several teams still has just one club.
  select c.id into v_club_id
  from public.club_memberships m
  join public.clubs c on c.id = m.club_id and c.is_personal
  where m.profile_id = new.coach_id and m.role = 'club_admin' and m.status = 'active'
  limit 1;

  if v_club_id is null then
    -- Only auto-provision for genuinely club-less coaches. A coach who already
    -- belongs to a real club (trainer, pending request, admin...) must not have
    -- an unrelated side team pulled into club data -- club_player_identity
    -- .test.sql's "Personal Team Test" fixture requires a standalone team to
    -- stay fully outside the club system when the same coach already has real
    -- club history, so it keeps being excluded from club-scoped player backfill.
    if exists (select 1 from public.club_memberships where profile_id = new.coach_id)
      or exists (select 1 from public.club_trainers where profile_id = new.coach_id) then
      return new;
    end if;

    select coalesce(nullif(trim(full_name), ''), email, 'Coach') into trainer_name_value
    from public.profiles where id = new.coach_id;
    trainer_name_value := coalesce(trainer_name_value, 'Coach');

    club_name_value := coalesce(nullif(trim(new.name), ''), trainer_name_value)
      || ' (' || left(new.coach_id::text, 8) || ')';
    insert into public.clubs(name, normalized_name, status, created_by, is_personal)
    values (club_name_value, public.normalize_club_team_name(club_name_value), 'active', new.coach_id, true)
    returning id into v_club_id;

    insert into public.club_memberships(club_id, profile_id, role, status, function_role, team_scope)
    values (v_club_id, new.coach_id, 'club_admin', 'active', 'club_admin', 'all');

    update public.profiles set account_role = 'club_admin' where id = new.coach_id;
  end if;

  v_season_id := public.ensure_active_club_season(v_club_id);

  insert into public.club_teams(club_id, name, normalized_name, season_id, status, created_by, approved_by, approved_at)
  values (v_club_id, new.name, public.normalize_club_team_name(new.name), v_season_id, 'active', new.coach_id, new.coach_id, now())
  returning id into v_club_team_id;

  update public.teams set club_team_id = v_club_team_id where id = new.id;

  return new;
end;
$$;

revoke all on function public.provision_personal_club_for_team() from public, anon, authenticated;

drop trigger if exists provision_personal_club_trigger on public.teams;
create trigger provision_personal_club_trigger
after insert on public.teams
for each row
when (new.coach_id is not null and new.club_team_id is null)
execute function public.provision_personal_club_for_team();

notify pgrst, 'reload schema';
