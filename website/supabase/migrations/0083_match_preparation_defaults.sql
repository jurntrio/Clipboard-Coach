alter table public.matches
  alter column meeting_time_enabled set default true;

update public.matches
set
  meeting_time_enabled = true,
  departure_time_enabled = case when is_home_match then false else departure_time_enabled end,
  departure_time = case when is_home_match then null else departure_time end,
  updated_at = timezone('utc'::text, now())
where meeting_time_enabled = false
   or (is_home_match and (departure_time_enabled = true or departure_time is not null));

update public.matches as match
set
  meeting_place_option_id = option.id,
  meeting_place_custom = null,
  updated_at = timezone('utc'::text, now())
from public.club_match_options as option
where match.meeting_place_option_id is null
  and match.meeting_place_custom is null
  and option.club_id = match.club_id
  and option.option_type = 'meeting_place'
  and option.active = true
  and lower(trim(option.label)) = 'kleedkamer';
