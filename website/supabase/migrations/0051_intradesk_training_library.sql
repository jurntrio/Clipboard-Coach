-- Shared, versioned club training library. Trainers may create and update;
-- only club admins may archive or delete (enforced by API and RLS).

create table if not exists public.club_trainings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  age_category text not null check (age_category in (
    'U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17',
    'U19','Beloften','A Ploeg'
  )),
  themes text[] not null default '{}',
  status text not null default 'published' check (status in ('published','archived')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_training_versions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.club_trainings(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content jsonb not null,
  change_note text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (training_id, version_number)
);

create index if not exists club_trainings_library_idx
  on public.club_trainings(club_id, status, age_category, updated_at desc);
create index if not exists club_training_versions_history_idx
  on public.club_training_versions(training_id, version_number desc);

alter table public.club_trainings enable row level security;
alter table public.club_training_versions enable row level security;

create policy "Active club staff can read club trainings" on public.club_trainings for select
using (exists (
  select 1 from public.club_memberships membership
  where membership.club_id = club_trainings.club_id
    and membership.profile_id = auth.uid()
    and membership.status = 'active'
    and membership.role in (
      'trainer','coach','assistant_coach','analyst','club_admin','club_admin_viewer'
    )
));

create policy "Active club staff can read training versions" on public.club_training_versions for select
using (exists (
  select 1 from public.club_trainings training
  join public.club_memberships membership on membership.club_id = training.club_id
  where training.id = club_training_versions.training_id
    and membership.profile_id = auth.uid()
    and membership.status = 'active'
    and membership.role in (
      'trainer','coach','assistant_coach','analyst','club_admin','club_admin_viewer'
    )
));

-- Writes deliberately go through the authenticated API, which checks the active
-- club role before using the service client. No direct browser write policies.
