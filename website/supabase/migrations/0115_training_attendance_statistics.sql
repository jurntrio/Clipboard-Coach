-- Three-state training attendance and historically bounded Extra-group membership.

alter table public.team_training_attendance
  drop constraint if exists team_training_attendance_attendance_status_check;
update public.team_training_attendance set attendance_status = 'present' where attendance_status = 'unknown';
alter table public.team_training_attendance alter column attendance_status set default 'present';
alter table public.team_training_attendance
  add constraint team_training_attendance_attendance_status_check
  check (attendance_status in ('present', 'injured', 'absent'));

alter table public.player_group_players
  add column if not exists valid_from date,
  add column if not exists valid_until date;

update public.player_group_players
set valid_from = (added_at at time zone 'utc')::date
where valid_from is null;

alter table public.player_group_players
  alter column valid_from set default current_date,
  alter column valid_from set not null;

alter table public.player_group_players
  drop constraint if exists player_group_players_valid_period_check;
alter table public.player_group_players
  add constraint player_group_players_valid_period_check
  check (valid_until is null or valid_from <= valid_until);

create index if not exists player_group_players_group_period_idx
  on public.player_group_players(group_id, valid_from, valid_until);
create index if not exists team_training_attendance_session_status_idx
  on public.team_training_attendance(training_session_id, attendance_status);

notify pgrst, 'reload schema';
