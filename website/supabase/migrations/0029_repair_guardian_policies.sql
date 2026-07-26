-- 0026 was written with most of its new "create policy" statements missing
-- the "drop policy if exists" guard the rest of this codebase always uses,
-- so re-running (or a partial re-run after an earlier error in that same
-- script) fails with "policy ... already exists" and can leave later
-- statements in that file unapplied. This migration re-asserts every
-- object 0026 was supposed to create, idempotently, so it's safe to run
-- regardless of how far 0026 actually got.

drop policy if exists "Guardians can view their own links" on public.player_guardians;
create policy "Guardians can view their own links" on public.player_guardians for select
  using (profile_id = auth.uid());

drop policy if exists "Creators can view their player invites" on public.player_invites;
create policy "Creators can view their player invites" on public.player_invites for select
  using (created_by = auth.uid());

create or replace function public.can_guardian_view_clip(target_clip_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clips c
    join public.player_guardians pg on pg.profile_id = target_user_id
    join public.players p on p.id = pg.player_id
    where c.id = target_clip_id
      and (
        c.audience_player_ids @> array[p.id]
        or (c.team_id = p.team_id and c.audience_type = 'full_team')
        or exists (
          select 1 from public.clip_segments cs
          join public.tags t on t.id = cs.tag_id
          where cs.clip_id = c.id and t.player_ids @> array[p.id]
        )
      )
  );
$$;
grant execute on function public.can_guardian_view_clip(uuid, uuid) to authenticated;

create or replace function public.can_guardian_view_match(target_match_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    join public.player_guardians pg on pg.profile_id = target_user_id
    where m.id = target_match_id and pg.player_id = any(m.player_ids)
  );
$$;
grant execute on function public.can_guardian_view_match(uuid, uuid) to authenticated;

drop policy if exists "Guardians can view their player" on public.players;
create policy "Guardians can view their player" on public.players for select
  using (exists (select 1 from public.player_guardians pg where pg.profile_id = auth.uid() and pg.player_id = players.id));

-- Superseded by 0027's security-definer version (avoids the teams<->players
-- RLS recursion), but re-run it via guardian_team_ids() here too in case
-- 0027 itself landed before this repair and would otherwise be clobbered
-- by a bare version reappearing from a delayed 0026 retry.
drop policy if exists "Guardians can view their player's team" on public.teams;
create policy "Guardians can view their player's team" on public.teams for select
  using (id in (select public.guardian_team_ids(auth.uid())));

drop policy if exists "Guardians can view relevant matches" on public.matches;
create policy "Guardians can view relevant matches" on public.matches for select
  using (public.can_guardian_view_match(matches.id, auth.uid()));

drop policy if exists "Guardians can view relevant match videos" on public.match_videos;
create policy "Guardians can view relevant match videos" on public.match_videos for select
  using (exists (select 1 from public.matches m where m.id = match_videos.match_id and public.can_guardian_view_match(m.id, auth.uid())));

drop policy if exists "Guardians can view relevant clips" on public.clips;
create policy "Guardians can view relevant clips" on public.clips for select
  using (public.can_guardian_view_clip(clips.id, auth.uid()));

drop policy if exists "Guardians can view relevant clip segments" on public.clip_segments;
create policy "Guardians can view relevant clip segments" on public.clip_segments for select
  using (public.can_guardian_view_clip(clip_segments.clip_id, auth.uid()));

drop policy if exists "Guardians can view relevant tags" on public.tags;
create policy "Guardians can view relevant tags" on public.tags for select
  using (exists (select 1 from public.clip_segments cs where cs.tag_id = tags.id and public.can_guardian_view_clip(cs.clip_id, auth.uid())));

drop policy if exists "Guardians can view relevant videos" on public.videos;
create policy "Guardians can view relevant videos" on public.videos for select
  using (exists (select 1 from public.clips c where c.video_id = videos.id and public.can_guardian_view_clip(c.id, auth.uid())));

drop policy if exists "Guardians can view relevant player stats" on public.player_stat_events;
create policy "Guardians can view relevant player stats" on public.player_stat_events for select
  using (exists (select 1 from public.player_guardians pg where pg.profile_id = auth.uid() and pg.player_id = player_stat_events.player_id));

-- Re-assert the handle_new_user fix (club_onboarding restored +
-- player_invite_token handling) in case the original 0026 run aborted
-- before reaching it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at_value timestamp with time zone;
  invite public.player_invites;
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

  if new.raw_user_meta_data ? 'club_onboarding' then
    perform public.complete_club_team_onboarding(
      new.id, new.email, new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->'club_onboarding'
    );
  end if;

  if new.raw_user_meta_data ? 'player_invite_token' then
    select * into invite from public.player_invites
    where token = nullif(new.raw_user_meta_data->>'player_invite_token', '')::uuid
      and used_at is null and expires_at > timezone('utc'::text, now());
    if invite.id is null then raise exception 'PLAYER_INVITE_INVALID'; end if;
    update public.profiles set account_role = 'player_parent' where id = new.id;
    insert into public.player_guardians (player_id, profile_id) values (invite.player_id, new.id);
    update public.player_invites set used_at = timezone('utc'::text, now()), used_by = new.id where id = invite.id;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
