-- Configurable sponsor artwork for public clips, globally or per club team.
alter table public.clubs
  add column if not exists general_sponsor_url text,
  add column if not exists use_general_sponsor boolean not null default true;

alter table public.club_teams
  add column if not exists sponsor_url text,
  add column if not exists sponsor_enabled boolean not null default false;

update public.clubs
set general_sponsor_url = '/branding/clip-sponsors.png',
    use_general_sponsor = clip_advertising_enabled
where general_sponsor_url is null;

comment on column public.clubs.general_sponsor_url is
  'Sponsor artwork used for every public club clip when use_general_sponsor is enabled.';
comment on column public.club_teams.sponsor_url is
  'Optional sponsor artwork for public clips belonging to this club team.';

notify pgrst, 'reload schema';
