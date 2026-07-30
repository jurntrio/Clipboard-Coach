begin;
create extension if not exists pgtap;
select plan(28);

select has_table('public', 'person_backfill_runs', 'backfill run log exists');
select has_table('public', 'person_backfill_actions', 'backfill provenance exists');
select has_function('public', 'preview_club_people_backfill', array[]::text[], 'preview function exists');
select has_function('public', 'execute_club_people_backfill', array['text'], 'execute function exists');
select has_function('public', 'rollback_club_people_backfill', array['uuid'], 'safe rollback function exists');

insert into public.clubs(id, name, normalized_name)
values ('90000000-0000-0000-0000-000000000001', 'Backfill Test Club', 'backfill test club');
insert into public.club_teams(id, club_id, name)
values ('90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000001', 'KMT B');
insert into public.teams(id, name, club_team_id)
values ('90000000-0000-0000-0000-000000000003', 'KMT B',
  '90000000-0000-0000-0000-000000000002');
insert into public.club_seasons(id, club_id, name, starts_on, ends_on, is_active)
values ('90000000-0000-0000-0000-000000000004',
  '90000000-0000-0000-0000-000000000001', '2026-2027', '2026-07-01', '2027-06-30', true);

insert into public.club_players(
  id, club_id, first_name, last_name, date_of_birth
) values
  ('90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000001',
    'Dylan', 'Bauwens', '2009-01-01'),
  ('90000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000001',
    'Alex', 'Candidate', '2010-02-02'),
  ('90000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000001',
    'Sam', 'Ambiguous', null);

insert into public.player_team_memberships(
  id, club_player_id, team_id, season_id, membership_type
) values
  ('90000000-0000-0000-0000-000000000021', '90000000-0000-0000-0000-000000000011',
    '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000004', 'primary'),
  ('90000000-0000-0000-0000-000000000022', '90000000-0000-0000-0000-000000000012',
    '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000004', 'secondary'),
  ('90000000-0000-0000-0000-000000000023', '90000000-0000-0000-0000-000000000013',
    '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000004', 'secondary');

insert into public.players(id, team_id, first_name, last_name, membership_id)
values ('90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000003', 'Dylan', 'Bauwens',
  '90000000-0000-0000-0000-000000000021');

insert into public.people(id, first_name, last_name, date_of_birth) values
  ('90000000-0000-0000-0000-000000000041', 'Alex', 'Candidate', '2010-02-02'),
  ('90000000-0000-0000-0000-000000000042', 'Sam', 'Ambiguous', null),
  ('90000000-0000-0000-0000-000000000043', 'Sam', 'Ambiguous', null);
insert into public.club_people(id, club_id, person_id) values
  ('90000000-0000-0000-0000-000000000051', '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000041'),
  ('90000000-0000-0000-0000-000000000052', '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000042'),
  ('90000000-0000-0000-0000-000000000053', '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000043');

select is(
  (select classification from public.preview_club_people_backfill()
   where club_player_id = '90000000-0000-0000-0000-000000000011'),
  'create_new_person', 'Dylan proposes a new person when no reliable candidate exists'
);
select is(
  (select classification from public.preview_club_people_backfill()
   where club_player_id = '90000000-0000-0000-0000-000000000012'),
  'review_existing_candidate', 'exact name and DOB candidate still requires review'
);
select is(
  (select classification from public.preview_club_people_backfill()
   where club_player_id = '90000000-0000-0000-0000-000000000013'),
  'multiple_candidates', 'multiple name-only candidates are ambiguous'
);
select is(
  (select candidate_count from public.preview_club_people_backfill()
   where club_player_id = '90000000-0000-0000-0000-000000000013'),
  2, 'all ambiguous candidates are reported'
);
select ok(
  (select missing_identifiers from public.preview_club_people_backfill()
   where club_player_id = '90000000-0000-0000-0000-000000000013'),
  'missing date of birth is reported'
);
select throws_ok(
  $$select public.execute_club_people_backfill(public.club_people_backfill_preview_hash())$$,
  'P0001', 'PERSON_BACKFILL_REVIEW_REQUIRED',
  'execution refuses unresolved candidate reviews'
);

