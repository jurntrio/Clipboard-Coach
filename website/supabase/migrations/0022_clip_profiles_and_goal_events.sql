-- Per-coach clip profiles and extensible tag-event metadata.
alter table public.standard_tags
  add column if not exists start_offset_seconds numeric not null default -5,
  add column if not exists end_offset_seconds numeric not null default 5;

alter table public.standard_tags
  add constraint standard_tags_clip_profile_order
  check (start_offset_seconds <= end_offset_seconds);

alter table public.tags
  add column if not exists occurred_at_seconds numeric,
  add column if not exists event_type text,
  add column if not exists event_metadata jsonb not null default '{}'::jsonb;

update public.tags
set occurred_at_seconds = start_time
where occurred_at_seconds is null;

alter table public.tags alter column occurred_at_seconds set not null;

create or replace function public.default_tag_occurrence()
returns trigger language plpgsql set search_path = public as $$
begin
  new.occurred_at_seconds := coalesce(new.occurred_at_seconds, new.start_time);
  return new;
end;
$$;
drop trigger if exists default_tag_occurrence_before_insert on public.tags;
create trigger default_tag_occurrence_before_insert
  before insert on public.tags for each row execute function public.default_tag_occurrence();

update public.standard_tags
set start_offset_seconds = case lower(name)
    when 'goal' then -10 when 'kans' then -10 when 'opbouw' then -5
    when 'positiespel' then -10 when 'hoekschop' then -3 when 'vrije trap' then -3
    else start_offset_seconds end,
    end_offset_seconds = case lower(name)
    when 'goal' then 3 when 'kans' then 3 when 'opbouw' then 10
    when 'positiespel' then 5 when 'hoekschop' then 10 when 'vrije trap' then 10
    else end_offset_seconds end;

-- Add the requested defaults without replacing coach-authored tags.
insert into public.standard_tags (coach_id, name, is_protected, start_offset_seconds, end_offset_seconds)
select p.id, preset.name, false, preset.start_offset, preset.end_offset
from public.profiles p
cross join (values
  ('Goal', -10::numeric, 3::numeric),
  ('Kans', -10::numeric, 3::numeric),
  ('Opbouw', -5::numeric, 10::numeric),
  ('Positiespel', -10::numeric, 5::numeric),
  ('Hoekschop', -3::numeric, 10::numeric),
  ('Vrije trap', -3::numeric, 10::numeric)
) as preset(name, start_offset, end_offset)
on conflict (coach_id, name) do update
set start_offset_seconds = excluded.start_offset_seconds,
    end_offset_seconds = excluded.end_offset_seconds;

create table if not exists public.player_stat_events (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete cascade not null,
  tag_id uuid references public.tags(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  stat_type text not null check (stat_type in ('goal', 'assist')),
  season text,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(tag_id, player_id, stat_type)
);

alter table public.player_stat_events enable row level security;
create policy "Coaches can view own player stat events" on public.player_stat_events
  for select using (coach_id = auth.uid());
create policy "Coaches can create own player stat events" on public.player_stat_events
  for insert with check (coach_id = auth.uid());

create index if not exists idx_player_stat_events_player_type
  on public.player_stat_events(player_id, stat_type);
create index if not exists idx_player_stat_events_team_season
  on public.player_stat_events(team_id, season);

create or replace view public.player_career_stats
with (security_invoker = true) as
select player_id,
  count(*) filter (where stat_type = 'goal')::integer as goals,
  count(*) filter (where stat_type = 'assist')::integer as assists
from public.player_stat_events
group by player_id;
grant select on public.player_career_stats to authenticated;

-- One transaction prevents a Goal tag, clip and statistics from diverging.
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
    if tag_event_type = 'goal_for' and scorer_id is null then raise exception 'SCORER_REQUIRED'; end if;
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

  if tag_event_type = 'goal_for' then
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

grant execute on function public.create_profiled_tag(uuid, uuid, text, numeric, text, uuid[], text, uuid, uuid) to authenticated;

-- Keep onboarding in sync: future coaches receive all requested profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at_value timestamp with time zone;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.standard_tags
    (coach_id, name, is_protected, start_offset_seconds, end_offset_seconds)
  values
    (new.id, 'Start', true, 0, 0),
    (new.id, 'Goal', true, -10, 3),
    (new.id, 'Kans', false, -10, 3),
    (new.id, 'Opbouw', false, -5, 10),
    (new.id, 'Positiespel', false, -10, 5),
    (new.id, 'Hoekschop', false, -3, 10),
    (new.id, 'Vrije trap', false, -3, 10);

  if coalesce(new.raw_user_meta_data->>'legal_accepted', 'false') = 'true'
    and new.raw_user_meta_data->>'terms_version' is not null
    and new.raw_user_meta_data->>'privacy_version' is not null
    and new.raw_user_meta_data->>'legal_statement_version' is not null then
    begin
      accepted_at_value := (new.raw_user_meta_data->>'legal_accepted_at')::timestamp with time zone;
    exception when others then
      accepted_at_value := timezone('utc'::text, now());
    end;
    insert into public.legal_acceptances
      (user_id, terms_version, privacy_version, statement_version, locale, accepted_at)
    values
      (new.id, new.raw_user_meta_data->>'terms_version',
       new.raw_user_meta_data->>'privacy_version',
       new.raw_user_meta_data->>'legal_statement_version',
       case when new.raw_user_meta_data->>'legal_locale' = 'en' then 'en' else 'nl' end,
       accepted_at_value);
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
