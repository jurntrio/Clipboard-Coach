-- Additive foundation for natural people, account links and time-bound club roles.
-- No backfill is executed here and no existing player/trainer row is recreated.

create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (trim(first_name) <> ''),
  last_name text not null check (trim(last_name) <> ''),
  date_of_birth date,
  status text not null default 'active'
    check (status in ('active', 'merged', 'archived')),
  merged_into_person_id uuid references public.people(id) on delete restrict,
  merge_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (merged_into_person_id is null or merged_into_person_id <> id),
  check (
    (status = 'merged' and merged_into_person_id is not null)
    or (status <> 'merged' and merged_into_person_id is null)
  )
);

create index people_name_search_idx
  on public.people (public.normalize_person_name(first_name), public.normalize_person_name(last_name));

create table public.person_accounts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active'
    check (status in ('pending', 'active', 'revoked', 'rejected')),
  link_method text not null
    check (link_method in ('personal_invite', 'admin_review', 'verified_import')),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revoke_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (person_id, profile_id),
  check (
    (status = 'active' and verified_at is not null and revoked_at is null)
    or (status = 'pending' and verified_at is null and revoked_at is null)
    or (status in ('revoked', 'rejected') and revoked_at is not null)
  )
);

create unique index person_accounts_one_active_person_idx
  on public.person_accounts(person_id)
  where status = 'active' and revoked_at is null;

create unique index person_accounts_one_active_profile_idx
  on public.person_accounts(profile_id)
  where status = 'active' and revoked_at is null;

create index person_accounts_profile_history_idx on public.person_accounts(profile_id, created_at);

create table public.club_people (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete restrict,
  external_member_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at date not null default current_date,
  left_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, person_id),
  check (left_at is null or joined_at <= left_at),
  check (status <> 'inactive' or left_at is not null)
);

create index club_people_person_idx on public.club_people(person_id);
create unique index club_people_external_member_unique_idx
  on public.club_people(club_id, external_member_id)
  where external_member_id is not null;

create table public.club_role_assignments (
  id uuid primary key default gen_random_uuid(),
  club_person_id uuid not null references public.club_people(id) on delete restrict,
  role_type text not null check (role_type in (
    'trainer', 'assistant_trainer', 'goalkeeper_coach', 'team_manager', 'scout',
    'hospitality_worker', 'volunteer', 'board_member', 'club_employee'
  )),
  club_team_id uuid references public.club_teams(id) on delete restrict,
  valid_from date not null default current_date,
  valid_until date,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'ended')),
  created_by uuid references public.profiles(id) on delete set null,
  ended_by uuid references public.profiles(id) on delete set null,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (valid_until is null or valid_from <= valid_until),
  check (
    (status = 'ended' and valid_until is not null and ended_at is not null)
    or status <> 'ended'
  )
);

create index club_role_assignments_person_idx
  on public.club_role_assignments(club_person_id);
create index club_role_assignments_team_idx
  on public.club_role_assignments(club_team_id)
  where club_team_id is not null;
create unique index club_role_assignments_no_exact_active_duplicate_idx
  on public.club_role_assignments(
    club_person_id,
    role_type,
    coalesce(club_team_id, '00000000-0000-0000-0000-000000000000'::uuid),
    valid_from
  )
  where status = 'active';

create table public.person_claim_reviews (
  id uuid primary key default gen_random_uuid(),
  requested_profile_id uuid not null references public.profiles(id) on delete restrict,
  candidate_person_id uuid references public.people(id) on delete restrict,
  club_id uuid references public.clubs(id) on delete restrict,
  reason text not null check (reason in ('name_match', 'email_match', 'ambiguous_match', 'manual_request')),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (status = 'pending' and reviewed_at is null)
    or (status <> 'pending' and reviewed_at is not null)
  )
);

