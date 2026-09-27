-- Keep the information entered on the public Goal button with the live tag so
-- the materialized video tag and the match dossier can refer to one event.
alter table public.live_match_tags
  add column if not exists event_type text,
  add column if not exists score_home smallint,
  add column if not exists score_away smallint,
  add column if not exists scorer_id uuid references public.players(id) on delete set null;

alter table public.live_match_tags
  drop constraint if exists live_match_tags_event_type_check,
  add constraint live_match_tags_event_type_check
    check (event_type is null or event_type in ('goal_for', 'goal_against')),
  drop constraint if exists live_match_tags_score_home_check,
  add constraint live_match_tags_score_home_check
    check (score_home is null or score_home between 0 and 30),
  drop constraint if exists live_match_tags_score_away_check,
  add constraint live_match_tags_score_away_check
    check (score_away is null or score_away between 0 and 30);

-- Materialized live tags used to keep their old video time when the coach
-- corrected the recording start. Move those tags by the same delta. For
-- example, changing 15:00 to 14:58 moves a 15:20 live tag from 20:00 to 22:00.
create or replace function public.shift_materialized_live_tags_with_match_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_start timestamp;
  new_start timestamp;
  delta_seconds numeric;
begin
  if old.match_date is null or new.match_date is null then return new; end if;
  if coalesce(old.recording_start_time, old.start_time) is null
    or coalesce(new.recording_start_time, new.start_time) is null then return new; end if;

  old_start := old.match_date::timestamp + coalesce(old.recording_start_time, old.start_time);
  new_start := new.match_date::timestamp + coalesce(new.recording_start_time, new.start_time);
  delta_seconds := extract(epoch from (old_start - new_start));
  if abs(delta_seconds) < 0.001 then return new; end if;

  update public.tags as tag
  set occurred_at_seconds = greatest(0, tag.occurred_at_seconds + delta_seconds),
      start_time = greatest(0, tag.start_time + delta_seconds),
      end_time = greatest(greatest(0, tag.start_time + delta_seconds), tag.end_time + delta_seconds)
  where tag.id in (
    select live_tag.tag_id
    from public.live_match_tags as live_tag
    where live_tag.match_id = new.id and live_tag.tag_id is not null
  );
  return new;
end;
$$;

revoke all on function public.shift_materialized_live_tags_with_match_timeline() from public, anon, authenticated;

drop trigger if exists shift_materialized_live_tags_with_match_timeline_trigger on public.matches;
create trigger shift_materialized_live_tags_with_match_timeline_trigger
after update of match_date, start_time, recording_start_time on public.matches
for each row execute function public.shift_materialized_live_tags_with_match_timeline();

notify pgrst, 'reload schema';
