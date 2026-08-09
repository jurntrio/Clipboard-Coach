alter table public.match_dossiers
  add column if not exists player_reviews jsonb not null default '[]'::jsonb;
