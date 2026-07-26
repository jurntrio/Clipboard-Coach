-- Backfill van bestaande players-rijen naar de nieuwe club_players/player_team_memberships-
-- structuur uit 0030. Deze migratie definieert de backfill-functie maar VOERT ZE NIET UIT.
--
-- Vereiste volgorde (zie website/docs/club-player-identity-and-seasons-plan.md):
--   1. Dry-run-rapportquery's tegen een kopie van de productiedata draaien (exacte matches,
--      near-misses via pg_trgm/similarity(), ontbrekende geboortedatums).
--   2. Clubadmin neemt de lijst door, corrigeert evidente typfouten in players.date_of_birth.
--   3. Pas dan handmatig uitvoeren, als postgres/service-role:
--        select public.backfill_club_players_from_players();
--   4. Nadien club_player_migration_issues doorlopen (vooral 'unassigned_primary_team',
--      de verwachte manier waarop multi-team-kinderen om een bewuste primaire-teamkeuze vragen).
--
-- De functie is idempotent (herhaald draaien maakt geen duplicaten en geen extra reviewrijen)
-- en run-scoped (de primary-promotie raakt nooit memberships buiten de huidige aanroep).

create or replace function public.backfill_club_players_from_players()
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_club_player_id uuid;
  v_season_id uuid;
  v_membership_id uuid;
  season_row record;
  v_run_membership_ids uuid[] := '{}';
  v_existing_email text;
