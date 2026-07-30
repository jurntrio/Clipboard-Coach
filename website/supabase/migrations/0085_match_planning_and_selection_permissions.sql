alter table public.club_match_options drop constraint if exists club_match_options_option_type_check;
alter table public.club_match_options add constraint club_match_options_option_type_check check (option_type in (
  'field', 'locker_room', 'visitor_locker_room', 'referee', 'meeting_place', 'non_selection_reason'
));

alter table public.matches
  add column if not exists visitor_locker_room_option_id uuid references public.club_match_options(id) on delete set null,
  add column if not exists referee_option_id uuid references public.club_match_options(id) on delete set null;

insert into public.club_match_options (club_id, option_type, label)
select id, 'referee', 'Aangeduid door KBVB' from public.clubs on conflict do nothing;

create or replace function public.add_default_club_planning_options()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.club_match_options (club_id, option_type, label)
  values (new.id, 'meeting_place', 'Kleedkamer'), (new.id, 'referee', 'Aangeduid door KBVB')
  on conflict do nothing;
  insert into public.club_match_options (club_id, option_type, label)
  select new.id, 'non_selection_reason', reason
  from unnest(array['Gekwetst','Ziek','Vakantie','School of studie','Werk','Familiale reden','Geschorst','Geen vervoer','Andere']) reason
  on conflict do nothing;
  return new;
end;
$$;

alter table public.club_member_permissions drop constraint if exists club_member_permissions_permission_key_check;
alter table public.club_member_permissions add constraint club_member_permissions_permission_key_check check (permission_key in (
  'teams.view_all', 'teams.manage_all', 'teams.view', 'teams.manage', 'teams.import', 'video.view',
  'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
  'games.selection.view', 'games.selection.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
  'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage', 'clips.share'
));

alter table public.club_role_permission_defaults drop constraint if exists club_role_permission_defaults_permission_key_check;
alter table public.club_role_permission_defaults add constraint club_role_permission_defaults_permission_key_check check (permission_key in (
  'teams.view_all', 'teams.manage_all', 'teams.view', 'teams.manage', 'teams.import', 'video.view',
  'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
  'games.selection.view', 'games.selection.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
  'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage', 'clips.share'
));

notify pgrst, 'reload schema';
