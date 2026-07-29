alter table public.team_training_sessions
  add column if not exists trainer_info text,
  add column if not exists attendance_confirmed_at timestamptz,
  add column if not exists attendance_confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists personal_training_id uuid references public.trainer_trainings(id) on delete set null,
  add column if not exists club_training_id uuid references public.club_trainings(id) on delete set null;

notify pgrst, 'reload schema';
