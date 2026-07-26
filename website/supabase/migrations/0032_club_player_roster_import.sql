-- Fase 2a: PSD-import herzien (enkel toevoegen/bijwerken-modus, nooit verwijderen).
-- Zie website/docs/club-player-identity-and-seasons-plan.md en het Fase 2a-plan.
--
-- Twee vertrouwensmodellen naast elkaar in deze migratie:
-- - ensure_active_club_season / upsert_club_player_contact_merge / import_roster_player_merge /
--   import_roster_rows_merge zijn NIET auth.uid()-gated: enkel bedoeld voor aanroep via
--   roster/route.ts's service-role admin-client (net als backfill_club_players_from_players in
--   0031). auth.uid() is null onder de admin-client, en de bestaande isAdminEmail()-escape-hatch
--   is een TypeScript-env-var-allowlist die een SQL-functie nooit zelf kan kennen. revoke all
--   from public, anon, authenticated op elk van deze vier.
-- - search_club_players_for_assignment / resolve_primary_membership zijn wel auth.uid()-gated
--   en grant ... to authenticated, want die worden in latere fases rechtstreeks vanaf een
--   ingelogde sessie aangeroepen (Fase 2b-UI).

-- ---------------------------------------------------------------------------
-- 1. ensure_active_club_season: lazy-creates het eerste seizoen voor een club zonder
-- club_seasons-rij. Identiek aan wat 0031 al inline doet voor de backfill.
-- ---------------------------------------------------------------------------

