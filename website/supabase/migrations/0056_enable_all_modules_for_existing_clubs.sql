-- Preserve the current product experience for every club that already exists.
-- Platform admins can narrow these entitlements afterwards from Admin > Clubs.
insert into public.club_module_entitlements (
  club_id, module_key, enabled, updated_at
)
select club.id, module.module_key, true, now()
from public.clubs club
cross join (values
  ('teams'), ('video_viewer'), ('matches'), ('clips'), ('training'),
  ('intradesk'), ('attendance'), ('club_management')
) as module(module_key)
on conflict (club_id, module_key) do update
set enabled = true, updated_at = excluded.updated_at;
