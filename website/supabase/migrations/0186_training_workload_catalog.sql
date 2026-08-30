-- A workload system contains related modalities (EDT/IDT/EIT/IIT). A
-- versioned scheme distributes those modalities across independent phases.

alter table public.team_training_sessions drop constraint if exists team_training_sessions_season_phase_check;
alter table public.team_training_sessions add constraint team_training_sessions_season_phase_check
  check (season_phase in ('Pre Season', 'Voorbereiding', 'Competitie', 'Winterstop', 'After Season'));

create table if not exists public.club_workload_systems (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '',
  source text not null default 'club' check (source in ('club', 'import')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.club_workload_categories (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.club_workload_systems(id) on delete cascade,
  code text not null check (char_length(trim(code)) between 1 and 40),
  name text not null check (char_length(trim(name)) between 1 and 120),
  color text not null default '#22c55e', display_order integer not null check (display_order > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (system_id, code), unique (system_id, display_order)
);

create table if not exists public.club_workload_modalities (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.club_workload_categories(id) on delete cascade,
  code text not null check (char_length(trim(code)) between 1 and 40),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '', color text not null default '#22c55e', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (category_id, code)
);

-- Steps contain the prescription behind a modality. For endurance modalities
-- the match format is part of that prescription (for example EDT 8v8-10v10),
-- not an unrelated training field.
create table if not exists public.club_workload_modality_steps (
  id uuid primary key default gen_random_uuid(),
  modality_id uuid not null references public.club_workload_modalities(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  match_format text not null default '',
  duration_value numeric check (duration_value is null or duration_value > 0),
  duration_unit text check (duration_unit is null or duration_unit in ('seconds', 'minutes', 'meters')),
  repetitions integer check (repetitions is null or repetitions > 0),
  sets integer check (sets is null or sets > 0),
  rest_between_repetitions_seconds integer check (rest_between_repetitions_seconds is null or rest_between_repetitions_seconds >= 0),
  rest_between_sets_seconds integer check (rest_between_sets_seconds is null or rest_between_sets_seconds >= 0),
  parameters jsonb not null default '{}'::jsonb,
  unique (modality_id, step_number)
);

create table if not exists public.club_workload_schemes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  system_id uuid references public.club_workload_systems(id) on delete restrict,
  name text not null, description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  current_version integer not null default 1 check (current_version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.club_workload_scheme_versions (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.club_workload_schemes(id) on delete cascade,
  version_number integer not null check (version_number > 0), change_note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), unique (scheme_id, version_number)
);

create table if not exists public.club_workload_scheme_phases (
  id uuid primary key default gen_random_uuid(),
  scheme_version_id uuid not null references public.club_workload_scheme_versions(id) on delete cascade,
  phase_kind text not null check (phase_kind in ('Pre Season', 'Voorbereiding', 'Competitie', 'Winterstop', 'After Season')),
  display_order integer not null check (display_order > 0), duration_weeks integer not null check (duration_weeks > 0),
  training_mode text not null default 'regular' check (training_mode in ('regular', 'no_training', 'running_plan')),
  resume_policy text not null default 'continue' check (resume_policy in ('continue', 'restart')),
  unique (scheme_version_id, display_order)
);

create table if not exists public.club_workload_scheme_sessions (
  id uuid primary key default gen_random_uuid(),
  scheme_phase_id uuid not null references public.club_workload_scheme_phases(id) on delete cascade,
  week_number integer not null check (week_number > 0), session_number integer not null check (session_number > 0),
  warmup text not null default '', note text not null default '',
  unique (scheme_phase_id, week_number, session_number)
);

create table if not exists public.club_workload_scheme_session_blocks (
  id uuid primary key default gen_random_uuid(),
  scheme_session_id uuid not null references public.club_workload_scheme_sessions(id) on delete cascade,
  category_id uuid not null references public.club_workload_categories(id) on delete restrict,
  modality_id uuid references public.club_workload_modalities(id) on delete restrict,
  modality_step_id uuid references public.club_workload_modality_steps(id) on delete restrict,
  display_order integer not null check (display_order > 0),
  progression_step integer check (progression_step is null or progression_step > 0),
  match_format text not null default '',
  duration_value numeric check (duration_value is null or duration_value > 0),
  duration_unit text check (duration_unit is null or duration_unit in ('seconds', 'minutes', 'meters')),
  repetitions integer check (repetitions is null or repetitions > 0), sets integer check (sets is null or sets > 0),
  rest_between_repetitions_seconds integer check (rest_between_repetitions_seconds is null or rest_between_repetitions_seconds >= 0),
  rest_between_sets_seconds integer check (rest_between_sets_seconds is null or rest_between_sets_seconds >= 0),
  parameters jsonb not null default '{}'::jsonb, note text not null default '',
  unique (scheme_session_id, category_id), unique (scheme_session_id, display_order)
);

create index if not exists club_workload_systems_catalog_idx on public.club_workload_systems(club_id, active, name);
create index if not exists club_workload_categories_system_idx on public.club_workload_categories(system_id, active, display_order);
create index if not exists club_workload_modalities_category_idx on public.club_workload_modalities(category_id, active, name);
create index if not exists club_workload_modality_steps_modality_idx on public.club_workload_modality_steps(modality_id, step_number);
create index if not exists club_workload_schemes_catalog_idx on public.club_workload_schemes(club_id, status, updated_at desc);
create index if not exists club_workload_scheme_sessions_phase_idx on public.club_workload_scheme_sessions(scheme_phase_id, week_number, session_number);
create index if not exists club_workload_session_blocks_session_idx on public.club_workload_scheme_session_blocks(scheme_session_id, display_order);

create or replace function public.validate_workload_scheme_system_club() returns trigger language plpgsql as $$
declare system_club_id uuid;
begin
  if new.system_id is null then return new; end if;
  select club_id into system_club_id from public.club_workload_systems where id=new.system_id;
  if system_club_id is null or system_club_id<>new.club_id then raise exception 'WORKLOAD_SCHEME_SYSTEM_CLUB_MISMATCH'; end if;
  return new;
end; $$;
create or replace function public.validate_workload_session_block() returns trigger language plpgsql as $$
declare scheme_club_id uuid; category_club_id uuid; modality_category_id uuid; step_modality_id uuid;
begin
  select scheme.club_id into scheme_club_id from public.club_workload_scheme_phases phase
  join public.club_workload_scheme_versions version on version.id=phase.scheme_version_id
  join public.club_workload_schemes scheme on scheme.id=version.scheme_id
  join public.club_workload_scheme_sessions session on session.scheme_phase_id=phase.id where session.id=new.scheme_session_id;
  select system.club_id into category_club_id from public.club_workload_categories category
  join public.club_workload_systems system on system.id=category.system_id where category.id=new.category_id;
  if new.modality_id is not null then select category_id into modality_category_id from public.club_workload_modalities where id=new.modality_id; end if;
  if new.modality_step_id is not null then select modality_id into step_modality_id from public.club_workload_modality_steps where id=new.modality_step_id; end if;
  if scheme_club_id is null or category_club_id is null or scheme_club_id<>category_club_id then raise exception 'WORKLOAD_BLOCK_CATEGORY_CLUB_MISMATCH'; end if;
  if new.modality_id is not null and modality_category_id<>new.category_id then raise exception 'WORKLOAD_BLOCK_MODALITY_CATEGORY_MISMATCH'; end if;
  if new.modality_step_id is not null and (new.modality_id is null or step_modality_id<>new.modality_id) then raise exception 'WORKLOAD_BLOCK_STEP_MODALITY_MISMATCH'; end if;
  return new;
end; $$;
create trigger validate_workload_scheme_system_club_trigger before insert or update of club_id,system_id on public.club_workload_schemes for each row execute function public.validate_workload_scheme_system_club();
create trigger validate_workload_session_block_trigger before insert or update of scheme_session_id,category_id,modality_id,modality_step_id on public.club_workload_scheme_session_blocks for each row execute function public.validate_workload_session_block();

alter table public.club_workload_systems enable row level security;
alter table public.club_workload_categories enable row level security;
alter table public.club_workload_modalities enable row level security;
alter table public.club_workload_modality_steps enable row level security;
alter table public.club_workload_schemes enable row level security;
alter table public.club_workload_scheme_versions enable row level security;
alter table public.club_workload_scheme_phases enable row level security;
alter table public.club_workload_scheme_sessions enable row level security;
alter table public.club_workload_scheme_session_blocks enable row level security;

create policy "Members read workload systems" on public.club_workload_systems for select using (exists (select 1 from public.club_memberships m where m.club_id=club_workload_systems.club_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload categories" on public.club_workload_categories for select using (exists (select 1 from public.club_workload_systems s join public.club_memberships m on m.club_id=s.club_id where s.id=club_workload_categories.system_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload modalities" on public.club_workload_modalities for select using (exists (select 1 from public.club_workload_categories c join public.club_workload_systems s on s.id=c.system_id join public.club_memberships m on m.club_id=s.club_id where c.id=club_workload_modalities.category_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload modality steps" on public.club_workload_modality_steps for select using (exists (select 1 from public.club_workload_modalities md join public.club_workload_categories c on c.id=md.category_id join public.club_workload_systems s on s.id=c.system_id join public.club_memberships m on m.club_id=s.club_id where md.id=club_workload_modality_steps.modality_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload schemes" on public.club_workload_schemes for select using (exists (select 1 from public.club_memberships m where m.club_id=club_workload_schemes.club_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload versions" on public.club_workload_scheme_versions for select using (exists (select 1 from public.club_workload_schemes s join public.club_memberships m on m.club_id=s.club_id where s.id=club_workload_scheme_versions.scheme_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload phases" on public.club_workload_scheme_phases for select using (exists (select 1 from public.club_workload_scheme_versions v join public.club_workload_schemes s on s.id=v.scheme_id join public.club_memberships m on m.club_id=s.club_id where v.id=club_workload_scheme_phases.scheme_version_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload sessions" on public.club_workload_scheme_sessions for select using (exists (select 1 from public.club_workload_scheme_phases p join public.club_workload_scheme_versions v on v.id=p.scheme_version_id join public.club_workload_schemes s on s.id=v.scheme_id join public.club_memberships m on m.club_id=s.club_id where p.id=club_workload_scheme_sessions.scheme_phase_id and m.profile_id=auth.uid() and m.status='active'));
create policy "Members read workload session blocks" on public.club_workload_scheme_session_blocks for select using (exists (select 1 from public.club_workload_scheme_sessions ss join public.club_workload_scheme_phases p on p.id=ss.scheme_phase_id join public.club_workload_scheme_versions v on v.id=p.scheme_version_id join public.club_workload_schemes s on s.id=v.scheme_id join public.club_memberships m on m.club_id=s.club_id where ss.id=club_workload_scheme_session_blocks.scheme_session_id and m.profile_id=auth.uid() and m.status='active'));

revoke insert,update,delete on public.club_workload_systems,public.club_workload_categories,public.club_workload_modalities,public.club_workload_modality_steps,public.club_workload_schemes,public.club_workload_scheme_versions,public.club_workload_scheme_phases,public.club_workload_scheme_sessions,public.club_workload_scheme_session_blocks from authenticated,anon;
notify pgrst, 'reload schema';
