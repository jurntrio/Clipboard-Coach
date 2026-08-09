alter table public.matches
  add column if not exists transport_mode text
  check (transport_mode is null or transport_mode in ('club', 'own'));
