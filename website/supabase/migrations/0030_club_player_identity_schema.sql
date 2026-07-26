-- Club-brede spelersidentiteit + seizoensbeheer + multi-team-lidmaatschap: schema only.
-- Zuiver additief: geen bestaande tabel/kolom/policy wordt gewijzigd of verwijderd, geen
-- data-migratie. De backfill zit in een aparte migratie (0031) die pas na een handmatige
-- dry-run-review tegen productie wordt toegepast.
-- Zie website/docs/club-player-identity-and-seasons-plan.md voor de volledige context.

-- ---------------------------------------------------------------------------
-- Herbruikbare helpers
-- ---------------------------------------------------------------------------

-- "language sql" zou hier inline-baar zijn: de planner kan een eenvoudige SQL-functie in de
-- aanroepende query substitueren, waardoor de SECURITY DEFINER-verhoging verloren gaat en de
-- query alsnog met de rechten van de AANROEPER op club_memberships zou botsen (zelfde klasse
-- probleem als de generated-column/unaccent-inlining verderop in dit bestand). "language
-- plpgsql" wordt nooit geïnlined, dus de verhoging blijft altijd gelden, ongeacht welke
-- basisrechten de aanroepende rol toevallig al dan niet heeft.
create or replace function public.is_active_club_admin(target_club_id uuid, target_user_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.club_memberships cm
    where cm.club_id = target_club_id and cm.profile_id = target_user_id
      and cm.role = 'club_admin' and cm.status = 'active'
  );
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- club_seasons
-- ---------------------------------------------------------------------------

create table public.club_seasons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (club_id, name),
  check (starts_on <= ends_on)
);

create unique index club_seasons_one_active_idx
  on public.club_seasons(club_id) where is_active;

-- Transactioneel activeren: deactiveert eerst elk ander actief seizoen van de club, activeert
-- daarna de opgegeven rij, en valideert dat die rij echt bij de club hoort (voorkomt zowel de
-- unique-violation op club_seasons_one_active_idx als het per ongeluk activeren van een
-- seizoen van een andere club).
create or replace function public.set_active_club_season(target_club_id uuid, target_season_id uuid)
returns void
language plpgsql as $$
begin
  update public.club_seasons set is_active = false
    where club_id = target_club_id and id <> target_season_id and is_active;

  update public.club_seasons set is_active = true
    where id = target_season_id and club_id = target_club_id;

  if not found then
    raise exception 'SEASON_NOT_FOUND_FOR_CLUB';
  end if;
end;
$$;

-- Belgisch voetbalseizoen: juli t.e.m. juni.
create or replace function public.current_football_season_bounds()
returns table(name text, starts_on date, ends_on date)
language sql stable as $$
  select
    case when extract(month from d) >= 7
      then extract(year from d)::text || '-' || (extract(year from d)::int + 1)::text
      else (extract(year from d)::int - 1)::text || '-' || extract(year from d)::text end,
    case when extract(month from d) >= 7
      then make_date(extract(year from d)::int, 7, 1)
      else make_date(extract(year from d)::int - 1, 7, 1) end,
    case when extract(month from d) >= 7
      then make_date(extract(year from d)::int + 1, 6, 30)
      else make_date(extract(year from d)::int, 6, 30) end
  from (select (now() at time zone 'Europe/Brussels')::date as d) x;
$$;

-- ---------------------------------------------------------------------------
-- club_players: club-brede speleridentiteit met robuuste matchsleutel
-- ---------------------------------------------------------------------------

create extension if not exists unaccent;

-- unaccent() is STABLE, niet IMMUTABLE, en mag daarom niet rechtstreeks in een generated
-- column. Een "language sql"-wrapper volstaat niet: Postgres inlinet zulke eenvoudige
-- SQL-functies in de aanroepende query, waardoor de onderliggende unaccent()-aanroep alsnog
-- zichtbaar wordt voor de immutability-check van de generated column. Als "language plpgsql"
-- wordt de functie NIET geïnlined en telt enkel de hier expliciet opgegeven immutable-markering
-- (gedocumenteerd Postgres-patroon voor deze exacte situatie).
create or replace function public.immutable_unaccent(text)
returns text
language plpgsql immutable as $$
begin
  return unaccent('unaccent', $1);
