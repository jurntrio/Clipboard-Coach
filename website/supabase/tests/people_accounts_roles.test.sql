begin;
create extension if not exists pgtap;
select plan(32);

select has_table('public', 'people', 'people exists');
select has_table('public', 'person_accounts', 'person_accounts exists');
select has_table('public', 'club_people', 'club_people exists');
select has_table('public', 'club_role_assignments', 'club_role_assignments exists');
select has_column('public', 'club_players', 'club_person_id', 'club_players has nullable identity link');
select has_column('public', 'club_trainers', 'club_person_id', 'club_trainers has compatibility link');
select has_column('public', 'club_trainer_teams', 'club_role_assignment_id', 'trainer teams have compatibility link');
select ok(
  to_regclass('public.person_accounts_one_active_person_idx') is not null
    and to_regclass('public.person_accounts_one_active_profile_idx') is not null,
  'partial unique indexes are database-level race guards'
);
select ok(
  position(
    'for update' in lower(
      pg_get_functiondef('public.link_person_account(uuid,uuid,text,uuid)'::regprocedure)
    )
  ) > 0,
  'account claim command locks person and profile before linking'
);

insert into public.clubs(id, name, normalized_name) values
  ('86000000-0000-0000-0000-000000000001', 'People Test Club A', 'people test club a'),
  ('86000000-0000-0000-0000-000000000002', 'People Test Club B', 'people test club b');

insert into public.club_teams(id, club_id, name) values
  ('86000000-0000-0000-0000-000000000011', '86000000-0000-0000-0000-000000000001', 'U17 A'),
  ('86000000-0000-0000-0000-000000000012', '86000000-0000-0000-0000-000000000002', 'U17 B');

insert into auth.users(id, email, raw_user_meta_data) values
  ('86000000-0000-0000-0000-000000000021', 'admin-a@people.test', '{"full_name":"Admin A"}'),
  ('86000000-0000-0000-0000-000000000022', 'admin-b@people.test', '{"full_name":"Admin B"}'),
  ('86000000-0000-0000-0000-000000000023', 'account-one@people.test', '{"full_name":"Account One"}'),
  ('86000000-0000-0000-0000-000000000024', 'account-two@people.test', '{"full_name":"Account Two"}');

insert into public.club_memberships(club_id, profile_id, role, status) values
  ('86000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000021', 'club_admin', 'active'),
  ('86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000022', 'club_admin', 'active');

do $$ begin
  perform public.ensure_registered_club_identity(
    '86000000-0000-0000-0000-000000000021', '86000000-0000-0000-0000-000000000001',
    '86000000-0000-0000-0000-000000000021'
  );
  perform public.ensure_registered_club_identity(
    '86000000-0000-0000-0000-000000000022', '86000000-0000-0000-0000-000000000002',
    '86000000-0000-0000-0000-000000000022'
  );
end $$;

insert into public.people(id, first_name, last_name, date_of_birth) values
  ('86000000-0000-0000-0000-000000000031', 'Dylan', 'Bauwens', '2009-01-01'),
  ('86000000-0000-0000-0000-000000000032', 'Dylan', 'Bauwens', null),
  ('86000000-0000-0000-0000-000000000033', 'Other', 'Person', null);

insert into public.club_people(id, club_id, person_id) values
  ('86000000-0000-0000-0000-000000000041', '86000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000031'),
  ('86000000-0000-0000-0000-000000000042', '86000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000032'),
  ('86000000-0000-0000-0000-000000000043', '86000000-0000-0000-0000-000000000002', '86000000-0000-0000-0000-000000000033');

select is(
  (select count(*) from public.people where first_name = 'Dylan' and last_name = 'Bauwens'),
  2::bigint, 'same name never auto-merges people'
);

select lives_ok(
  $$insert into public.person_accounts(
      person_id, profile_id, status, link_method, verified_at, verified_by
    ) values (
      '86000000-0000-0000-0000-000000000031',
      '86000000-0000-0000-0000-000000000023',
      'active', 'admin_review', now(),
      '86000000-0000-0000-0000-000000000021'
    )$$,
  'a verified account link can be created'
);

select throws_ok(
  $$insert into public.person_accounts(
      person_id, profile_id, status, link_method, verified_at
    ) values (
      '86000000-0000-0000-0000-000000000031',
      '86000000-0000-0000-0000-000000000024',
      'active', 'admin_review', now()
    )$$,
  '23505', null, 'one person cannot have two active accounts'
);

select throws_ok(
  $$insert into public.person_accounts(
      person_id, profile_id, status, link_method, verified_at
    ) values (
      '86000000-0000-0000-0000-000000000032',
      '86000000-0000-0000-0000-000000000023',
      'active', 'admin_review', now()
    )$$,
  '23505', null, 'one account cannot represent two active people'
);

