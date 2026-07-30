alter table public.matches
  add column if not exists completed_by uuid references public.profiles(id) on delete set null,
  add column if not exists completed_at timestamptz;
