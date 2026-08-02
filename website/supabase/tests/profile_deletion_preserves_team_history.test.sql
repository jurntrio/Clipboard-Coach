-- Run after migrations with: supabase test db
begin;
create extension if not exists pgtap;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'a1000000-0000-0000-0000-000000000001',
  'history-owner@example.test',
  '{"full_name":"History Owner"}'
);

insert into public.teams (id, coach_id, name)
values (
  'a1000000-0000-0000-0000-000000000010',
  'a1000000-0000-0000-0000-000000000001',
  'History Team'
);

insert into public.players (id, team_id, first_name, last_name)
values (
  'a1000000-0000-0000-0000-000000000020',
  'a1000000-0000-0000-0000-000000000010',
  'History',
  'Player'
);

insert into public.videos (id, coach_id, team_id, title, video_url, video_key)
values (
  'a1000000-0000-0000-0000-000000000030',
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000010',
  'History Video',
  'https://example.test/history.mp4',
  'test/history.mp4'
);

insert into public.tags (id, video_id, name, start_time, end_time, color)
values (
  'a1000000-0000-0000-0000-000000000040',
  'a1000000-0000-0000-0000-000000000030',
  'Goal',
  10,
  15,
  '#ffffff'
);

insert into public.matches (id, coach_id, team_a_id, team_a_name, team_b_name)
values (
  'a1000000-0000-0000-0000-000000000050',
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000010',
  'History Team',
  'Visitors'
);

insert into public.clips (id, coach_id, video_id, team_id, name)
values (
  'a1000000-0000-0000-0000-000000000060',
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000030',
  'a1000000-0000-0000-0000-000000000010',
  'History Clip'
);

insert into public.player_stat_events (
  id, coach_id, match_id, tag_id, player_id, stat_type, team_id
)
values (
  'a1000000-0000-0000-0000-000000000070',
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000050',
  'a1000000-0000-0000-0000-000000000040',
  'a1000000-0000-0000-0000-000000000020',
  'goal',
  'a1000000-0000-0000-0000-000000000010'
);

delete from auth.users where id = 'a1000000-0000-0000-0000-000000000001';

select ok(
  not exists(select 1 from public.profiles where id = 'a1000000-0000-0000-0000-000000000001'),
  'deleting the auth user still removes its profile'
);
select ok(exists(select 1 from public.teams where id = 'a1000000-0000-0000-0000-000000000010'), 'team survives profile deletion');
select ok(exists(select 1 from public.matches where id = 'a1000000-0000-0000-0000-000000000050'), 'match survives profile deletion');
select ok(exists(select 1 from public.videos where id = 'a1000000-0000-0000-0000-000000000030'), 'video survives profile deletion');
select ok(exists(select 1 from public.clips where id = 'a1000000-0000-0000-0000-000000000060'), 'clip survives profile deletion');
select ok(exists(select 1 from public.player_stat_events where id = 'a1000000-0000-0000-0000-000000000070'), 'player statistic survives profile deletion');
select is((select coach_id from public.matches where id = 'a1000000-0000-0000-0000-000000000050'), null::uuid, 'match creator attribution is cleared');
select is((select coach_id from public.videos where id = 'a1000000-0000-0000-0000-000000000030'), null::uuid, 'video creator attribution is cleared');
select is((select coach_id from public.clips where id = 'a1000000-0000-0000-0000-000000000060'), null::uuid, 'clip creator attribution is cleared');
select is((select coach_id from public.player_stat_events where id = 'a1000000-0000-0000-0000-000000000070'), null::uuid, 'player statistic creator attribution is cleared');

select * from finish();
rollback;