end;
$$;

-- Normaliseert een naam voor matching: lowercase, accenten weg, en apostrofs/koppeltekens/
-- punten/spaties weg. Laat "Van den Berg"/"Vandenberg", "D'Haene"/"Dhaene",
-- "De Busschere"/"De-Busschere", "Émile"/"Emile" en "Louis-Jan"/"Louis Jan" correct samenvallen.
-- "language sql" zou hier opnieuw inline-baar zijn (zie de opmerking bij immutable_unaccent
-- hierboven) en zo alsnog de onderliggende volatiliteit blootleggen aan de generated column
-- verderop. plpgsql voorkomt dat voor de hele keten.
create or replace function public.normalize_person_name(raw text)
returns text
language plpgsql immutable as $$
begin
  return lower(
    regexp_replace(public.immutable_unaccent(coalesce(raw, '')), '[''\-\.\s]', '', 'g')
  );
end;
$$;

-- date::text is STABLE (de output hangt af van de sessie-instelling DateStyle), en dus niet
-- toegestaan in een generated column. Deze functie bouwt een sessie-onafhankelijke, canonieke
-- 'YYYY-MM-DD'-tekst puur met extract()/lpad(), wat wel immutable is. Gebruikt in match_key
-- hieronder én in de backfill (0031) -- beide MOETEN exact dezelfde formule gebruiken, anders
-- matcht de backfill niet meer met wat er effectief in match_key staat opgeslagen.
create or replace function public.immutable_date_text(d date)
returns text
language sql immutable as $$
  select lpad(extract(year from d)::text, 4, '0') || '-' ||
         lpad(extract(month from d)::text, 2, '0') || '-' ||
         lpad(extract(day from d)::text, 2, '0');
$$;

create table public.club_players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date, -- bewust nullable: legacy spelers zonder geboortedatum bestaan al
  email text,
  phone text,
  phone_2 text,
  phone_2_name text,
  phone_3 text,
  phone_3_name text,
  address text,
  postal_code text,
  city text,
  match_key text generated always as (
    public.normalize_person_name(first_name) || '|' ||
    public.normalize_person_name(last_name) || '|' ||
    -- Onbekende geboortedatum -> val terug op de eigen id, zodat namesakes zonder DOB nooit
    -- per ongeluk automatisch worden samengevoegd (elke krijgt een unieke sleutel).
    coalesce(public.immutable_date_text(date_of_birth), 'nodob-' || id::text)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index club_players_match_key_idx on public.club_players(club_id, match_key);

create trigger trg_club_players_updated_at
  before update on public.club_players
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- player_team_memberships: canonieke bron van teamlidmaatschap (many-to-many, seizoensgebonden)
-- ---------------------------------------------------------------------------

create table public.player_team_memberships (
  id uuid primary key default gen_random_uuid(),
  club_player_id uuid not null references public.club_players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.club_seasons(id) on delete cascade,
  membership_type text not null default 'secondary'
    check (membership_type in ('primary', 'secondary', 'guest')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'ended')),
  joined_at date not null default current_date,
  left_at date,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_player_id, team_id, season_id),
  check (left_at is null or joined_at <= left_at),
  check (valid_from is null or valid_until is null or valid_from <= valid_until),
  check (status <> 'ended' or left_at is not null)
);

-- Ten hoogste 1 actief 'primary'-team per club_player per seizoen.
create unique index player_team_memberships_one_primary_idx
  on public.player_team_memberships(club_player_id, season_id)
  where membership_type = 'primary' and status = 'active';

create index player_team_memberships_team_idx on public.player_team_memberships(team_id);
create index player_team_memberships_club_player_idx on public.player_team_memberships(club_player_id);

create trigger trg_player_team_memberships_updated_at
  before update on public.player_team_memberships
  for each row execute function public.set_updated_at();

