-- Link a live-tagged moment to the editable tag it gets turned into automatically, so it shows
-- up (with adjustable start/end time) in the normal tagged-clips list instead of only the
-- separate live-tag review checklist.
alter table public.live_match_tags
  add column if not exists tag_id uuid references public.tags(id) on delete set null;

create index if not exists idx_live_match_tags_tag_id on public.live_match_tags(tag_id);

notify pgrst, 'reload schema';
