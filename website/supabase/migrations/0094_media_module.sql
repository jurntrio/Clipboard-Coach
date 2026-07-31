-- Add the first separate Media module for ClubTV, screens and communication.

alter table public.club_module_entitlements drop constraint if exists club_module_entitlements_module_key_check;
alter table public.club_module_entitlements add constraint club_module_entitlements_module_key_check check (module_key in (
  'teams', 'video_viewer', 'matches', 'clips', 'training', 'intradesk', 'media',
  'attendance', 'club_management', 'teams_manage', 'teams_import'
));

insert into public.club_module_entitlements(club_id, module_key, enabled)
select id, 'media', true from public.clubs
on conflict (club_id, module_key) do nothing;

create or replace function public.seed_club_modules()
returns trigger language plpgsql security definer set search_path = public as $$
declare module_name text;
begin
  foreach module_name in array array[
    'teams', 'video_viewer', 'matches', 'clips', 'training', 'intradesk', 'media',
    'attendance', 'club_management', 'teams_manage', 'teams_import'
  ] loop
    insert into public.club_module_entitlements(club_id, module_key, enabled)
    values(new.id, module_name, true)
    on conflict (club_id, module_key) do nothing;
  end loop;
  insert into public.club_training_settings(club_id) values(new.id) on conflict (club_id) do nothing;
  return new;
end;
$$;
