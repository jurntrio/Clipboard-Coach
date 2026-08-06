alter table public.match_dossiers
  add column if not exists lineup_blocks jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
