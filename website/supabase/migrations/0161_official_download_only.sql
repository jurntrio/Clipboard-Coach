-- Use the free RBFA/Voetbal Vlaanderen ZIP download as the sole match feed.
update public.club_team_calendar_feeds
set enabled = false,
    last_sync_status = 'disabled',
    last_sync_message = 'Uitgeschakeld: SVS gebruikt uitsluitend de officiële Voetbal Vlaanderen-download.',
    updated_at = now()
where enabled or last_sync_status is distinct from 'disabled';

notify pgrst, 'reload schema';