-- Clubgrenzen afdwingen op databaseniveau: een gewone FK verhindert niet dat een club_player
-- van club A aan een team of seizoen van club B gekoppeld wordt.
create or replace function public.enforce_membership_club_match()
returns trigger
language plpgsql as $$
declare
  v_player_club uuid;
  v_team_club uuid;
  v_season_club uuid;
begin
  select cp.club_id into v_player_club from public.club_players cp where cp.id = new.club_player_id;
  select ct.club_id into v_team_club
    from public.teams t join public.club_teams ct on ct.id = t.club_team_id
    where t.id = new.team_id;
  select cs.club_id into v_season_club from public.club_seasons cs where cs.id = new.season_id;

  if v_team_club is null then
    raise exception 'MEMBERSHIP_TEAM_NOT_A_CLUB_TEAM';
  end if;
  if v_season_club is null then
    raise exception 'MEMBERSHIP_SEASON_NOT_FOUND';
  end if;
  if v_player_club is distinct from v_team_club then
    raise exception 'MEMBERSHIP_CLUB_MISMATCH';
  end if;
  if v_player_club is distinct from v_season_club then
    raise exception 'MEMBERSHIP_SEASON_CLUB_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_membership_club_match
  before insert or update on public.player_team_memberships
  for each row execute function public.enforce_membership_club_match();

-- ---------------------------------------------------------------------------
-- players.membership_id: enige koppelpunt tussen de operationele players-rij (die
-- tags/clips/matches blijft dragen) en de canonieke membership. Geen aparte club_player_id
-- op players -- dat zou een tweede, mogelijk tegenstrijdige waarheid zijn.
-- ---------------------------------------------------------------------------

alter table public.players
  add column membership_id uuid references public.player_team_memberships(id) on delete set null;

-- Ten hoogste 1 operationele players-rij per membership.
create unique index players_membership_unique_idx
  on public.players(membership_id) where membership_id is not null;

-- ---------------------------------------------------------------------------
-- Reviewtabel voor de backfill (0031) en toekomstige data-kwaliteitsissues.
-- ---------------------------------------------------------------------------

create table public.club_player_migration_issues (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  legacy_player_id uuid references public.players(id) on delete set null,
  candidate_club_player_id uuid references public.club_players(id) on delete set null,
  issue_type text not null check (issue_type in (
    'duplicate_membership', 'missing_date_of_birth', 'possible_name_match',
    'conflicting_contact_data', 'unassigned_primary_team'
  )),
  -- Deterministisch opgebouwd door de aanroepende code, zodat herhaalde runs nooit
  -- dezelfde issue dupliceren (on conflict (issue_key) do nothing).
  issue_key text not null unique,
  details jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);

alter table public.club_player_migration_issues enable row level security;

