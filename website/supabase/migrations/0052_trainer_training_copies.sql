-- Personal trainer copy behind every saved training. Club publication is a
-- separate, linked record controlled by club_training_settings.

create table if not exists public.trainer_trainings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  club_training_id uuid references public.club_trainings(id) on delete set null,
  title text not null,
  age_category text not null check (age_category in (
    'U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17',
    'U19','Beloften','A Ploeg'
  )),
  themes text[] not null default '{}',
  content jsonb not null,
  publication_state text not null default 'personal'
    check (publication_state in ('personal','pending_approval','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainer_trainings_owner_idx
  on public.trainer_trainings(owner_id, updated_at desc);

alter table public.trainer_trainings enable row level security;

create policy "Trainers can read own training copies" on public.trainer_trainings for select
using (owner_id = auth.uid());

create policy "Club admins can read club training copies" on public.trainer_trainings for select
using (exists (
  select 1 from public.club_memberships membership
  where membership.club_id = trainer_trainings.club_id
    and membership.profile_id = auth.uid()
    and membership.status = 'active'
    and membership.role in ('club_admin','club_admin_viewer')
));

-- Mutations go through the authenticated API after role and ownership checks.
