-- Koppelt de club op beide kanten van een wedstrijd (team_a/team_b) aan de
-- centrale Belgische clublijst, op naam. Generiek: team_a en team_b zijn niet
-- altijd "eigen ploeg" resp. "tegenstander" (dat verschilt per importbron),
-- dus beide kolommen worden onafhankelijk op naam gekoppeld.
alter table public.matches
  add column if not exists team_a_belgian_club_id uuid references public.belgian_clubs(id) on delete set null,
  add column if not exists team_b_belgian_club_id uuid references public.belgian_clubs(id) on delete set null;

comment on column public.matches.team_a_belgian_club_id is
  'Belgian_clubs-rij die overeenkomt met team_a_name (naam of alias), indien gevonden. Gezet bij import of via de eenmalige backfill/review, nooit bij het openen van een wedstrijd.';
comment on column public.matches.team_b_belgian_club_id is
  'Belgian_clubs-rij die overeenkomt met team_b_name (naam of alias), indien gevonden. Gezet bij import of via de eenmalige backfill/review, nooit bij het openen van een wedstrijd.';

create index if not exists idx_matches_team_a_belgian_club on public.matches(team_a_belgian_club_id);
create index if not exists idx_matches_team_b_belgian_club on public.matches(team_b_belgian_club_id);

notify pgrst, 'reload schema';
