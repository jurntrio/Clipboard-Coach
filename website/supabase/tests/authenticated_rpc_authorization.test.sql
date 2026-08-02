begin;
create extension if not exists pgtap;
select plan(13);

select is(
  (
    select count(*)::integer
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.prorettype <> 'trigger'::regtype
      and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      and not ('search_path=public' = any(coalesce(procedure.proconfig, array[]::text[])))
  ),
  0,
  'every authenticated SECURITY DEFINER RPC has a fixed public search_path'
);

select ok(not has_function_privilege('authenticated', 'public.link_person_account(uuid,uuid,text,uuid)', 'EXECUTE'), 'account linking remains service-role-only');
select ok(not has_function_privilege('authenticated', 'public.revoke_person_account(uuid,uuid,text)', 'EXECUTE'), 'account unlinking remains service-role-only');
select ok(not has_function_privilege('authenticated', 'public.merge_people(uuid,uuid,uuid,text)', 'EXECUTE'), 'person merging remains service-role-only');
select ok(not has_function_privilege('authenticated', 'public.execute_club_people_backfill(text)', 'EXECUTE'), 'people backfill remains service-role-only');
select ok(not has_function_privilege('authenticated', 'public.club_team_staff_profile_ids(uuid,uuid)', 'EXECUTE'), 'mailbox staff resolution remains service-role-only');
select ok(not has_function_privilege('authenticated', 'public.club_team_contact_profile_ids(uuid,uuid)', 'EXECUTE'), 'mailbox contact resolution remains service-role-only');
select ok(not has_function_privilege('authenticated', 'public.complete_club_team_onboarding(uuid,text,text,jsonb)', 'EXECUTE'), 'onboarding command remains service-role-only');

insert into public.clubs(id, name, normalized_name)
values ('a1050000-0000-0000-0000-000000000001', 'RPC Boundary Club', 'rpc boundary club');
insert into auth.users(id, email, raw_user_meta_data) values
  ('a1050000-0000-0000-0000-000000000010', 'pending-admin@example.test', '{"full_name":"Pending Admin"}'),
  ('a1050000-0000-0000-0000-000000000011', 'outsider@example.test', '{"full_name":"Outsider"}');
insert into public.club_memberships(club_id, profile_id, role, status, function_role, team_scope)
values ('a1050000-0000-0000-0000-000000000001', 'a1050000-0000-0000-0000-000000000010', 'club_admin', 'pending', 'club_admin', 'all');
insert into public.matches(id, coach_id, club_id, team_a_name, team_b_name)
values ('a1050000-0000-0000-0000-000000000020', 'a1050000-0000-0000-0000-000000000010', 'a1050000-0000-0000-0000-000000000001', 'A', 'B');

select ok(not public.can_access_club_match('a1050000-0000-0000-0000-000000000020', 'a1050000-0000-0000-0000-000000000010'), 'pending member cannot read club match data');
select ok(not public.is_club_admin_for_match('a1050000-0000-0000-0000-000000000020', 'a1050000-0000-0000-0000-000000000010'), 'pending club admin cannot mutate a club match');
select ok(not public.can_view_match_report('a1050000-0000-0000-0000-000000000020', 'a1050000-0000-0000-0000-000000000010'), 'pending club admin cannot read match reports');

update public.club_memberships set status = 'active'
where club_id = 'a1050000-0000-0000-0000-000000000001'
  and profile_id = 'a1050000-0000-0000-0000-000000000010';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a1050000-0000-0000-0000-000000000011', 'role', 'authenticated')::text, true);
select ok(not public.can_access_club_match('a1050000-0000-0000-0000-000000000020', 'a1050000-0000-0000-0000-000000000010'), 'authenticated caller cannot substitute another member identity in match access helper');
select ok(not public.is_club_admin_for_match('a1050000-0000-0000-0000-000000000020', 'a1050000-0000-0000-0000-000000000010'), 'authenticated caller cannot probe another member admin status');
reset role;

select * from finish();
rollback;

