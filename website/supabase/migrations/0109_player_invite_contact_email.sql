alter table public.player_invites
  add column if not exists contact_email text;

notify pgrst, 'reload schema';
