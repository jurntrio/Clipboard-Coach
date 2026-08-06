alter table public.match_dossiers
  add column if not exists lineup_positions jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
