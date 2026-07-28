-- A goal tag shouldn't require picking a scorer up front - sometimes you just want to mark that
-- a goal happened and fill in who scored later (or never). Only attach a stat event when a
-- scorer was actually provided.
create or replace function public.create_profiled_tag(
  target_video_id uuid,
  target_match_id uuid,
  tag_name text,
  tag_moment numeric,
  tag_color text,
  selected_player_ids uuid[] default '{}',
  tag_event_type text default null,
  scorer_id uuid default null,
  assist_id uuid default null
) returns public.tags
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid;
  team_id_value uuid;
  video_duration numeric;
  profile_start numeric := -5;
  profile_end numeric := 5;
  created_tag public.tags;
  created_clip_id uuid;
  metadata jsonb := '{}'::jsonb;
begin
  select v.coach_id, v.team_id, v.duration into owner_id, team_id_value, video_duration
  from public.videos v where v.id = target_video_id;
  if owner_id is null then raise exception 'VIDEO_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.match_videos
    where match_id = target_match_id and video_id = target_video_id
  ) then raise exception 'VIDEO_MATCH_MISMATCH'; end if;

  select s.start_offset_seconds, s.end_offset_seconds
    into profile_start, profile_end
  from public.standard_tags s
  where s.coach_id = auth.uid() and lower(s.name) = lower(trim(tag_name))
  limit 1;

  if lower(trim(tag_name)) = 'goal' then
    if tag_event_type not in ('goal_for', 'goal_against') then raise exception 'GOAL_TYPE_REQUIRED'; end if;
    if scorer_id is not null and not (scorer_id = any(selected_player_ids)) then raise exception 'INVALID_SCORER'; end if;
    if assist_id is not null and not (assist_id = any(selected_player_ids)) then raise exception 'INVALID_ASSIST'; end if;
    if assist_id is not null and assist_id = scorer_id then raise exception 'SCORER_CANNOT_ASSIST_SELF'; end if;
    metadata := jsonb_strip_nulls(jsonb_build_object('scorer_id', scorer_id, 'assist_id', assist_id));
  end if;

  insert into public.tags (
    video_id, name, occurred_at_seconds, start_time, end_time, color,
    player_ids, event_type, event_metadata
  ) values (
    target_video_id, trim(tag_name), tag_moment,
    greatest(0, tag_moment + profile_start),
    least(coalesce(video_duration, tag_moment + profile_end), greatest(0, tag_moment + profile_end)),
    tag_color, selected_player_ids, tag_event_type, metadata
  ) returning * into created_tag;

  insert into public.clips (
    coach_id, video_id, team_id, name, audience_type, audience_player_ids, render_status
  ) values (
    auth.uid(), target_video_id, team_id_value, trim(tag_name), 'full_team', '{}', 'metadata_only'
  ) returning id into created_clip_id;

  insert into public.clip_segments (clip_id, tag_id, sequence_order)
  values (created_clip_id, created_tag.id, 0);

  if tag_event_type = 'goal_for' and scorer_id is not null then
    insert into public.player_stat_events
      (coach_id, match_id, tag_id, player_id, stat_type, season, team_id)
    values
      (auth.uid(), target_match_id, created_tag.id, scorer_id, 'goal',
       extract(year from coalesce((select match_date from public.matches where id = target_match_id), current_date))::text,
       team_id_value);
    if assist_id is not null then
      insert into public.player_stat_events
        (coach_id, match_id, tag_id, player_id, stat_type, season, team_id)
      values
        (auth.uid(), target_match_id, created_tag.id, assist_id, 'assist',
         extract(year from coalesce((select match_date from public.matches where id = target_match_id), current_date))::text,
         team_id_value);
    end if;
  end if;
  return created_tag;
end;
$$;

notify pgrst, 'reload schema';
