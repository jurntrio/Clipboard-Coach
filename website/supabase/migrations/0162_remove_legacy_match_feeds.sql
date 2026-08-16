-- Product decision: official RBFA/Voetbal Vlaanderen ZIP downloads are the
-- only external match source until a licensed API integration is available.
-- Related match child rows are removed by their existing ON DELETE CASCADE
-- constraints; source videos themselves are not deleted.
delete from public.matches where external_source = 'foot24';

-- A club administrator must no longer be able to link a team to an official
-- webpage or third-party calendar URL.
delete from public.club_team_calendar_feeds;

notify pgrst, 'reload schema';
