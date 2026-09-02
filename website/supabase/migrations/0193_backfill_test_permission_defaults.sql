-- 0192 added tests.view/tests.manage to the code-side role defaults, but clubs that
-- already had configured club_role_permission_defaults rows for a role never fall back
-- to those code defaults (see loadClubAccess), so their trainers/coordinators/medical
-- staff lost access to the new Testen tab. Backfill the same way 0191 did.

insert into public.club_role_permission_defaults
  (club_id, function_role, permission_key, enabled, updated_at)
select club.id, role.function_role, perm.permission_key, true, timezone('utc', now())
from public.clubs club
cross join (values
  ('trainer'), ('assistant_trainer'), ('physical_coach'), ('performance_coach'),
  ('doctor'), ('physiotherapist'),
  ('youth_coordinator'), ('head_youth_development'), ('technical_director')
) as role(function_role)
cross join (values ('tests.view'), ('tests.manage')) as perm(permission_key)
where exists (
  select 1 from public.club_role_permission_defaults configured
  where configured.club_id = club.id and configured.function_role = role.function_role
)
on conflict (club_id, function_role, permission_key)
do nothing;

notify pgrst, 'reload schema';
