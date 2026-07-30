begin;
create extension if not exists pgtap;
select plan(24);

select has_table('public', 'person_account_invitations', 'person invitations table exists');
select has_function('public', 'create_person_account_invitation',
  array['uuid','text','uuid','interval'], 'invite creation function exists');
select has_function('public', 'consume_person_account_invitation',
  array['text','uuid'], 'invite consumption function exists');

insert into public.clubs(id, name, normalized_name, status)
values ('88000000-0000-0000-0000-000000000001', 'Claims Test Club', 'claims test club', 'active');
insert into public.club_teams(id, club_id, name, normalized_name, status)
values ('88000000-0000-0000-0000-000000000002',
  '88000000-0000-0000-0000-000000000001', 'Claims U17', 'claims u17', 'active');

insert into auth.users(id, email, raw_user_meta_data) values
  ('88000000-0000-0000-0000-000000000011', 'claims-admin@example.test', '{"full_name":"Claims Admin"}'),
  ('88000000-0000-0000-0000-000000000012', 'first-account@example.test', '{"full_name":"Same Name"}'),
  ('88000000-0000-0000-0000-000000000013', 'wrong-account@example.test', '{"full_name":"Same Name"}'),
  ('88000000-0000-0000-0000-000000000014', 'second-account@example.test', '{"full_name":"Second Account"}');
insert into public.club_memberships(club_id, profile_id, role, status)
values ('88000000-0000-0000-0000-000000000001',
  '88000000-0000-0000-0000-000000000011', 'club_admin', 'active');

insert into public.people(id, first_name, last_name) values
  ('88000000-0000-0000-0000-000000000021', 'Same', 'Name'),
  ('88000000-0000-0000-0000-000000000022', 'Same', 'Name');
insert into public.club_people(id, club_id, person_id) values
  ('88000000-0000-0000-0000-000000000031',
    '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000021'),
  ('88000000-0000-0000-0000-000000000032',
    '88000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000022');

create temporary table issued_invite as
select * from public.create_person_account_invitation(
  '88000000-0000-0000-0000-000000000031',
  'first-account@example.test',
  '88000000-0000-0000-0000-000000000011',
  interval '14 days'
);

select ok(length((select token from issued_invite)) = 64, 'one-time secret is returned once');
select ok(
  not exists (
    select 1 from public.person_account_invitations
    where encode(token_hash, 'hex') = (select token from issued_invite)
  ),
  'usable invitation secret is not stored in plaintext'
);
select is(
  octet_length((select token_hash from public.person_account_invitations
    where id = (select invitation_id from issued_invite))),
  32, 'SHA-256 token hash is stored'
);

select throws_ok(
  $$select public.consume_person_account_invitation(
      repeat('0', 64), '88000000-0000-0000-0000-000000000012'
    )$$,
  'P0001', 'PERSON_INVITE_INVALID', 'changed token is rejected'
);
select throws_ok(
  $$select public.consume_person_account_invitation(
      (select token from issued_invite), '88000000-0000-0000-0000-000000000013'
    )$$,
  'P0001', 'PERSON_INVITE_WRONG_ACCOUNT', 'wrong logged-in account is rejected'
);
select lives_ok(
  $$select public.consume_person_account_invitation(
      (select token from issued_invite), '88000000-0000-0000-0000-000000000012'
    )$$,
  'intended account consumes invitation'
);
select is(
  (select status from public.person_account_invitations
   where id = (select invitation_id from issued_invite)),
  'used', 'invitation is atomically marked used'
);
select is(
  (select count(*) from public.person_accounts
   where person_id = '88000000-0000-0000-0000-000000000021'
     and profile_id = '88000000-0000-0000-0000-000000000012'
     and status = 'active'),
  1::bigint, 'claim creates exactly one active person account'
);
select throws_ok(
  $$select public.consume_person_account_invitation(
      (select token from issued_invite), '88000000-0000-0000-0000-000000000012'
    )$$,
  'P0001', 'PERSON_INVITE_ALREADY_USED', 'used invitation cannot be replayed'
);