create table public.person_migration_issues (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  source_type text not null
    check (source_type in ('club_player', 'club_trainer', 'club_membership')),
  source_id uuid not null,
  candidate_person_id uuid references public.people(id) on delete restrict,
  issue_type text not null check (issue_type in (
    'possible_cross_identity_match', 'missing_date_of_birth',
    'conflicting_contact_data', 'ambiguous_name_match'
  )),
  issue_key text not null unique,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'ignored')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.identity_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  club_id uuid references public.clubs(id) on delete restrict,
  action text not null check (action in (
    'person_created', 'person_merged', 'club_person_created', 'club_person_ended',
    'account_linked', 'account_link_revoked', 'role_assigned', 'role_ended',
    'claim_review_created', 'claim_review_resolved', 'identity_manual_correction'
  )),
  target_table text not null,
  target_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index identity_audit_log_target_idx
  on public.identity_audit_log(target_table, target_id, created_at);
create index identity_audit_log_club_idx
  on public.identity_audit_log(club_id, created_at)
  where club_id is not null;

-- Nullable compatibility links only. Existing rows remain untouched and readable.
alter table public.club_players
  add column club_person_id uuid references public.club_people(id) on delete set null;
create unique index club_players_club_person_unique_idx
  on public.club_players(club_person_id) where club_person_id is not null;

alter table public.club_trainers
  add column club_person_id uuid references public.club_people(id) on delete restrict;
create unique index club_trainers_club_person_unique_idx
  on public.club_trainers(club_person_id) where club_person_id is not null;

alter table public.club_trainer_teams
  add column club_role_assignment_id uuid references public.club_role_assignments(id) on delete restrict;
create unique index club_trainer_teams_role_assignment_unique_idx
  on public.club_trainer_teams(club_role_assignment_id)
  where club_role_assignment_id is not null;

-- Once a legacy row is mapped, authenticated callers may no longer maintain it as a
-- second source of truth. Canonical SECURITY DEFINER commands run as the database owner.
create or replace function public.protect_identity_compatibility_projection()
returns trigger language plpgsql set search_path = public as $$
declare
  is_mapped boolean := false;
begin
  if tg_table_name = 'club_trainers' then
    if tg_op = 'INSERT' then is_mapped := new.club_person_id is not null;
    elsif tg_op = 'DELETE' then is_mapped := old.club_person_id is not null;
    else is_mapped := new.club_person_id is not null or old.club_person_id is not null;
    end if;
  else
    if tg_op = 'INSERT' then is_mapped := new.club_role_assignment_id is not null;
    elsif tg_op = 'DELETE' then is_mapped := old.club_role_assignment_id is not null;
    else is_mapped := new.club_role_assignment_id is not null or old.club_role_assignment_id is not null;
    end if;
  end if;

  if current_user not in ('postgres', 'service_role', 'supabase_admin') and is_mapped then
    raise exception 'IDENTITY_COMPATIBILITY_PROJECTION_READ_ONLY';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger trg_protect_club_trainer_projection
  before insert or update or delete on public.club_trainers
  for each row execute function public.protect_identity_compatibility_projection();

create trigger trg_protect_club_trainer_team_projection
  before insert or update or delete on public.club_trainer_teams
  for each row execute function public.protect_identity_compatibility_projection();

create or replace function public.enforce_club_person_reference_match()
returns trigger language plpgsql set search_path = public as $$
declare
  referenced_club_id uuid;
begin
  select club_id into referenced_club_id
  from public.club_people
  where id = new.club_person_id;

  if referenced_club_id is null or referenced_club_id <> new.club_id then
    raise exception 'CLUB_PERSON_CLUB_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger trg_club_players_club_person_match
  before insert or update of club_id, club_person_id on public.club_players
  for each row when (new.club_person_id is not null)
  execute function public.enforce_club_person_reference_match();

create trigger trg_club_trainers_club_person_match
  before insert or update of club_id, club_person_id on public.club_trainers
  for each row when (new.club_person_id is not null)
  execute function public.enforce_club_person_reference_match();

