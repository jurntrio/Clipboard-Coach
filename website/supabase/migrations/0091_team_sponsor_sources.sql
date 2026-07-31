-- Each club team chooses its own sponsor fallback. This replaces the old
-- all-or-nothing club switch while keeping that column for compatibility.
alter table public.club_teams
  add column if not exists sponsor_source text not null default 'club'
  check (sponsor_source in ('team', 'club', 'none'));

update public.club_teams team
set sponsor_source = case
  when team.sponsor_enabled and team.sponsor_url is not null then 'team'
  when club.use_general_sponsor and club.general_sponsor_url is not null then 'club'
  else 'none'
end
from public.clubs club
where club.id = team.club_id;

comment on column public.club_teams.sponsor_source is
  'Sponsor shown for this team: its own sponsor, the club sponsor, or none.';

notify pgrst, 'reload schema';
