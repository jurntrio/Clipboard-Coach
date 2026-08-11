-- Run after migrations with: supabase test db
begin;
create extension if not exists pgtap;
select plan(7);
-- 1: deletion guard, 2-5: provisioning, 6-7: second team reuses the club

insert into auth.users(id, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000099', 'deletable-solo-coach@example.test', '{}');
insert into public.teams(coach_id, name) values ('30000000-0000-0000-0000-000000000099', 'Deletable Team');
delete from auth.users where id = '30000000-0000-0000-0000-000000000099';
select ok(
  not exists(select 1 from public.profiles where id = '30000000-0000-0000-0000-000000000099'),
  'creating a personal club never blocks later profile deletion'
);

insert into auth.users(id, email, raw_user_meta_data)
values ('30000000-0000-0000-0000-000000000001', 'solo-coach@example.test', '{"full_name":"Solo Coach"}');

insert into public.teams(coach_id, name) values ('30000000-0000-0000-0000-000000000001', 'FC Solo');

select ok(
  exists(select 1 from public.clubs where is_personal and created_by = '30000000-0000-0000-0000-000000000001'),
  'a personal club is auto-created for a new standalone team'
);
select ok(
  (select club_team_id from public.teams where name = 'FC Solo') is not null,
  'the standalone team is linked back to a club_teams row'
);
select ok(
  exists(
    select 1 from public.club_teams t
    join public.clubs c on c.id = t.club_id
    where c.is_personal and c.created_by = '30000000-0000-0000-0000-000000000001'
      and t.name = 'FC Solo' and t.season_id is not null
  ),
  'the club_teams row has a season assigned'
);
select ok(
  exists(
    select 1 from public.club_memberships m
    join public.clubs c on c.id = m.club_id
    where c.is_personal and c.created_by = '30000000-0000-0000-0000-000000000001'
      and m.profile_id = '30000000-0000-0000-0000-000000000001'
      and m.role = 'club_admin' and m.status = 'active' and m.function_role = 'club_admin'
  ),
  'the coach becomes club_admin of their own personal club'
);
-- A second standalone team from the same coach reuses the same personal club.
insert into public.teams(coach_id, name) values ('30000000-0000-0000-0000-000000000001', 'FC Solo U9');
select is(
  (select count(*)::integer from public.clubs where is_personal and created_by = '30000000-0000-0000-0000-000000000001'),
  1,
  'a second standalone team does not spawn a second personal club'
);
select ok(
  exists(
    select 1 from public.club_teams t
    join public.clubs c on c.id = t.club_id
    where c.is_personal and c.created_by = '30000000-0000-0000-0000-000000000001' and t.name = 'FC Solo U9'
  ),
  'the second team is added under the existing personal club'
);

select * from finish();
rollback;
