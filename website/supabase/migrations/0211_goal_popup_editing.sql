-- Explicitly correct a goal link under the same match lock, keeping its archived clip.
create or replace function public.link_match_goal_media(
  p_match_id uuid, p_tag_id uuid, p_goal jsonb, p_user_id uuid,
  p_create_clip boolean default false, p_start numeric default null, p_end numeric default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.matches; t public.tags; existing public.match_goal_media;
  previous_tag uuid;
  events jsonb; chosen jsonb; goal_id text; v_clip_id uuid; segment_id uuid;
begin
  -- Serialize with report saves and other goal links, including the first dossier insert.
  select * into m from public.matches where id = p_match_id for update;
  if m.id is null then raise exception 'MATCH_NOT_FOUND'; end if;
  select * into t from public.tags where id = p_tag_id;
  if t.id is null or not exists (select 1 from public.match_videos where match_id = m.id and video_id = t.video_id)
    then raise exception 'TAG_MATCH_MISMATCH'; end if;
  insert into public.match_dossiers(match_id) values (m.id) on conflict (match_id) do nothing;
  select coalesce(goal_events, '[]'::jsonb) into events from public.match_dossiers where match_id = m.id for update;
  if p_goal ? '_relink_media_id' then
    select * into existing from public.match_goal_media where id::text = p_goal->>'_relink_media_id' and match_id = m.id;
    if existing.id is null or existing.goal_id <> p_goal->>'_previous_goal_id' then raise exception 'STALE_GOAL_MEDIA'; end if;
    if exists(select 1 from public.match_goal_media where tag_id = t.id and id <> existing.id) then raise exception 'TAG_ALREADY_LINKED'; end if;
    previous_tag := existing.tag_id;
  else
    select * into existing from public.match_goal_media where tag_id = t.id;
  end if;
  select value into chosen from jsonb_array_elements(events)
    where value->>'scoreAfter' = p_goal->>'scoreAfter' limit 1;
  if p_goal ? '_edit_goal' then
    select value into chosen from jsonb_array_elements(events) where value->>'id' = p_goal->>'id';
    if chosen is null then raise exception 'GOAL_NOT_FOUND'; end if;
    if exists(select 1 from jsonb_array_elements(events) g where g->>'id' <> chosen->>'id' and g->>'scoreAfter' = p_goal->>'scoreAfter') then raise exception 'GOAL_SCORE_CONFLICT'; end if;
    chosen := chosen || p_goal;
  end if;
  if chosen is null then
    select value into chosen from jsonb_array_elements(events) where value->>'id' = p_goal->>'id' limit 1;
    if chosen is not null and coalesce(chosen->>'scoreAfter','') <> '' then raise exception 'GOAL_SCORE_CONFLICT'; end if;
    chosen := coalesce(chosen, '{}'::jsonb) || p_goal;
  end if;
  if coalesce(chosen->>'scorerType','') = '' and coalesce(p_goal->>'scorerPlayerId','') <> '' then
    chosen := chosen || jsonb_build_object('scorerType','player','scorerPlayerId',p_goal->>'scorerPlayerId');
  end if;
  if coalesce(chosen->>'assistType','none') = 'none' and coalesce(p_goal->>'assistPlayerId','') <> '' then
    chosen := chosen || jsonb_build_object('assistType','player','assistPlayerId',p_goal->>'assistPlayerId');
  end if;
  goal_id := chosen->>'id';
  if p_goal ? '_relink_media_id' then
    if existing.id is null or existing.id::text <> p_goal->>'_relink_media_id'
      or existing.goal_id <> p_goal->>'_previous_goal_id' then raise exception 'STALE_GOAL_MEDIA'; end if;
    update public.match_goal_media set goal_id = chosen->>'id', tag_id = t.id, clip_id = case when previous_tag is distinct from t.id then null else clip_id end, start_time = case when previous_tag is distinct from t.id then null else start_time end, end_time = case when previous_tag is distinct from t.id then null else end_time end where id = existing.id;
    if existing.clip_id is not null then
      update public.clips set name = 'Doelpunt ' || (chosen->>'scoreAfter') where id = existing.clip_id;
    end if;
    select * into existing from public.match_goal_media where id = existing.id;
  elsif existing.id is not null and existing.goal_id <> goal_id then raise exception 'TAG_ALREADY_LINKED'; end if;
  if p_goal ? '_update_tag_times' then
    if p_start is null or p_end is null or p_start < 0 or p_end <= p_start or p_end - p_start > 180 then raise exception 'INVALID_RANGE'; end if;
    update public.tags set start_time = p_start, end_time = p_end where id = t.id;
  end if;
  chosen := chosen - '_relink_media_id' - '_previous_goal_id' - '_edit_goal' - '_update_tag_times';
  if chosen->>'team' <> p_goal->>'team' then raise exception 'GOAL_TEAM_CONFLICT'; end if;
  if existing.id is null then
    insert into public.match_goal_media(match_id, goal_id, tag_id) values (m.id, goal_id, t.id) returning * into existing;
  end if;
  select coalesce(jsonb_agg(value order by nullif(split_part(value->>'scoreAfter','-',1),'')::int
    + nullif(split_part(value->>'scoreAfter','-',2),'')::int nulls last), '[]'::jsonb) into events
    from (select value from jsonb_array_elements(events) where value->>'id' <> goal_id union all select chosen) g;
  update public.match_dossiers set goal_events = events, updated_at = now(), updated_by = p_user_id where match_id = m.id;
  -- Keep every tag of the edited report goal consistent in the same transaction.
  if previous_tag is not null and previous_tag <> t.id then
    delete from public.player_stat_events where tag_id = previous_tag and stat_type in ('goal','assist');
    update public.tags set name = regexp_replace(name, '\s+[0-9]{1,2}-[0-9]{1,2}$', ''), event_type = null,
      event_metadata = coalesce(event_metadata,'{}'::jsonb) - 'scorer_id' - 'assist_id' where id = previous_tag;
  end if;
  update public.tags tg set name = case when tg.name ~* '^goal\s+(thuis|uit)(\s|$)' then case when chosen->>'team' = 'home' then 'Goal Thuis' else 'Goal Uit' end else regexp_replace(tg.name, '\s+[0-9]{1,2}-[0-9]{1,2}$', '') end || ' ' || (chosen->>'scoreAfter'),
    event_type = case when chosen->>'team' = case when m.is_home_match = false then 'away' else 'home' end then 'goal_for' else 'goal_against' end,
    event_metadata = coalesce(tg.event_metadata,'{}'::jsonb) || jsonb_build_object('scorer_id', nullif(chosen->>'scorerPlayerId',''), 'assist_id', nullif(chosen->>'assistPlayerId',''))
  where tg.id in(select gm.tag_id from public.match_goal_media gm where gm.match_id = m.id and gm.goal_id = chosen->>'id');
  update public.live_match_tags lt set tag_name = tg.name from public.tags tg where lt.tag_id = tg.id and lt.match_id = m.id;
  delete from public.player_stat_events where tag_id in(select gm.tag_id from public.match_goal_media gm where gm.match_id = m.id and gm.goal_id = chosen->>'id') and stat_type in ('goal','assist');
  if chosen->>'team' = (case when m.is_home_match = false then 'away' else 'home' end) then
    insert into public.player_stat_events(coach_id,player_id,team_id,match_id,tag_id,stat_type,season)
    select p_user_id, nullif(chosen->>'scorerPlayerId','')::uuid, m.team_a_id,m.id,t.id,'goal',extract(year from m.match_date)::text where coalesce(chosen->>'scorerPlayerId','') <> '';
    insert into public.player_stat_events(coach_id,player_id,team_id,match_id,tag_id,stat_type,season)
    select p_user_id, nullif(chosen->>'assistPlayerId','')::uuid, m.team_a_id,m.id,t.id,'assist',extract(year from m.match_date)::text where coalesce(chosen->>'assistPlayerId','') <> '';
  end if;
  if p_create_clip then
    if p_start is null or p_end is null or p_start < 0 or p_end <= p_start or p_end - p_start > 180 then raise exception 'INVALID_RANGE'; end if;
    -- A repeated confirmation reuses its clip. A corrected range creates a new
    -- snapshot and leaves the previous archived file intact.
    if existing.clip_id is not null and existing.start_time = p_start and existing.end_time = p_end
      and exists(select 1 from public.clips where id = existing.clip_id and render_status <> 'failed') then
      v_clip_id := existing.clip_id;
      select id into segment_id from public.clip_segments where clip_id = v_clip_id order by sequence_order limit 1;
    else
      insert into public.clips(coach_id, video_id, team_id, name, audience_type, audience_player_ids, render_status, archived_goal)
        values(p_user_id, t.video_id, m.team_a_id, 'Doelpunt ' || (chosen->>'scoreAfter'), 'full_team', '{}', 'rendering', true) returning id into v_clip_id;
      insert into public.clip_segments(clip_id, tag_id, video_id, sequence_order, source_start, source_end)
        values(v_clip_id, t.id, t.video_id, 0, p_start, p_end) returning id into segment_id;
      update public.match_goal_media set clip_id = v_clip_id, start_time = p_start, end_time = p_end where id = existing.id;
    end if;
  end if;
  return jsonb_build_object('goal', chosen, 'clipId', v_clip_id, 'segmentId', segment_id, 'mediaId', existing.id);
end;
$$;
revoke all on function public.link_match_goal_media(uuid, uuid, jsonb, uuid, boolean, numeric, numeric) from public, anon, authenticated;
grant execute on function public.link_match_goal_media(uuid, uuid, jsonb, uuid, boolean, numeric, numeric) to service_role;

-- Add the saved score to existing linked tags without changing their event data.
update public.tags tg set name = regexp_replace(tg.name, '\s+[0-9]{1,2}-[0-9]{1,2}$', '') || ' ' || (g.value->>'scoreAfter')
from public.match_goal_media gm join public.match_dossiers d on d.match_id = gm.match_id,
lateral jsonb_array_elements(coalesce(d.goal_events,'[]'::jsonb)) g
where tg.id = gm.tag_id and g.value->>'id' = gm.goal_id and g.value->>'scoreAfter' ~ '^[0-9]{1,2}-[0-9]{1,2}$';
update public.live_match_tags lt set tag_name = tg.name from public.tags tg where lt.tag_id = tg.id;

notify pgrst, 'reload schema';
