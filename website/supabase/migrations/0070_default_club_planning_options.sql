-- Shared defaults for match and training planning. The historic
-- `non_selection_reason` value is retained for database compatibility and is
-- presented in the UI as a general absence reason.

insert into public.club_match_options (club_id, option_type, label)
select club.id, 'meeting_place', 'Kleedkamer'
from public.clubs club
on conflict do nothing;

insert into public.club_match_options (club_id, option_type, label)
select club.id, 'non_selection_reason', reason
from public.clubs club
cross join unnest(array[
  'Gekwetst', 'Ziek', 'Vakantie', 'School of studie', 'Werk',
  'Familiale reden', 'Geschorst', 'Geen vervoer', 'Andere'
]) reason
on conflict do nothing;

create or replace function public.add_default_club_planning_options()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.club_match_options (club_id, option_type, label)
  values (new.id, 'meeting_place', 'Kleedkamer')
  on conflict do nothing;

  insert into public.club_match_options (club_id, option_type, label)
  select new.id, 'non_selection_reason', reason
  from unnest(array[
    'Gekwetst', 'Ziek', 'Vakantie', 'School of studie', 'Werk',
    'Familiale reden', 'Geschorst', 'Geen vervoer', 'Andere'
  ]) reason
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists club_default_planning_options on public.clubs;
create trigger club_default_planning_options
after insert on public.clubs
for each row execute function public.add_default_club_planning_options();

notify pgrst, 'reload schema';