select lives_ok(
  $$insert into public.club_role_assignments(
      club_person_id, role_type, club_team_id
    ) values (
      '86000000-0000-0000-0000-000000000042', 'scout', null
    )$$,
  'a person without account can hold a club-wide role'
);

select throws_ok(
  $$insert into public.club_people(club_id, person_id)
    values (
      '86000000-0000-0000-0000-000000000001',
      '86000000-0000-0000-0000-000000000031'
    )$$,
  '23505', null, 'club and person pair is unique'
);

select throws_ok(
  $$insert into public.club_role_assignments(club_person_id, role_type, club_team_id)
    values (
      '86000000-0000-0000-0000-000000000041',
      'trainer',
      '86000000-0000-0000-0000-000000000012'
    )$$,
  'P0001', 'CLUB_ROLE_TEAM_MISMATCH', 'cross-club role assignment is blocked'
);

select set_config('request.jwt.claim.sub', '86000000-0000-0000-0000-000000000021', true);
set local role authenticated;
select is(
  (select count(*) from public.club_people),
  3::bigint, 'club A admin only reads club A people, including their own canonical identity'
);
select is(
  (select count(*) from public.club_people where club_id = '86000000-0000-0000-0000-000000000002'),
  0::bigint, 'club A admin cannot read club B person'
);
reset role;

select set_config('request.jwt.claim.sub', '86000000-0000-0000-0000-000000000021', true);
select lives_ok(
  $$select public.assign_club_role(
      '86000000-0000-0000-0000-000000000041',
      'trainer',
      '86000000-0000-0000-0000-000000000011',
      current_date,
      null
    )$$,
  'club admin assigns a trainer role without requiring an account'
);

select is(
  (select count(*) from public.club_trainers where club_person_id = '86000000-0000-0000-0000-000000000041'),
  1::bigint, 'trainer compatibility projection is created once'
);
select is(
  (select count(*) from public.club_trainer_teams where club_role_assignment_id is not null),
  1::bigint, 'team compatibility projection maps to canonical role'
);

select set_config('request.jwt.claim.sub', '86000000-0000-0000-0000-000000000022', true);
select throws_ok(
  $$select public.assign_club_role(
      '86000000-0000-0000-0000-000000000041',
      'volunteer', null, current_date, null
    )$$,
  'P0001', 'CLUB_ADMIN_REQUIRED', 'other club admin cannot assign a role'
);

select set_config('request.jwt.claim.sub', '86000000-0000-0000-0000-000000000021', true);
select lives_ok(
  $$select public.end_club_role(
      (select id from public.club_role_assignments
       where club_person_id = '86000000-0000-0000-0000-000000000041'
         and role_type = 'trainer'),
      current_date,
      'test end'
    )$$,
  'ending a role succeeds'
);
select is(
  (select status from public.club_role_assignments
   where club_person_id = '86000000-0000-0000-0000-000000000041' and role_type = 'trainer'),
  'ended', 'role is ended, not deleted'
);
select ok(
  exists(select 1 from public.people where id = '86000000-0000-0000-0000-000000000031'),
  'ending a role keeps the person'
);
select ok(
  exists(select 1 from public.club_people where id = '86000000-0000-0000-0000-000000000041'),
  'ending a role keeps the club person'
);

select throws_ok(
  $$delete from public.people where id = '86000000-0000-0000-0000-000000000031'$$,
  '23503', null, 'person deletion cannot cascade through club or account history'
);
select throws_ok(
  $$delete from public.club_people where id = '86000000-0000-0000-0000-000000000041'$$,
  '23503', null, 'club person deletion cannot cascade through role history'
);

select lives_ok(
  $$insert into public.person_claim_reviews(
      requested_profile_id, candidate_person_id, club_id, reason, evidence
    ) values (
      '86000000-0000-0000-0000-000000000024',
      '86000000-0000-0000-0000-000000000032',
      '86000000-0000-0000-0000-000000000001',
      'name_match',
      '{"matched_on":"name_only"}'
    )$$,
  'name-only match can only create a review candidate'
);
select is(
  (select count(*) from public.person_accounts
   where person_id = '86000000-0000-0000-0000-000000000032'),
  0::bigint, 'name-only review does not link an account'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.link_person_account(uuid,uuid,text,uuid)',
    'EXECUTE'
  ) = false,
  'account linking is not client-callable'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.merge_people(uuid,uuid,uuid,text)',
    'EXECUTE'
  ) = false,
  'person merging is not client-callable'
);

select * from finish();
rollback;