create temporary table expired_invite as
select * from public.create_person_account_invitation(
  '88000000-0000-0000-0000-000000000032',
  'second-account@example.test',
  '88000000-0000-0000-0000-000000000011',
  interval '1 second'
);
update public.person_account_invitations set expires_at = timezone('utc', now()) - interval '1 second'
where id = (select invitation_id from expired_invite);
select throws_ok(
  $$select public.consume_person_account_invitation(
      (select token from expired_invite), '88000000-0000-0000-0000-000000000014'
    )$$,
  'P0001', 'PERSON_INVITE_EXPIRED', 'expired invitation is rejected'
);
select is(
  (select count(*) from public.person_accounts
   where person_id = '88000000-0000-0000-0000-000000000022'),
  0::bigint, 'expired invitation releases no history'
);

select throws_ok(
  $$select public.link_person_account(
      '88000000-0000-0000-0000-000000000022',
      '88000000-0000-0000-0000-000000000012',
      'admin_review',
      '88000000-0000-0000-0000-000000000011'
    )$$,
  '23505', null, 'same account cannot represent a second person'
);
select throws_ok(
  $$select public.link_person_account(
      '88000000-0000-0000-0000-000000000021',
      '88000000-0000-0000-0000-000000000014',
      'admin_review',
      '88000000-0000-0000-0000-000000000011'
    )$$,
  '23505', null, 'same person cannot receive a second active account'
);

-- A same-name placeholder must remain untouched during ordinary onboarding.
insert into public.club_trainers(id, club_id, display_name, invitation_status)
values ('88000000-0000-0000-0000-000000000041',
  '88000000-0000-0000-0000-000000000001', 'Duplicate Coach', 'placeholder');
insert into auth.users(id, email, raw_user_meta_data) values (
  '88000000-0000-0000-0000-000000000042',
  'duplicate-coach@example.test',
  jsonb_build_object(
    'full_name', 'Duplicate Coach',
    'club_onboarding', jsonb_build_object(
      'club_mode', 'existing',
      'club_id', '88000000-0000-0000-0000-000000000001',
      'team_mode', 'existing',
      'team_id', '88000000-0000-0000-0000-000000000002',
      'team_role', 'coach'
    )
  )
);
select is(
  (select profile_id from public.club_trainers
   where id = '88000000-0000-0000-0000-000000000041'),
  null, 'ordinary onboarding never claims same-name placeholder'
);
select is(
  (select count(*) from public.club_trainers
   where club_id = '88000000-0000-0000-0000-000000000001'
     and profile_id = '88000000-0000-0000-0000-000000000042'),
  1::bigint, 'same-name registering account gets a separate compatibility row'
);
select is(
  (select status from public.club_memberships
   where club_id = '88000000-0000-0000-0000-000000000001'
     and profile_id = '88000000-0000-0000-0000-000000000042'),
  'pending', 'joining an existing club cannot self-promote to active trainer'
);
select is(
  (select status from public.club_role_assignments role
   join public.club_trainers trainer on trainer.club_person_id = role.club_person_id
   where trainer.profile_id = '88000000-0000-0000-0000-000000000042'),
  'suspended', 'new existing-club role stays inactive pending approval'
);
select is(
  (select count(*) from public.person_accounts
   where profile_id = '88000000-0000-0000-0000-000000000042'),
  1::bigint, 'new person onboarding links only its newly created identity'
);
select is(
  (select count(*) from public.people where first_name = 'Duplicate' and last_name = 'Coach'),
  1::bigint, 'ordinary onboarding creates one new person, never merges by name'
);

select ok(
  has_function_privilege('authenticated',
    'public.consume_person_account_invitation(text,uuid)', 'EXECUTE') = false,
  'claim RPC is server-only'
);
select ok(
  has_function_privilege('authenticated',
    'public.review_person_claim(uuid,text,uuid)', 'EXECUTE') = false,
  'review RPC is server-only'
);

select * from finish();
rollback;
