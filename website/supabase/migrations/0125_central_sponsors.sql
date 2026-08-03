-- Central sponsor identity and season/period assignments.
-- Financial fields are intentionally absent: CBCS does not manage sponsor income,
-- invoices, payments or contract values.

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  company_name text not null check (trim(company_name) <> ''),
  logo_url text,
  alternate_logo_url text,
  website_url text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create unique index sponsors_club_company_name_unique
  on public.sponsors(club_id, lower(trim(company_name)));
create index sponsors_club_active_idx on public.sponsors(club_id, active, company_name);

-- Contact details and operational notes are kept away from broadly reusable
-- sponsor presentation data so APIs can enforce a stricter permission.
create table public.sponsor_private_details (
  sponsor_id uuid primary key references public.sponsors(id) on delete cascade,
  contact_name text,
  contact_email text,
  contact_phone text,
  internal_note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.sponsor_assets (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  asset_type text not null check (asset_type in ('logo_default', 'logo_light', 'logo_dark', 'image', 'video')),
  asset_url text not null check (trim(asset_url) <> ''),
  label text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (sponsor_id, asset_type, asset_url)
);

create table public.sponsor_assignments (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete restrict,
  season_id uuid references public.club_seasons(id) on delete restrict,
  starts_on date,
  ends_on date,
  sponsor_level text not null default 'sponsor'
    check (sponsor_level in ('main_sponsor', 'partner', 'sponsor', 'other')),
  status text not null default 'active' check (status in ('draft', 'active', 'inactive')),
  operational_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
create index sponsor_assignments_context_idx
  on public.sponsor_assignments(club_id, season_id, status);

create or replace function public.enforce_sponsor_assignment_club_match()
returns trigger language plpgsql set search_path = public as $$
declare sponsor_club_id uuid; season_club_id uuid;
begin
  select club_id into sponsor_club_id from public.sponsors where id = new.sponsor_id;
  if sponsor_club_id is null or sponsor_club_id <> new.club_id then
    raise exception 'SPONSOR_CLUB_MISMATCH';
  end if;
  if new.season_id is not null then
    select club_id into season_club_id from public.club_seasons where id = new.season_id;
    if season_club_id is null or season_club_id <> new.club_id then
      raise exception 'SPONSOR_SEASON_CLUB_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_sponsor_assignment_club_match
  before insert or update of sponsor_id, club_id, season_id on public.sponsor_assignments
  for each row execute function public.enforce_sponsor_assignment_club_match();

create trigger trg_sponsors_updated_at before update on public.sponsors
  for each row execute function public.set_updated_at();
create trigger trg_sponsor_private_details_updated_at before update on public.sponsor_private_details
  for each row execute function public.set_updated_at();
create trigger trg_sponsor_assignments_updated_at before update on public.sponsor_assignments
  for each row execute function public.set_updated_at();

-- Preserve and inventory every legacy image without guessing that a composite
-- banner or repeated URL represents one particular company. Mapping happens in
-- the later Teamsponsor integration and old columns remain live until verified.
create table public.sponsor_legacy_sources (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  source_type text not null check (source_type in ('club_general', 'team')),
  source_id uuid not null,
  source_url text not null,
  mapped_sponsor_id uuid references public.sponsors(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'mapped', 'ignored')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_type, source_id)
);
insert into public.sponsor_legacy_sources(club_id, source_type, source_id, source_url)
select id, 'club_general', id, general_sponsor_url from public.clubs
where general_sponsor_url is not null
on conflict (source_type, source_id) do nothing;
insert into public.sponsor_legacy_sources(club_id, source_type, source_id, source_url)
select club_id, 'team', id, sponsor_url from public.club_teams
where sponsor_url is not null
on conflict (source_type, source_id) do nothing;

alter table public.sponsors enable row level security;
alter table public.sponsor_private_details enable row level security;
alter table public.sponsor_assets enable row level security;
alter table public.sponsor_assignments enable row level security;
alter table public.sponsor_legacy_sources enable row level security;

-- Sponsor mutations run through permission-checked server routes. No direct
-- authenticated table grants are added here.
notify pgrst, 'reload schema';


