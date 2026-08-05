-- New clubs no longer get the training tool (tekentool), video viewer and
-- media/ClubTV modules enabled by default - those are switched on manually
-- by the platform admin once a club pays for them. Existing clubs are
-- untouched: the training-drawing-canvas is split off into its own module
-- key ("training_builder", gating only the interactive builder, not the
-- session calendar or the read-only Intradesk view), and since that key is
-- brand new it is explicitly backfilled as enabled for clubs that already
-- exist, so nothing changes for them today.

alter table public.club_module_entitlements drop constraint if exists club_module_entitlements_module_key_check;
alter table public.club_module_entitlements add constraint club_module_entitlements_module_key_check check (module_key in (
  'teams', 'video_viewer', 'matches', 'clips', 'training', 'training_builder', 'intradesk', 'media',
  'attendance', 'club_management', 'teams_manage', 'teams_import'
));

insert into public.club_module_entitlements(club_id, module_key, enabled)
select id, 'training_builder', true from public.clubs
on conflict (club_id, module_key) do nothing;

create or replace function public.seed_club_modules()
returns trigger language plpgsql security definer set search_path = public as $$
declare module_name text;
begin
  foreach module_name in array array[
    'teams', 'video_viewer', 'matches', 'clips', 'training', 'training_builder', 'intradesk', 'media',
    'attendance', 'club_management', 'teams_manage', 'teams_import'
  ] loop
    insert into public.club_module_entitlements(club_id, module_key, enabled)
    values(new.id, module_name, module_name not in ('training_builder', 'video_viewer', 'media'))
    on conflict (club_id, module_key) do nothing;
  end loop;
  insert into public.club_training_settings(club_id) values(new.id) on conflict (club_id) do nothing;
  return new;
end;
$$;
