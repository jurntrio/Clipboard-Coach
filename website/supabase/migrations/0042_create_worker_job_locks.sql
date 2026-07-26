-- This table was defined in 0014_security_hardening.sql but never actually created in
-- production (confirmed missing via a live "relation does not exist" error) - the worker uses it
-- to prevent double-processing the same video/clip, so every render has been failing silently.
create table if not exists public.worker_job_locks (
  resource_kind text not null check (resource_kind in ('video', 'clip')),
  resource_id uuid not null,
  lock_token uuid not null,
  acquired_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  primary key (resource_kind, resource_id)
);
alter table public.worker_job_locks enable row level security;

notify pgrst, 'reload schema';
