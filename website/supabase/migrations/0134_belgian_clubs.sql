-- Centrale referentielijst van alle Belgische voetbalclubs, op RBFA-stamnummer.
-- Los van public.clubs (clubs die actief zijn aangemeld op CBCS): een club met
-- een stamnummer heeft altijd dezelfde naam/logo's, ongeacht of ze op CBCS zit.
create table if not exists public.belgian_clubs (
  id uuid primary key default gen_random_uuid(),
  stamnummer integer not null unique,
  naam text not null,
  small_logo_path text,
  large_logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.belgian_clubs is
  'Canonieke referentielijst van alle Belgische clubs op RBFA-stamnummer, onafhankelijk van public.clubs.';
comment on column public.belgian_clubs.small_logo_path is
  'R2-object-key onder belgian-clubs/small/, bv. belgian-clubs/small/822.webp. Gevuld via de bulk-seed.';
comment on column public.belgian_clubs.large_logo_path is
  'R2-object-key onder belgian-clubs/large/. Enkel gezet door een platform-admin via /dashboard/admin/belgian-clubs.';

create trigger trg_belgian_clubs_updated_at
  before update on public.belgian_clubs
  for each row execute function public.set_updated_at();

-- Naamvarianten die bij import naar dezelfde club moeten resolven
-- (bv. "K. Olsa Brakel" -> stamnummer van "Olsa Brakel").
create table if not exists public.club_name_aliases (
  id uuid primary key default gen_random_uuid(),
  alias text not null unique,
  belgian_club_id uuid not null references public.belgian_clubs(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.club_name_aliases is
  'Genormaliseerde naamvarianten die bij wedstrijdimport naar een belgian_clubs-rij moeten koppelen.';

-- Optionele koppeling: als een aangemelde club (public.clubs) ook in de
-- Belgische referentielijst staat, kan naam/logo van daar overgenomen worden.
alter table public.clubs
  add column if not exists stamnummer integer references public.belgian_clubs(stamnummer);

comment on column public.clubs.stamnummer is
  'Optionele koppeling naar de canonieke belgian_clubs-rij voor deze club, op RBFA-stamnummer.';

alter table public.belgian_clubs enable row level security;
alter table public.club_name_aliases enable row level security;

-- Publieke leesdata (clubnamen/logo-paden zijn niet gevoelig); schrijven
-- gebeurt uitsluitend via de service-role client in server actions, die RLS
-- omzeilt, dus er zijn bewust geen insert/update/delete policies nodig.
create policy "belgian_clubs_read_all" on public.belgian_clubs for select using (true);
create policy "club_name_aliases_read_all" on public.club_name_aliases for select using (true);

notify pgrst, 'reload schema';
