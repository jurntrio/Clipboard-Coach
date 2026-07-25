-- Club management, trainer/team links and per-match visibility overrides.
create table if not exists public.clubs (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  rbfa_registration_number text,
  rbfa_external_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.club_teams (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  name text not null,
  rbfa_external_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (club_id, name)
);

create table if not exists public.club_trainers (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  invitation_status text not null default 'placeholder'
    check (invitation_status in ('placeholder', 'invited', 'linked')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (club_id, display_name)
);

create unique index if not exists club_trainers_club_profile_unique
  on public.club_trainers(club_id, profile_id) where profile_id is not null;

create table if not exists public.club_memberships (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'trainer' check (role in ('trainer', 'club_admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (club_id, profile_id)
);

create table if not exists public.club_trainer_teams (
  trainer_id uuid references public.club_trainers(id) on delete cascade not null,
  club_team_id uuid references public.club_teams(id) on delete cascade not null,
  primary key (trainer_id, club_team_id)
);

alter table public.matches
  add column if not exists club_id uuid references public.clubs(id) on delete set null,
  add column if not exists club_team_id uuid references public.club_teams(id) on delete set null,
  add column if not exists external_source text,
  add column if not exists external_match_id text;

create unique index if not exists matches_external_source_id_unique
  on public.matches(external_source, external_match_id)
  where external_source is not null and external_match_id is not null;

create table if not exists public.club_match_assignments (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  trainer_id uuid references public.club_trainers(id) on delete cascade not null,
  visible boolean not null default true,
  assignment_source text not null default 'automatic'
    check (assignment_source in ('automatic', 'manual')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (match_id, trainer_id)
);

create or replace function public.sync_club_match_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.club_team_id is null then
    return new;
  end if;

  insert into public.club_match_assignments (match_id, trainer_id, visible, assignment_source)
  select new.id, ctt.trainer_id, true, 'automatic'
  from public.club_trainer_teams ctt
  where ctt.club_team_id = new.club_team_id
  on conflict (match_id, trainer_id) do nothing;

  return new;
end;
$$;

drop trigger if exists sync_club_match_assignments_trigger on public.matches;
create trigger sync_club_match_assignments_trigger
after insert or update of club_team_id on public.matches
for each row execute function public.sync_club_match_assignments();

alter table public.clubs enable row level security;
alter table public.club_teams enable row level security;
alter table public.club_trainers enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_trainer_teams enable row level security;
alter table public.club_match_assignments enable row level security;

-- Club management is served through authenticated API routes with explicit
-- membership checks. The service role bypasses these tables' RLS.

create index if not exists idx_club_memberships_profile on public.club_memberships(profile_id);
create index if not exists idx_club_trainers_profile on public.club_trainers(profile_id);
create index if not exists idx_club_assignments_match on public.club_match_assignments(match_id);
create index if not exists idx_matches_club on public.matches(club_id);

-- Safe demo data: named trainer records are not login accounts.
insert into public.clubs (name) values ('KM Torhout')
on conflict (name) do nothing;

insert into public.club_teams (club_id, name)
select c.id, team_name
from public.clubs c
cross join unnest(array['U12C','U13A','U13B','U13C','U14A','U14B','U14C','U15A']) team_name
where c.name = 'KM Torhout'
on conflict (club_id, name) do nothing;

insert into public.club_trainers (club_id, display_name)
select c.id, trainer_name
from public.clubs c
cross join unnest(array[
  'Dries Termote','Jurn Trio','Claude Beernaert','Jean-Pierre Michils',
  'Lennert Cornette','Lesly Annys','Jelle Pattyn'
]) trainer_name
where c.name = 'KM Torhout'
on conflict (club_id, display_name) do nothing;

update public.club_trainers ct
set profile_id = p.id, invitation_status = 'linked'
from public.profiles p
where ct.display_name = 'Jurn Trio'
  and lower(p.email) = 'jurntrio@gmail.com'
  and ct.club_id = (select id from public.clubs where name = 'KM Torhout');

update public.club_trainers ct
set profile_id = p.id, invitation_status = 'linked'
from public.profiles p
where ct.display_name = 'Dries Termote'
  and (
    lower(trim(coalesce(p.full_name, ''))) in ('dries termote', 'termote dries')
    or lower(p.email) = 'dries_termote@hotmail.com'
  )
  and ct.club_id = (select id from public.clubs where name = 'KM Torhout');

insert into public.club_memberships (club_id, profile_id, role)
select ct.club_id, ct.profile_id,
  case when ct.display_name = 'Jurn Trio' then 'club_admin' else 'trainer' end
from public.club_trainers ct
where ct.profile_id is not null and ct.display_name in ('Jurn Trio', 'Dries Termote')
on conflict (club_id, profile_id) do update set role = excluded.role;

insert into public.club_trainer_teams (trainer_id, club_team_id)
select ct.id, team.id
from public.club_trainers ct
join public.clubs c on c.id = ct.club_id and c.name = 'KM Torhout'
join public.club_teams team on team.club_id = c.id
where
  (ct.display_name = 'Dries Termote' and team.name in ('U13A','U13B')) or
  (ct.display_name = 'Jurn Trio' and team.name in ('U13A','U13B')) or
  (ct.display_name = 'Claude Beernaert' and team.name = 'U13C') or
  (ct.display_name = 'Jean-Pierre Michils' and team.name in ('U12C','U14C')) or
  (ct.display_name = 'Lennert Cornette' and team.name = 'U14A') or
  (ct.display_name = 'Lesly Annys' and team.name = 'U14B') or
  (ct.display_name = 'Jelle Pattyn' and team.name = 'U15A')
on conflict do nothing;

notify pgrst, 'reload schema';
