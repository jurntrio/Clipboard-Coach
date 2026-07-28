-- Cap a tag's effective clip length (video span + any attached drawing
-- freeze-frames, since drawings pause playback and add to watch time) at 3
-- minutes, so a single tag can't span most of a match. Enforced in the
-- database so it applies regardless of entry point (create_profiled_tag
-- RPC, manual timeline edits, drawing duration changes).
create or replace function public.enforce_tag_max_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_seconds constant numeric := 180;
  drawing_seconds numeric;
  total_seconds numeric;
begin
  select coalesce(sum(greatest(1, (d->>'duration_seconds')::numeric)), 0)
    into drawing_seconds
    from jsonb_array_elements(coalesce(new.drawings, '[]'::jsonb)) d;
  total_seconds := greatest(0, new.end_time - new.start_time) + drawing_seconds;
  if total_seconds > max_seconds then
    raise exception 'CLIP_TOO_LONG';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_tag_max_duration_before_change on public.tags;
create trigger enforce_tag_max_duration_before_change
  before insert or update of start_time, end_time, drawings on public.tags
  for each row execute function public.enforce_tag_max_duration();

notify pgrst, 'reload schema';