create policy "Club admins manage migration issues" on public.club_player_migration_issues
  for all using (public.is_active_club_admin(club_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- RLS: kijken vs. beheren zijn losse rechten; identiteitsvelden zijn club-admin-only.
-- ---------------------------------------------------------------------------

-- KIJKEN: elke actief toegewezen trainer, ongeacht rosterrechten (spiegelt de bestaande
-- select-policy op players uit 0023_club_team_rosters.sql -- "zien" hangt daar ook niet af
-- van "mogen bewerken").
-- "language plpgsql" i.p.v. "language sql": zelfde inlining-risico als is_active_club_admin
-- hierboven -- can_manage_club_roster (0023) is zelf ook "language sql security definer" en
-- zou bij inlining zijn eigen verhoging verliezen, wat de club_trainer_teams/club_trainers-
-- lookup hieronder alsnog aan de rechten van de aanroeper zou onderwerpen.
create or replace function public.can_view_team_membership(target_team_id uuid, target_user_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return public.can_manage_club_roster(target_team_id, target_user_id) or exists (
    select 1 from public.club_trainer_teams ctt
    join public.club_trainers ctr on ctr.id = ctt.trainer_id
    join public.teams t on t.club_team_id = ctt.club_team_id
    where t.id = target_team_id and ctr.profile_id = target_user_id and ctt.status = 'active'
  );
end;
$$;

-- BEHEREN: hergebruikt de bestaande edit-check (club_admin of trainers_can_edit_roster) uit
-- 0023_club_team_rosters.sql, hernoemd/omwikkeld voor duidelijkheid binnen dit nieuwe domein.
create or replace function public.can_manage_team_membership(target_team_id uuid, target_user_id uuid)
returns boolean
language sql stable as $$
  select public.can_manage_club_roster(target_team_id, target_user_id);
$$;

alter table public.club_seasons enable row level security;
alter table public.club_players enable row level security;
alter table public.player_team_memberships enable row level security;

create policy "Club members can view seasons" on public.club_seasons for select
  using (
    public.is_active_club_admin(club_id, auth.uid())
    or exists (
      select 1 from public.club_trainer_teams ctt
      join public.club_trainers ctr on ctr.id = ctt.trainer_id
      join public.club_teams ct on ct.id = ctt.club_team_id
      where ct.club_id = club_seasons.club_id and ctr.profile_id = auth.uid() and ctt.status = 'active'
    )
  );

create policy "Club admins manage seasons" on public.club_seasons for all
  using (public.is_active_club_admin(club_id, auth.uid()));

-- club_players: KIJKEN beperkt tot spelers die de trainer effectief deelt via een eigen team
-- (geen clubbrede toegang tot persoonsgegevens); BEHEREN (insert/update/delete) is
-- club-admin-only. Een trainer maakt een nieuwe clubspeler enkel via
-- create_club_player_with_membership() hieronder.
create policy "Club admins and sharing trainers can view club players" on public.club_players
  for select using (
    public.is_active_club_admin(club_players.club_id, auth.uid())
    or exists (
      select 1 from public.player_team_memberships ptm
      where ptm.club_player_id = club_players.id
        and public.can_view_team_membership(ptm.team_id, auth.uid())
    )
  );

create policy "Club admins can insert club players" on public.club_players
  for insert with check (public.is_active_club_admin(club_id, auth.uid()));

create policy "Club admins can update club players" on public.club_players
  for update using (public.is_active_club_admin(club_players.club_id, auth.uid()))
  with check (public.is_active_club_admin(club_players.club_id, auth.uid()));

create policy "Club admins can delete club players" on public.club_players
  for delete using (public.is_active_club_admin(club_players.club_id, auth.uid()));

-- player_team_memberships: KIJKEN breder dan BEHEREN, team-scoped.
create policy "Assigned club users can view memberships" on public.player_team_memberships
  for select using (public.can_view_team_membership(team_id, auth.uid()));

create policy "Authorized club users can insert memberships" on public.player_team_memberships
  for insert with check (public.can_manage_team_membership(team_id, auth.uid()));

create policy "Authorized club users can update memberships" on public.player_team_memberships
  for update using (public.can_manage_team_membership(team_id, auth.uid()))
  with check (public.can_manage_team_membership(team_id, auth.uid()));

create policy "Authorized club users can delete memberships" on public.player_team_memberships
  for delete using (public.can_manage_team_membership(team_id, auth.uid()));

-- Basisgrant voor de authenticated-rol: RLS filtert de RIJEN, maar zonder deze GRANT wordt
-- elke query op deze tabellen geweigerd ongeacht RLS ("permission denied for table ..."),
-- net zoals bij players/club_teams/etc elders in dit project. anon krijgt bewust niets: geen
-- enkele policy hierboven staat anon-toegang toe, dus een grant zou toch nergens rijen opleveren.
grant select, insert, update, delete on public.club_seasons to authenticated;
grant select, insert, update, delete on public.club_players to authenticated;
grant select, insert, update, delete on public.player_team_memberships to authenticated;
grant select, insert, update, delete on public.club_player_migration_issues to authenticated;

-- ---------------------------------------------------------------------------
-- create_club_player_with_membership: de enige weg voor een trainer om een nieuwe clubspeler
-- te laten ontstaan. SECURITY DEFINER (zoals complete_club_team_onboarding in
-- 0021_club_team_onboarding.sql) zodat de insert lukt ondanks de club-admin-only RLS hierboven,
-- maar controleert zelf expliciet de rosterrechten op target_team_id vóór ze iets schrijft --
-- een trainer kan hiermee dus nooit een clubspeler "los" aanmaken zonder dat die meteen aan
-- zijn eigen team hangt.
-- ---------------------------------------------------------------------------

create or replace function public.create_club_player_with_membership(
  target_team_id uuid,
  target_season_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date default null,
  p_email text default null,
  p_phone text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_club_player_id uuid;
begin
  if not public.can_manage_team_membership(target_team_id, auth.uid()) then
    raise exception 'CREATE_PLAYER_FORBIDDEN';
  end if;

  select ct.club_id into v_club_id
    from public.teams t join public.club_teams ct on ct.id = t.club_team_id
    where t.id = target_team_id;
  if v_club_id is null then
    raise exception 'TEAM_NOT_A_CLUB_TEAM';
  end if;

  insert into public.club_players (club_id, first_name, last_name, date_of_birth, email, phone)
  values (v_club_id, p_first_name, p_last_name, p_date_of_birth, p_email, p_phone)
  on conflict (club_id, match_key) do update set updated_at = now()
  returning id into v_club_player_id;

  insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
  values (v_club_player_id, target_team_id, target_season_id, 'secondary')
  on conflict (club_player_id, team_id, season_id) do update set updated_at = now();

  return v_club_player_id;
end;
$$;

revoke all on function public.create_club_player_with_membership(uuid, uuid, text, text, date, text, text) from public, anon;
grant execute on function public.create_club_player_with_membership(uuid, uuid, text, text, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- merge_club_players: gecontroleerde samenvoeging van dubbele identiteiten. Club-admin-only,
-- gebruikt auth.uid() intern (geen actor-parameter -- voorkomt dat een cliënt een willekeurige
-- admin-UUID meestuurt), en blokkeert volledig bij een onopgeloste overlap i.p.v. een
-- membership stilzwijgend te verwijderen en een operationele players-rij zonder identiteit
-- achter te laten.
-- ---------------------------------------------------------------------------

create or replace function public.merge_club_players(keep_id uuid, merge_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_keep_club uuid;
  v_merge_club uuid;
  v_overlap_count int;
begin
  select club_id into v_keep_club from public.club_players where id = keep_id;
  select club_id into v_merge_club from public.club_players where id = merge_id;
  if v_keep_club is null or v_merge_club is null or v_keep_club <> v_merge_club then
    raise exception 'MERGE_FORBIDDEN';
  end if;
  if not public.is_active_club_admin(v_keep_club, auth.uid()) then
    raise exception 'MERGE_FORBIDDEN';
  end if;

  select count(*) into v_overlap_count
    from public.player_team_memberships m
    where m.club_player_id = merge_id
      and exists (
        select 1 from public.player_team_memberships k
        where k.club_player_id = keep_id and k.team_id = m.team_id and k.season_id = m.season_id
      );
  if v_overlap_count > 0 then
    raise exception 'MERGE_CONFLICT_UNRESOLVED: % overlappende memberships', v_overlap_count;
  end if;

  -- Als een verplaatste membership 'primary' is en keep_id al een actieve 'primary' heeft
  -- voor datzelfde seizoen (via een ander team), demoteren naar 'secondary' i.p.v. de
  -- player_team_memberships_one_primary_idx te laten crashen. keep_id's bestaande primaire
  -- keuze krijgt voorrang -- de aanroeper koos expliciet welke rij "keep" is.
  update public.player_team_memberships m set
    club_player_id = keep_id,
    membership_type = case
      when m.membership_type = 'primary' and exists (
        select 1 from public.player_team_memberships k
        where k.club_player_id = keep_id and k.season_id = m.season_id
          and k.status = 'active' and k.membership_type = 'primary'
      ) then 'secondary'
      else m.membership_type
    end
  where m.club_player_id = merge_id;
  delete from public.club_players where id = merge_id;
end;
$$;

revoke all on function public.merge_club_players(uuid, uuid) from public, anon;
grant execute on function public.merge_club_players(uuid, uuid) to authenticated;
