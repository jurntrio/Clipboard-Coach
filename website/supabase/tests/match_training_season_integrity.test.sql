-- Run after migrations with: supabase test db
begin;
create extension if not exists pgtap;
select plan(5);

insert into auth.users(id, email, raw_user_meta_data)
values ('20000000-0000-0000-0000-000000000001', 'season-integrity-coach@example.test', '{}');

insert into public.clubs(name, normalized_name, status)
values ('Season Integrity Test Club', 'season integrity test club', 'active');

-- No season_id supplied: 0152's club_teams trigger lazily creates/assigns the active season.
insert into public.club_teams(club_id, name, normalized_name)
select id, 'U15 Test', 'u15 test' from public.clubs where name = 'Season Integrity Test Club';

insert into public.matches(coach_id, club_id, club_team_id, match_date, is_home_match)
select '20000000-0000-0000-0000-000000000001', c.id, t.id, current_date, true
from public.clubs c join public.club_teams t on t.club_id = c.id
where c.name = 'Season Integrity Test Club';

select is(
  (select m.season_id from public.matches m join public.club_teams t on t.id = m.club_team_id
   join public.clubs c on c.id = t.club_id where c.name = 'Season Integrity Test Club'),
  (select t.season_id from public.club_teams t join public.clubs c on c.id = t.club_id
   where c.name = 'Season Integrity Test Club'),
  'match season_id is derived from its club_team, not left null'
);

insert into public.team_training_sessions(club_id, club_team_id, training_date, start_time)
select c.id, t.id, current_date, '18:00'
from public.clubs c join public.club_teams t on t.club_id = c.id
where c.name = 'Season Integrity Test Club';

select is(
  (select tr.season_id from public.team_training_sessions tr join public.club_teams t on t.id = tr.club_team_id
   join public.clubs c on c.id = t.club_id where c.name = 'Season Integrity Test Club'),
  (select t.season_id from public.club_teams t join public.clubs c on c.id = t.club_id
   where c.name = 'Season Integrity Test Club'),
  'training session season_id is derived from its club_team, not left null'
);

-- A team already advanced into next season's PREPARATION keeps that season, not the club's active one.
insert into public.club_seasons(club_id, name, starts_on, ends_on, is_active, status)
select id, 'Prep Test Season', date '2099-07-01', date '2100-06-30', false, 'PREPARATION'
from public.clubs where name = 'Season Integrity Test Club';

insert into public.club_teams(club_id, name, normalized_name, season_id, copied_from_team_id)
select c.id, 'U15 Test', 'u15 test', s.id, t.id
from public.clubs c
join public.club_seasons s on s.club_id = c.id and s.name = 'Prep Test Season'
join public.club_teams t on t.club_id = c.id and t.name = 'U15 Test'
where c.name = 'Season Integrity Test Club';

insert into public.matches(coach_id, club_id, club_team_id, match_date, is_home_match)
select '20000000-0000-0000-0000-000000000001', c.id, t.id, current_date, true
from public.clubs c
join public.club_seasons s on s.club_id = c.id and s.name = 'Prep Test Season'
join public.club_teams t on t.club_id = c.id and t.season_id = s.id
where c.name = 'Season Integrity Test Club';

select is(
  (select s.status from public.matches m
   join public.club_teams t on t.id = m.club_team_id
   join public.club_seasons s on s.id = m.season_id
   where t.club_id = (select id from public.clubs where name = 'Season Integrity Test Club')
     and s.name = 'Prep Test Season'),
  'PREPARATION',
  'a match tied to a team already in PREPARATION gets that season, not the club active season'
);

select lives_ok(
  $$insert into public.matches(coach_id, is_home_match, match_date) values ('20000000-0000-0000-0000-000000000001', true, current_date)$$,
  'a standalone match with no club_team_id is not forced into a season'
);
select is(
  (select season_id from public.matches where coach_id = '20000000-0000-0000-0000-000000000001' and club_team_id is null),
  null,
  'season_id stays null for a match with no club_team_id'
);

select * from finish();
rollback;
