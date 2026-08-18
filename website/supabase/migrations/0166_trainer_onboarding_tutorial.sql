alter table public.profiles
  add column if not exists trainer_onboarding_completed_at timestamptz;

comment on column public.profiles.trainer_onboarding_completed_at is
  'Set when a standalone trainer finishes or skips the first-login tutorial.';

notify pgrst, 'reload schema';
