-- Restore KM Torhout's previously configured composite sponsor banner. Other
-- clubs without sponsor content remain blank by default.
update public.clubs
set general_sponsor_url = '/branding/clip-sponsors.png',
    use_general_sponsor = true
where name ilike '%torhout%'
  and general_sponsor_url is null;

update public.matches m
set sponsor_source = 'club'
from public.clubs c
where m.club_id = c.id
  and c.name ilike '%torhout%'
  and c.clip_advertising_enabled = true
  and c.use_general_sponsor = true
  and c.general_sponsor_url is not null
  and m.sponsor_source = 'none';

notify pgrst, 'reload schema';
