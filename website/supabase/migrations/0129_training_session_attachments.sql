alter table public.team_training_sessions
  add column if not exists attachment_url text,
  add column if not exists attachment_key text,
  add column if not exists attachment_name text,
  add column if not exists attachment_content_type text;

notify pgrst, 'reload schema';
