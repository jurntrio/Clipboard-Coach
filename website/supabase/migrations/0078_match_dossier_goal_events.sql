alter table public.match_dossiers
  add column if not exists goal_events jsonb not null default '[]'::jsonb;
