-- Operational club history belongs to the club, not to the account that created it.
-- Removing a profile clears creator attribution without deleting matches, videos,
-- clips, or player statistics.

alter table public.matches drop constraint if exists matches_coach_id_fkey;
alter table public.matches alter column coach_id drop not null;
alter table public.matches
  add constraint matches_coach_id_fkey foreign key (coach_id)
  references public.profiles(id) on delete set null;

alter table public.videos drop constraint if exists videos_coach_id_fkey;
alter table public.videos alter column coach_id drop not null;
alter table public.videos
  add constraint videos_coach_id_fkey foreign key (coach_id)
  references public.profiles(id) on delete set null;

alter table public.clips drop constraint if exists clips_coach_id_fkey;
alter table public.clips alter column coach_id drop not null;
alter table public.clips
  add constraint clips_coach_id_fkey foreign key (coach_id)
  references public.profiles(id) on delete set null;

alter table public.player_stat_events drop constraint if exists player_stat_events_coach_id_fkey;
alter table public.player_stat_events alter column coach_id drop not null;
alter table public.player_stat_events
  add constraint player_stat_events_coach_id_fkey foreign key (coach_id)
  references public.profiles(id) on delete set null;

notify pgrst, 'reload schema';
