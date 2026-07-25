-- Contact details used by team roster imports (for example ProSoccerData).
alter table public.players
  add column if not exists date_of_birth date,
  add column if not exists phone_numbers text[] not null default '{}';
