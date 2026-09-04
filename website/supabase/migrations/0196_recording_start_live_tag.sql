-- A recording can consist of several consecutive files. Each Start Opname live tag
-- marks the real-world start of the corresponding uploaded video block.
insert into public.club_live_tag_templates (
  club_id, name, live_start_offset_seconds, live_end_offset_seconds, display_order
)
select club.id, 'Start Opname', 0, 0, -1
from public.clubs club
on conflict (club_id, name) do update
set live_start_offset_seconds = excluded.live_start_offset_seconds,
    live_end_offset_seconds = excluded.live_end_offset_seconds,
    display_order = excluded.display_order,
    updated_at = timezone('utc', now());

update public.matches match
set live_tag_names = array_prepend('Start Opname', match.live_tag_names)
where match.status <> 'finished'
  and not ('Start Opname' = any(match.live_tag_names));

notify pgrst, 'reload schema';