create or replace function public.enforce_club_role_team_match()
returns trigger language plpgsql set search_path = public as $$
declare
  person_club_id uuid;
  team_club_id uuid;
begin
  select club_id into person_club_id from public.club_people where id = new.club_person_id;
  if person_club_id is null then raise exception 'CLUB_PERSON_NOT_FOUND'; end if;

  if new.club_team_id is not null then
    select club_id into team_club_id from public.club_teams where id = new.club_team_id;
    if team_club_id is null then raise exception 'CLUB_TEAM_NOT_FOUND'; end if;
    if team_club_id <> person_club_id then raise exception 'CLUB_ROLE_TEAM_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

create trigger trg_club_role_team_match
  before insert or update of club_person_id, club_team_id on public.club_role_assignments
  for each row execute function public.enforce_club_role_team_match();

create trigger trg_people_updated_at before update on public.people
  for each row execute function public.set_updated_at();
create trigger trg_person_accounts_updated_at before update on public.person_accounts
  for each row execute function public.set_updated_at();
create trigger trg_club_people_updated_at before update on public.club_people
  for each row execute function public.set_updated_at();
create trigger trg_club_role_assignments_updated_at before update on public.club_role_assignments
  for each row execute function public.set_updated_at();
create trigger trg_person_claim_reviews_updated_at before update on public.person_claim_reviews
  for each row execute function public.set_updated_at();

alter table public.people enable row level security;
alter table public.person_accounts enable row level security;
alter table public.club_people enable row level security;
alter table public.club_role_assignments enable row level security;
alter table public.person_claim_reviews enable row level security;
alter table public.person_migration_issues enable row level security;
alter table public.identity_audit_log enable row level security;

-- People are never exposed as a club-independent directory. Club-scoped searches use a
-- security-definer RPC added in a later phase.
create policy "Account holders read own active person link"
on public.person_accounts for select
using (profile_id = auth.uid());

create policy "Club admins read club people"
on public.club_people for select
using (public.is_active_club_admin(club_id, auth.uid()));

create policy "Account holders read own club person"
on public.club_people for select
using (exists (
  select 1 from public.person_accounts pa
  where pa.person_id = club_people.person_id
    and pa.profile_id = auth.uid()
    and pa.status = 'active' and pa.revoked_at is null
));

create policy "Club admins read club roles"
on public.club_role_assignments for select
using (exists (
  select 1 from public.club_people cp
  where cp.id = club_role_assignments.club_person_id
    and public.is_active_club_admin(cp.club_id, auth.uid())
));

create policy "Account holders read own club roles"
on public.club_role_assignments for select
using (exists (
  select 1
  from public.club_people cp
  join public.person_accounts pa on pa.person_id = cp.person_id
  where cp.id = club_role_assignments.club_person_id
    and pa.profile_id = auth.uid()
    and pa.status = 'active' and pa.revoked_at is null
));

create policy "Club admins read claim reviews"
on public.person_claim_reviews for select
using (club_id is not null and public.is_active_club_admin(club_id, auth.uid()));

create policy "Users read own claim reviews"
on public.person_claim_reviews for select
using (requested_profile_id = auth.uid());

create policy "Club admins read person migration issues"
on public.person_migration_issues for select
using (public.is_active_club_admin(club_id, auth.uid()));

create policy "Club admins read identity audit"
on public.identity_audit_log for select
using (club_id is not null and public.is_active_club_admin(club_id, auth.uid()));

revoke all on public.people, public.person_accounts, public.club_people,
  public.club_role_assignments, public.person_claim_reviews,
  public.person_migration_issues, public.identity_audit_log
from anon, authenticated;

grant select on public.person_accounts, public.club_people, public.club_role_assignments,
  public.person_claim_reviews, public.person_migration_issues, public.identity_audit_log
to authenticated;

notify pgrst, 'reload schema';
