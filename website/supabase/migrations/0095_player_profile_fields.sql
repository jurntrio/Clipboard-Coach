-- Extra persoonsgegevens voor het centrale clubspelersprofiel.
alter table public.club_players
  add column if not exists national_registry_number text,
  add column if not exists birth_place text,
  add column if not exists photo_url text;