create or replace function public.ensure_active_club_season(target_club_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_season_id uuid;
  season_row record;
begin
  select id into v_season_id from public.club_seasons
    where club_id = target_club_id and is_active limit 1;
  if v_season_id is not null then
    return v_season_id;
  end if;

  select * into season_row from public.current_football_season_bounds();
  insert into public.club_seasons (club_id, name, starts_on, ends_on, is_active)
  values (target_club_id, season_row.name, season_row.starts_on, season_row.ends_on, false)
  on conflict (club_id, name) do nothing
  returning id into v_season_id;

  if v_season_id is null then
    select id into v_season_id from public.club_seasons
      where club_id = target_club_id and name = season_row.name;
  end if;

  perform public.set_active_club_season(target_club_id, v_season_id);
  return v_season_id;
end;
$$;

revoke all on function public.ensure_active_club_season(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. upsert_club_player_contact_merge: bewust GEDUPLICEERD (niet gerefactored) t.o.v. de
-- inline contactveld-merge-logica in 0031_backfill_club_player_identity.sql (leeg -> aanvullen,
-- verschillend -> conflicting_contact_data-issue, nooit stilzwijgend overschrijven). 0031 is al
-- getest en mogelijk al tegen productie uitgevoerd; ze mag niet vooruitwijzen naar een functie
-- die pas hier ontstaat, en blijft ongewijzigd als bevroren historisch record. Toekomstige
-- aanpassingen aan deze merge-regel raken enkel deze functie.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_club_player_contact_merge(
  target_club_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_email text,
  p_phone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_club_player_id uuid;
  v_existing_email text;
begin
  -- Lookup enkel zinvol met een gekende DOB: bij null-DOB valt de generated match_key terug op
  -- cp.id zelf (0030), dus vóór de insert bestaat er per definitie nooit een vindbare match --
  -- exact waarom naamgenoten zonder geboortedatum nooit automatisch samenvallen.
  if p_date_of_birth is not null then
    select email into v_existing_email from public.club_players
      where club_id = target_club_id
        and match_key = public.normalize_person_name(p_first_name) || '|' ||
                         public.normalize_person_name(p_last_name) || '|' ||
                         public.immutable_date_text(p_date_of_birth);

    if v_existing_email is not null and v_existing_email <> ''
       and p_email is not null and p_email <> '' and v_existing_email <> p_email then
      -- issue_key gebruikt de al-gevonden club_player + veld + dag (dedupe per speler/veld/dag,
      -- i.p.v. een ruwe timestamp die dedup zinloos zou maken).
      insert into public.club_player_migration_issues (club_id, candidate_club_player_id, issue_type, issue_key, details)
      select target_club_id, cp.id, 'conflicting_contact_data',
        'conflicting_contact_data:live:' || cp.id::text || ':email:' || current_date::text,
        jsonb_build_object('field', 'email', 'existing', v_existing_email, 'incoming', p_email)
      from public.club_players cp
      where cp.club_id = target_club_id
        and cp.match_key = public.normalize_person_name(p_first_name) || '|' ||
                            public.normalize_person_name(p_last_name) || '|' ||
                            public.immutable_date_text(p_date_of_birth)
      on conflict (issue_key) do nothing;
    end if;
  end if;

  insert into public.club_players (club_id, first_name, last_name, date_of_birth, email, phone)
  values (target_club_id, p_first_name, p_last_name, p_date_of_birth, p_email, p_phone)
  on conflict (club_id, match_key) do update set
    email = case when coalesce(club_players.email, '') = '' then excluded.email else club_players.email end,
    phone = case when coalesce(club_players.phone, '') = '' then excluded.phone else club_players.phone end,
    updated_at = now()
  returning id into v_club_player_id;

  return v_club_player_id;
end;
$$;

-- Enkel intern aanroepbaar (via SECURITY DEFINER-functies die als postgres draaien) -- schrijft
-- rechtstreeks identiteitsvelden en mag nooit los aanroepbaar zijn vanaf de browser.
revoke all on function public.upsert_club_player_contact_merge(uuid, text, text, date, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. import_roster_player_merge: per-speler-orkestratie voor de toevoegen/bijwerken-modus.
-- ---------------------------------------------------------------------------

create or replace function public.import_roster_player_merge(
  target_team_id uuid,
  target_season_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_email text,
  p_phone text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_club_player_id uuid;
  v_membership_id uuid;
  v_membership_type text;
  v_operational_player_id uuid;
  v_is_new_membership boolean;
begin
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'IMPORT_ROSTER_NAME_REQUIRED';
  end if;

  select ct.club_id into v_club_id
    from public.teams t join public.club_teams ct on ct.id = t.club_team_id where t.id = target_team_id;
  if v_club_id is null then
    raise exception 'TEAM_NOT_A_CLUB_TEAM';
  end if;
  if not exists (select 1 from public.club_seasons where id = target_season_id and club_id = v_club_id) then
    raise exception 'SEASON_NOT_FOUND_FOR_CLUB';
  end if;

  v_club_player_id := public.upsert_club_player_contact_merge(
    v_club_id, p_first_name, p_last_name, p_date_of_birth, p_email, p_phone);

  v_is_new_membership := not exists (
    select 1 from public.player_team_memberships
    where club_player_id = v_club_player_id and team_id = target_team_id and season_id = target_season_id
  );

  -- Enkel bij een VERSE membership beslissen tussen primary/secondary: een herimport van een
  -- bestaande membership laat membership_type ongemoeid (do update set updated_at), zodat een
  -- handmatig gezette 'guest' nooit teruggeforceerd wordt naar 'primary'.
  v_membership_type := case when exists (
    select 1 from public.player_team_memberships
    where club_player_id = v_club_player_id and season_id = target_season_id
      and team_id <> target_team_id and status = 'active' and membership_type = 'primary'
  ) then 'secondary' else 'primary' end;

  insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
  values (v_club_player_id, target_team_id, target_season_id, v_membership_type)
  on conflict (club_player_id, team_id, season_id) do update set updated_at = now()
  returning id into v_membership_id;

  select id into v_operational_player_id from public.players where membership_id = v_membership_id;
  if v_operational_player_id is null then
    insert into public.players (team_id, first_name, last_name, date_of_birth, email, phone_numbers, role, membership_id)
    values (target_team_id, p_first_name, p_last_name, p_date_of_birth, p_email,
      case when coalesce(p_phone, '') = '' then '{}'::text[] else array[p_phone] end, 'player', v_membership_id)
    returning id into v_operational_player_id;
  else
    update public.players set
      first_name = p_first_name,
      last_name = p_last_name,
      date_of_birth = p_date_of_birth,
      email = coalesce(nullif(p_email, ''), email),
      phone_numbers = case when coalesce(p_phone, '') = '' then phone_numbers else array[p_phone] end
    where id = v_operational_player_id;
  end if;

  return jsonb_build_object(
    'club_player_id', v_club_player_id, 'membership_id', v_membership_id,
    'operational_player_id', v_operational_player_id,
    'membership_type', v_membership_type, 'is_new_membership', v_is_new_membership
  );
end;
$$;

revoke all on function public.import_roster_player_merge(uuid, uuid, text, text, date, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. import_roster_rows_merge: batch-wrapper, één databasetransactie voor route.ts (1
-- RPC-round-trip). Elke rij krijgt een eigen savepoint (begin/exception): één foutieve rij
-- blokkeert de rest van de batch niet, maar de hele aanroep blijft één transactie -- een echte
-- infrastructuurfout (verbinding valt weg) rolt alles terug, wat veiliger is dan het vroegere
-- delete-then-insert (dat bij zo'n fout de roster leeg kon achterlaten).
-- ---------------------------------------------------------------------------

create or replace function public.import_roster_rows_merge(target_team_id uuid, p_players jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_club_id uuid;
  v_season_id uuid;
  v_row jsonb;
  v_index int := 0;
  v_saved int := 0;
  v_failed jsonb := '[]'::jsonb;
begin
  select ct.club_id into v_club_id
    from public.teams t join public.club_teams ct on ct.id = t.club_team_id where t.id = target_team_id;
  if v_club_id is null then
    raise exception 'TEAM_NOT_A_CLUB_TEAM';
  end if;

  v_season_id := public.ensure_active_club_season(v_club_id);

  for v_row in select * from jsonb_array_elements(p_players) loop
    v_index := v_index + 1;
    begin
      perform public.import_roster_player_merge(
        target_team_id, v_season_id,
        v_row->>'first_name', v_row->>'last_name',
        nullif(v_row->>'date_of_birth', '')::date,
        nullif(v_row->>'email', ''), nullif(v_row->>'phone', '')
      );
      v_saved := v_saved + 1;
    exception when others then
      v_failed := v_failed || jsonb_build_object('index', v_index - 1, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('season_id', v_season_id, 'saved', v_saved, 'failed', v_failed);
end;
$$;

revoke all on function public.import_roster_rows_merge(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. search_club_players_for_assignment: voorbereid voor Fase 2b ("voeg bestaande speler toe
-- aan ander team"). Clubbreed (elke actief toegewezen trainer/club_admin in de club, breder dan
-- can_view_team_membership dat enkel gedeelde teams dekt), maar veld-beperkt: nooit e-mail/
-- telefoon/adres in de return-kolommen, by construction.
-- ---------------------------------------------------------------------------

create or replace function public.search_club_players_for_assignment(
  target_club_id uuid, search_term text default ''
) returns table(
  club_player_id uuid, first_name text, last_name text,
  birth_year int, current_team_names text[]
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (
    public.is_active_club_admin(target_club_id, auth.uid())
    or exists (
      select 1 from public.club_trainer_teams ctt
      join public.club_trainers ctr on ctr.id = ctt.trainer_id
      where ctr.club_id = target_club_id and ctr.profile_id = auth.uid() and ctt.status = 'active'
    )
  ) then
    raise exception 'SEARCH_CLUB_PLAYERS_FORBIDDEN';
  end if;

  return query
  select cp.id, cp.first_name, cp.last_name,
    extract(year from cp.date_of_birth)::int,
    coalesce(array_agg(distinct ct.name) filter (where ptm.status = 'active' and ct.name is not null), '{}'::text[])
  from public.club_players cp
  left join public.player_team_memberships ptm on ptm.club_player_id = cp.id
  left join public.teams t on t.id = ptm.team_id
  left join public.club_teams ct on ct.id = t.club_team_id
  where cp.club_id = target_club_id
    and (
      trim(coalesce(search_term, '')) = ''
      or public.normalize_person_name(cp.first_name || ' ' || cp.last_name)
         like '%' || public.normalize_person_name(search_term) || '%'
    )
  group by cp.id, cp.first_name, cp.last_name, cp.date_of_birth
  order by cp.last_name, cp.first_name
  limit 30;
end;
$$;

revoke all on function public.search_club_players_for_assignment(uuid, text) from public, anon;
grant execute on function public.search_club_players_for_assignment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. resolve_primary_membership: voorbereid voor Fase 2b (UI om unassigned_primary_team-
-- reviewgevallen op te lossen).
-- ---------------------------------------------------------------------------

create or replace function public.resolve_primary_membership(
  target_club_player_id uuid, target_team_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_season_id uuid;
begin
  -- can_manage_team_membership dekt club_admin al intern (via can_manage_club_roster, 0023).
  if not public.can_manage_team_membership(target_team_id, auth.uid()) then
    raise exception 'RESOLVE_PRIMARY_FORBIDDEN';
  end if;

  select season_id into v_season_id from public.player_team_memberships
    where club_player_id = target_club_player_id and team_id = target_team_id and status = 'active';
  if v_season_id is null then
    raise exception 'MEMBERSHIP_NOT_FOUND';
  end if;

  update public.player_team_memberships
    set membership_type = 'secondary'
    where club_player_id = target_club_player_id and season_id = v_season_id
      and team_id <> target_team_id and status = 'active' and membership_type = 'primary';

  update public.player_team_memberships
    set membership_type = 'primary'
    where club_player_id = target_club_player_id and team_id = target_team_id
      and season_id = v_season_id and status = 'active';

  update public.club_player_migration_issues
    set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
    where issue_type = 'unassigned_primary_team' and status = 'open'
      and candidate_club_player_id = target_club_player_id
      and (details->>'season_id')::uuid = v_season_id;
end;
$$;

revoke all on function public.resolve_primary_membership(uuid, uuid) from public, anon;
grant execute on function public.resolve_primary_membership(uuid, uuid) to authenticated;
