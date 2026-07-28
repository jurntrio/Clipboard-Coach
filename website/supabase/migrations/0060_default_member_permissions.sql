-- Sensible operational defaults. Team scope still limits all content to the
-- member's assigned/selected club teams.

create or replace function public.apply_default_club_member_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_member_permissions
    (club_id, profile_id, permission_key, enabled, updated_at)
  select new.club_id, new.profile_id, permission_key, true, timezone('utc'::text, now())
  from unnest(
    case when new.role = 'trainer' then array[
      'video.view', 'games.tag_link.create', 'games.tag', 'training.view',
      'intradesk.view', 'clips.share'
    ]::text[]
    else array['intradesk.view']::text[]
    end
  ) as permission_key
  on conflict (club_id, profile_id, permission_key)
  do update set enabled = true, updated_at = excluded.updated_at;
  return new;
end;
$$;

drop trigger if exists club_membership_default_permissions on public.club_memberships;
create trigger club_membership_default_permissions
after insert or update of role, status on public.club_memberships
for each row when (new.status = 'active')
execute function public.apply_default_club_member_permissions();

insert into public.club_member_permissions
  (club_id, profile_id, permission_key, enabled, updated_at)
select membership.club_id, membership.profile_id, permission.permission_key, true, timezone('utc'::text, now())
from public.club_memberships membership
cross join (values
  ('video.view'),
  ('games.tag_link.create'),
  ('games.tag'),
  ('training.view'),
  ('intradesk.view'),
  ('clips.share')
) as permission(permission_key)
where membership.status = 'active'
  and membership.role = 'trainer'
on conflict (club_id, profile_id, permission_key)
do update set enabled = true, updated_at = excluded.updated_at;

insert into public.club_member_permissions
  (club_id, profile_id, permission_key, enabled, updated_at)
select membership.club_id, membership.profile_id, 'intradesk.view', true, timezone('utc'::text, now())
from public.club_memberships membership
where membership.status = 'active'
on conflict (club_id, profile_id, permission_key)
do update set enabled = true, updated_at = excluded.updated_at;

notify pgrst, 'reload schema';
