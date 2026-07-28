-- Platform-controlled club modules and club-admin-controlled Training/Intradesk policy.

create table if not exists public.club_module_entitlements (
  club_id uuid references public.clubs(id) on delete cascade not null,
  module_key text not null check (module_key in (
    'teams', 'video_viewer', 'matches', 'clips', 'training', 'intradesk',
    'attendance', 'club_management'
  )),
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, module_key)
);

create table if not exists public.club_training_settings (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  new_training_policy text not null default 'automatic'
    check (new_training_policy in ('automatic', 'approval_required', 'personal_only')),
  new_version_policy text not null default 'approval_required'
    check (new_version_policy in ('automatic', 'approval_required')),
  trainers_can_create_versions boolean not null default true,
  trainers_can_download boolean not null default true,
  age_category_required boolean not null default false,
  change_note_required boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_module_entitlements_enabled_idx
  on public.club_module_entitlements(club_id, enabled);

alter table public.club_module_entitlements enable row level security;
alter table public.club_training_settings enable row level security;

drop policy if exists "Active club members can read module entitlements" on public.club_module_entitlements;
create policy "Active club members can read module entitlements"
  on public.club_module_entitlements for select
  using (exists (
    select 1 from public.club_memberships membership
    where membership.club_id = club_module_entitlements.club_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  ));

drop policy if exists "Active club members can read training settings" on public.club_training_settings;
create policy "Active club members can read training settings"
  on public.club_training_settings for select
  using (exists (
    select 1 from public.club_memberships membership
    where membership.club_id = club_training_settings.club_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  ));

drop policy if exists "Club admins can update training settings" on public.club_training_settings;
create policy "Club admins can update training settings"
  on public.club_training_settings for update
  using (exists (
    select 1 from public.club_memberships membership
    where membership.club_id = club_training_settings.club_id
      and membership.profile_id = auth.uid()
      and membership.role = 'club_admin'
      and membership.status = 'active'
  ))
  with check (exists (
    select 1 from public.club_memberships membership
    where membership.club_id = club_training_settings.club_id
      and membership.profile_id = auth.uid()
      and membership.role = 'club_admin'
      and membership.status = 'active'
  ));

create or replace function public.seed_club_modules()
returns trigger language plpgsql security definer set search_path = public as $$
declare module_name text;
begin
  foreach module_name in array array[
    'teams', 'video_viewer', 'matches', 'clips', 'training', 'intradesk',
    'attendance', 'club_management'
  ]
  loop
    insert into public.club_module_entitlements(club_id, module_key, enabled)
    values(new.id, module_name, true)
    on conflict (club_id, module_key) do nothing;
  end loop;
  insert into public.club_training_settings(club_id)
  values(new.id)
  on conflict (club_id) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_club_modules_after_insert on public.clubs;
create trigger seed_club_modules_after_insert
after insert on public.clubs
for each row execute function public.seed_club_modules();

insert into public.club_module_entitlements(club_id, module_key, enabled)
select club.id, module.module_key, true
from public.clubs club
cross join (values
  ('teams'), ('video_viewer'), ('matches'), ('clips'), ('training'),
  ('intradesk'), ('attendance'), ('club_management')
) as module(module_key)
on conflict (club_id, module_key) do nothing;

insert into public.club_training_settings(club_id)
select id from public.clubs
on conflict (club_id) do nothing;

