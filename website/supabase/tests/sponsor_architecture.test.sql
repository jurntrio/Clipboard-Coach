begin;
create extension if not exists pgtap;
select plan(16);

select has_table('public','sponsors','central sponsors table exists');
select has_table('public','sponsor_scopes','sponsor scopes table exists');
select has_table('public','sponsor_team_relations','team sponsor relations table exists');
select has_table('public','sponsor_match_configurations','match sponsoring table exists');

insert into public.clubs(id,name,normalized_name) values
 ('51000000-0000-0000-0000-000000000001','Sponsor Test Club','sponsor test club');
insert into auth.users(id,email) values
 ('51000000-0000-0000-0000-000000000010','sponsor-test@example.test');
insert into public.club_seasons(id,club_id,name,starts_on,ends_on,is_active,status) values
 ('51000000-0000-0000-0000-000000000020','51000000-0000-0000-0000-000000000001','2027-2028','2027-07-01','2028-06-30',true,'ACTIVE'),
 ('51000000-0000-0000-0000-000000000021','51000000-0000-0000-0000-000000000001','2028-2029','2028-07-01','2029-06-30',false,'PREPARATION');
insert into public.club_teams(id,club_id,season_id,name) values
 ('51000000-0000-0000-0000-000000000030','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000020','IP U12'),
 ('51000000-0000-0000-0000-000000000031','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000021','IP U13');
insert into public.matches(id,coach_id,club_id,club_team_id,season_id,team_a_name,team_b_name,match_date,start_time,is_home_match) values
 ('51000000-0000-0000-0000-000000000040','51000000-0000-0000-0000-000000000010','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000030','51000000-0000-0000-0000-000000000020','Sponsor Test Club','Thuis Tegenstander','2027-09-12','15:00',true),
 ('51000000-0000-0000-0000-000000000041','51000000-0000-0000-0000-000000000010','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000030','51000000-0000-0000-0000-000000000020','Uit Tegenstander','Sponsor Test Club','2027-09-19','15:00',false);
insert into public.sponsors(id,club_id,company_name,active) values
 ('51000000-0000-0000-0000-000000000050','51000000-0000-0000-0000-000000000001','Bouwbedrijf Janssens',true);

select throws_ok($$insert into public.sponsors(club_id,company_name) values
 ('51000000-0000-0000-0000-000000000001',' bouwbedrijf janssens ')$$,'23505',null,'same sponsor name cannot be duplicated');

insert into public.sponsor_scopes(id,club_id,name,is_clubwide) values
 ('51000000-0000-0000-0000-000000000060','51000000-0000-0000-0000-000000000001','Jeugd',false),
 ('51000000-0000-0000-0000-000000000061','51000000-0000-0000-0000-000000000001','Clubbreed',true);
insert into public.sponsor_scope_teams(scope_id,club_id,season_id,club_team_id)
 values('51000000-0000-0000-0000-000000000060','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000020','51000000-0000-0000-0000-000000000030');
select throws_ok($$insert into public.sponsor_scope_teams(scope_id,club_id,season_id,club_team_id) values
 ('51000000-0000-0000-0000-000000000061','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000020','51000000-0000-0000-0000-000000000030')$$,
 'P0001','CLUBWIDE_SCOPE_HAS_NO_TEAM_MEMBERS','clubwide scope never needs team members');
select throws_ok($$insert into public.sponsor_scope_teams(scope_id,club_id,season_id,club_team_id) values
 ('51000000-0000-0000-0000-000000000060','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000020','51000000-0000-0000-0000-000000000031')$$,
 'P0001','SPONSOR_SCOPE_TEAM_SEASON_MISMATCH','scope membership cannot cross seasons');

insert into public.sponsor_assignments(id,sponsor_id,club_id,season_id,sponsor_level,status) values
 ('51000000-0000-0000-0000-000000000070','51000000-0000-0000-0000-000000000050','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000020','main_sponsor','active');
insert into public.sponsor_assignment_scopes(assignment_id,scope_id) values
 ('51000000-0000-0000-0000-000000000070','51000000-0000-0000-0000-000000000060'),
 ('51000000-0000-0000-0000-000000000070','51000000-0000-0000-0000-000000000061');
select is((select count(*)::int from public.sponsor_assignment_scopes where assignment_id='51000000-0000-0000-0000-000000000070'),2,'one assignment supports multiple scopes');

insert into public.sponsor_team_relations(club_id,season_id,sponsor_id,assignment_id,club_team_id,relation_type,accent_level,priority_weight) values
 ('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000020','51000000-0000-0000-0000-000000000050','51000000-0000-0000-0000-000000000070','51000000-0000-0000-0000-000000000030','team_accent','prominent',3);
select is((select priority_weight::int from public.sponsor_team_relations limit 1),3,'prominent team accent receives weight 3');
select throws_ok($$insert into public.sponsor_team_relations(club_id,season_id,sponsor_id,club_team_id,relation_type,priority_weight) values
 ('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000020','51000000-0000-0000-0000-000000000050','51000000-0000-0000-0000-000000000031','specific_sponsor',1)$$,
 'P0001','SPONSOR_TEAM_SEASON_MISMATCH','team sponsor cannot cross seasons');

select throws_ok($$insert into public.sponsor_match_configurations(club_id,match_id) values
 ('51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000041')$$,
 'P0001','SPONSORING_ONLY_ALLOWED_FOR_HOME_MATCHES','away matches reject commercial configuration');
insert into public.sponsor_match_configurations(id,club_id,match_id) values
 ('51000000-0000-0000-0000-000000000080','51000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000040');
insert into public.sponsor_match_partners(configuration_id,sponsor_id,partner_role,priority_weight) values
 ('51000000-0000-0000-0000-000000000080','51000000-0000-0000-0000-000000000050','match_sponsor',100),
 ('51000000-0000-0000-0000-000000000080','51000000-0000-0000-0000-000000000050','match_ball_donor',90);
select is(jsonb_array_length(public.sponsor_context_for_match('51000000-0000-0000-0000-000000000040')->'sponsors'),1,'same sponsor is deduplicated across all reasons');
select is(public.sponsor_context_for_match('51000000-0000-0000-0000-000000000040')->'sponsors'->0->>'priorityWeight','100','highest match priority wins');
select cmp_ok(jsonb_array_length(public.sponsor_context_for_match('51000000-0000-0000-0000-000000000040')->'sponsors'->0->'reasons'),'>=',4,'deduplicated sponsor retains its relevance reasons');
select is(jsonb_array_length(public.sponsor_context_for_match('51000000-0000-0000-0000-000000000041')->'sponsors'),0,'away match context is empty');
select ok(not has_function_privilege('authenticated','public.sponsor_context_for_match(uuid)','EXECUTE'),'context RPC is server-only');

select * from finish();
rollback;
