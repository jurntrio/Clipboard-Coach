-- Existing matches inherit an active, configured general club sponsor.
-- Explicit team sponsor choices remain untouched.
update public.matches m
set sponsor_source = 'club'
from public.clubs c
where m.club_id = c.id
  and m.sponsor_source = 'none'
  and c.clip_advertising_enabled = true
  and c.use_general_sponsor = true
  and c.general_sponsor_url is not null;

notify pgrst, 'reload schema';
