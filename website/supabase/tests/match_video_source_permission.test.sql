begin;
select plan(3);

select is(
  (select count(*)::integer from public.clubs club cross join (values ('trainer'), ('assistant_trainer'), ('video_analyst')) role(function_role)
   where exists (
     select 1 from public.club_role_permission_defaults configured
     where configured.club_id = club.id and configured.function_role = role.function_role
   ) and not exists (
     select 1 from public.club_role_permission_defaults defaults
     where defaults.club_id = club.id and defaults.function_role = role.function_role
       and defaults.permission_key = 'games.video_sources.manage' and defaults.enabled
   )),
  0,
  'trainers, assistant trainers and video analysts manage match video sources by default'
);

select lives_ok(
  $$insert into public.club_role_permission_defaults (club_id, function_role, permission_key, enabled)
    select id, 'custom', 'games.video_sources.manage', true from public.clubs order by created_at limit 1$$,
  'club role profiles accept the match video source permission'
);

select lives_ok(
  $$insert into public.club_member_permissions (club_id, profile_id, permission_key, enabled)
    select membership.club_id, membership.profile_id, 'games.video_sources.manage', true
    from public.club_memberships membership order by membership.created_at limit 1
    on conflict (club_id, profile_id, permission_key) do update set enabled = excluded.enabled$$,
  'individual member profiles accept the match video source permission'
);

select * from finish();
rollback;