begin
  for r in
    select p.id as player_id, p.first_name, p.last_name, p.date_of_birth,
           p.email, p.phone_numbers, ct.club_id, t.id as team_id
    from public.players p
    join public.teams t on t.id = p.team_id
    join public.club_teams ct on ct.id = t.club_team_id -- sluit persoonlijke (niet-club) teams uit
    where coalesce(p.role, 'player') = 'player'
      and p.membership_id is null -- idempotentie: al gekoppelde rijen overslaan
  loop
    -- Eén actief seizoen per club; aanmaken via set_active_club_season (nooit rechtstreeks
    -- is_active=true invoegen, dat zou de partiële unieke index kunnen schenden).
    select id into v_season_id from public.club_seasons where club_id = r.club_id and is_active limit 1;
    if v_season_id is null then
      select * into season_row from public.current_football_season_bounds();
      insert into public.club_seasons (club_id, name, starts_on, ends_on, is_active)
      values (r.club_id, season_row.name, season_row.starts_on, season_row.ends_on, false)
      on conflict (club_id, name) do nothing
      returning id into v_season_id;
      if v_season_id is null then
        select id into v_season_id from public.club_seasons where club_id = r.club_id and name = season_row.name;
      end if;
      perform public.set_active_club_season(r.club_id, v_season_id);
    end if;

    -- Contactgegevens veilig samenvoegen: als er al een club_players-rij met deze matchsleutel
    -- bestaat en het e-mailadres wijkt af van wat deze legacy-rij aanlevert, NIET stilzwijgend
    -- overschrijven -- loggen als reviewissue. (Leeg -> aanvullen gebeurt in de upsert hieronder.)
    -- Moet exact dezelfde formule gebruiken als match_key's generated-column-expressie in
    -- 0030 (incl. immutable_date_text i.p.v. date_of_birth::text), anders vindt deze lookup
    -- nooit de al opgeslagen rij terug.
    select email into v_existing_email from public.club_players
      where club_id = r.club_id
        and match_key = public.normalize_person_name(r.first_name) || '|' ||
                         public.normalize_person_name(r.last_name) || '|' ||
                         coalesce(public.immutable_date_text(r.date_of_birth), 'nodob-' || r.player_id::text);

    if v_existing_email is not null and v_existing_email <> ''
       and r.email is not null and r.email <> ''
       and v_existing_email <> r.email then
      insert into public.club_player_migration_issues
        (club_id, legacy_player_id, issue_type, issue_key, details)
      values (
        r.club_id, r.player_id, 'conflicting_contact_data',
        'conflicting_contact_data:email:' || r.player_id::text,
        jsonb_build_object('field', 'email', 'existing', v_existing_email, 'incoming', r.email)
      )
      on conflict (issue_key) do nothing;
    end if;

    -- Upsert i.p.v. "do nothing": voorkomt een null v_club_player_id bij een gelijktijdig
    -- conflict, en vult ontbrekende contactvelden aan zonder bestaande waarden te overschrijven.
    insert into public.club_players (club_id, first_name, last_name, date_of_birth, email, phone)
    values (r.club_id, r.first_name, r.last_name, r.date_of_birth, r.email, nullif(r.phone_numbers[1], ''))
    on conflict (club_id, match_key) do update set
      email = case when coalesce(club_players.email, '') = '' then excluded.email else club_players.email end,
      phone = case when coalesce(club_players.phone, '') = '' then excluded.phone else club_players.phone end,
      updated_at = now()
    returning id into v_club_player_id;

    -- Altijd 'secondary' tijdens backfill: nooit een primary raden op basis van invoegvolgorde
    -- (die niet gegarandeerd is zonder expliciete ORDER BY). Ondubbelzinnige 1-team-gevallen
    -- worden hieronder, ná de loop, in bulk gepromoveerd.
    insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
    values (v_club_player_id, r.team_id, v_season_id, 'secondary')
    on conflict (club_player_id, team_id, season_id) do update set updated_at = now()
    returning id into v_membership_id;
    v_run_membership_ids := array_append(v_run_membership_ids, v_membership_id);

    -- Veiligheidsklep: als deze membership al een operationele players-rij heeft (duplicate
    -- legacy players-rij voor hetzelfde team), NIET koppelen maar loggen voor manuele review
    -- i.p.v. de players_membership_unique_idx te laten crashen.
    if exists (select 1 from public.players where membership_id = v_membership_id) then
      insert into public.club_player_migration_issues
        (club_id, legacy_player_id, candidate_club_player_id, issue_type, issue_key, details)
      values (
        r.club_id, r.player_id, v_club_player_id, 'duplicate_membership',
        'duplicate_membership:' || r.player_id::text || ':' || v_membership_id::text,
        jsonb_build_object('membership_id', v_membership_id, 'team_id', r.team_id)
      )
      on conflict (issue_key) do nothing;
    else
      update public.players set membership_id = v_membership_id where id = r.player_id;
    end if;

    if r.date_of_birth is null then
      insert into public.club_player_migration_issues
        (club_id, legacy_player_id, candidate_club_player_id, issue_type, issue_key, details)
      values (
        r.club_id, r.player_id, v_club_player_id, 'missing_date_of_birth',
        'missing_date_of_birth:' || r.player_id::text,
        jsonb_build_object('first_name', r.first_name, 'last_name', r.last_name)
      )
      on conflict (issue_key) do nothing;
    end if;
  end loop;

  -- Ondubbelzinnige promotie: enkel binnen DEZE run (v_run_membership_ids), enkel
  -- primary/secondary meetellen (guest telt niet mee bij het bepalen of een primair team
  -- ambigu is), nooit clubbreed of over andere seizoenen heen.
  update public.player_team_memberships ptm set membership_type = 'primary'
    where ptm.id = any(v_run_membership_ids)
      and ptm.status = 'active'
      and not exists (
        select 1 from public.player_team_memberships p2
        where p2.club_player_id = ptm.club_player_id and p2.season_id = ptm.season_id
          and p2.id <> ptm.id and p2.status = 'active'
          and p2.membership_type in ('primary', 'secondary')
      );

  insert into public.club_player_migration_issues
    (club_id, candidate_club_player_id, issue_type, issue_key, details)
  select
    cp.club_id, cp.id, 'unassigned_primary_team',
    'unassigned_primary_team:' || cp.id::text || ':' || ptm.season_id::text,
    jsonb_build_object('season_id', ptm.season_id, 'team_ids', array_agg(ptm.team_id))
  from public.player_team_memberships ptm
  join public.club_players cp on cp.id = ptm.club_player_id
  where ptm.id = any(v_run_membership_ids)
    and ptm.status = 'active'
    and ptm.membership_type in ('primary', 'secondary')
  group by cp.club_id, cp.id, ptm.season_id
  having count(*) > 1
  on conflict (issue_key) do nothing;
end;
$$;

-- Enkel uitvoerbaar als postgres/service-role, tijdens de bewuste, gecontroleerde
-- migratiestap -- nooit rechtstreeks vanuit de app of door een ingelogde gebruiker.
revoke all on function public.backfill_club_players_from_players() from public, anon, authenticated;

-- Bewust GEEN aanroep van de functie hier. Zie het uitvoeringspad hierboven.
