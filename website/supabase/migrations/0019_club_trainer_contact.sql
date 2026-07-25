alter table public.club_trainers
  add column if not exists phone_number text;

notify pgrst, 'reload schema';