-- Simulate separately approved reviews. This is explicit ID linking, never matching by name.
update public.club_players set club_person_id = '90000000-0000-0000-0000-000000000051'
where id = '90000000-0000-0000-0000-000000000012';
update public.club_players set club_person_id = '90000000-0000-0000-0000-000000000052'
where id = '90000000-0000-0000-0000-000000000013';

select is(
  (select count(*) from public.preview_club_people_backfill()
   where certainty = 'requires_review'),
  0::bigint, 'approved explicit links clear the review queue'
);
select throws_ok(
  $$select public.execute_club_people_backfill('stale-preview')$$,
  'P0001', 'PERSON_BACKFILL_PREVIEW_CHANGED',
  'stale reviewed preview cannot execute'
);

create temporary table backfill_before as
select
  (select count(*) from public.people) people_count,
  (select count(*) from public.player_team_memberships) membership_count,
  (select count(*) from public.club_seasons) season_count,
  (select membership_id from public.players
   where id = '90000000-0000-0000-0000-000000000031') operational_membership_id;

select lives_ok(
  $$select public.execute_club_people_backfill(public.club_people_backfill_preview_hash())$$,
  'reviewed backfill executes'
);
select ok(
  (select club_person_id is not null from public.club_players
   where id = '90000000-0000-0000-0000-000000000011'),
  'Dylan club_player receives one club_person link'
);
select is(
  (select count(*) from public.people),
  (select people_count + 1 from backfill_before),
  'only Dylan new person is created'
);
select is(
  (select count(*) from public.club_players
   where id = '90000000-0000-0000-0000-000000000011'),
  1::bigint, 'existing Dylan club_player is not recreated'
);
select is(
  (select count(*) from public.player_team_memberships),
  (select membership_count from backfill_before),
  'membership count is unchanged'
);
select is(
  (select count(*) from public.club_seasons),
  (select season_count from backfill_before),
  'season history is unchanged'
);
select is(
  (select membership_id from public.players
   where id = '90000000-0000-0000-0000-000000000031'),
  (select operational_membership_id from backfill_before),
  'operational player membership link is unchanged'
);
select is(
  (select count(*) from public.person_backfill_actions
   where club_player_id = '90000000-0000-0000-0000-000000000011'
     and action = 'created_person_and_linked'),
  1::bigint, 'source-to-person provenance is recorded once'
);
select is(
  (select count(*) from public.preview_club_people_backfill()
   where classification <> 'already_linked'),
  0::bigint, 'all reviewed fixtures are linked after execution'
);

select lives_ok(
  $$select public.execute_club_people_backfill(public.club_people_backfill_preview_hash())$$,
  'second execution is safe'
);
select is(
  (select count(*) from public.people),
  (select people_count + 1 from backfill_before),
  'second execution creates no duplicate people'
);
select is(
  (select count(*) from public.club_people
   where person_id = (
     select cp.person_id from public.club_people cp
     join public.club_players player on player.club_person_id = cp.id
     where player.id = '90000000-0000-0000-0000-000000000011'
   )),
  1::bigint, 'second execution creates no duplicate club person'
);
select is(
  (select membership_count from backfill_before),
  (select count(*) from public.player_team_memberships),
  'second execution still preserves memberships'
);
select is(
  (public.club_people_backfill_summary()->>'orphaned_membership_references_before')::integer,
  0, 'summary reports no orphaned membership references'
);
select is(
  (public.club_people_backfill_summary()->>'orphaned_operational_player_references_before')::integer,
  0, 'summary reports no orphaned operational-player references'
);

select * from finish();
rollback;
