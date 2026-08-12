-- Track invitation delivery without retaining plaintext invitation tokens.
alter table public.player_invites
  add column if not exists sent_at timestamptz,
  add column if not exists delivery_error text;

alter table public.club_registration_invites
  add column if not exists sent_at timestamptz,
  add column if not exists delivery_error text;

-- A child can have a different address and practical notes per household/contact.
create table if not exists public.player_guardian_details (
  guardian_id uuid primary key references public.player_guardians(id) on delete cascade,
  address text,
  postal_code text,
  city text,
  phone text,
  notes text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.player_guardian_details enable row level security;
revoke all on public.player_guardian_details from anon;
grant select, insert, update on public.player_guardian_details to authenticated;

create policy "guardians manage their household details"
on public.player_guardian_details for all to authenticated
using (exists (
  select 1 from public.player_guardians guardian
  where guardian.id = guardian_id and guardian.profile_id = auth.uid()
    and guardian.revoked_at is null
))
with check (exists (
  select 1 from public.player_guardians guardian
  where guardian.id = guardian_id and guardian.profile_id = auth.uid()
    and guardian.revoked_at is null
));

notify pgrst, 'reload schema';
