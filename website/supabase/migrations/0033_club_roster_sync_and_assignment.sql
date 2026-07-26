-- Fase 2b: preview/diff-UI voor synchroniseren/vervangen, "voeg speler toe aan ander team", en
-- unassigned_primary_team-oplos-UI. Zie website/docs/club-player-identity-and-seasons-plan.md.
--
-- Ontwerpkeuze: de drie importmodi (toevoegen/bijwerken, synchroniseren, volledig vervangen)
-- delen dezelfde twee bouwstenen. Toevoegen/bijwerken blijft precies import_roster_rows_merge
-- (0032, ongewijzigd qua gedrag op dat vlak). Synchroniseren en volledig vervangen zijn client-
-- side varianten die BEIDE import_roster_rows_merge (voor nieuw/bijgewerkt) EN de nieuwe
-- remove_roster_players hieronder (voor bevestigd-verwijderde spelers) aanroepen -- het verschil
-- tussen de twee modi zit in de UI (welke rijen standaard aangevinkt staan, welke bevestiging
-- vereist is), niet in aparte SQL-functies. De preview (X nieuw / Y bijgewerkt / Z ontbrekend)
-- wordt client-side berekend uit de al-geladen roster vs. de net-ingelezen PSD-rijen -- dat
-- bestaat al aan beide kanten (storedRows() resp. de net-geparste rijen) en heeft geen nieuwe
-- RPC nodig.

-- ---------------------------------------------------------------------------
-- 1. import_roster_player_merge: create-or-replace-fix bovenop 0032. De oorspronkelijke
-- "on conflict ... do update set updated_at = now()" liet status/left_at ongemoeid. Zonder deze
-- fix zou een speler die via remove_roster_players (hieronder) verwijderd werd, bij een latere
-- gewone toevoegen/bijwerken-herimport stil "ended" blijven -- de membership zou bestaan maar
-- nooit meer actief worden, en dus nergens meer zichtbaar zijn. membership_type blijft bewust
-- ongemoeid bij een bestaande rij (zelfde reden als in 0032: een handmatig gezette 'guest' mag
-- nooit teruggeforceerd worden naar 'primary').
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

  v_membership_type := case when exists (
    select 1 from public.player_team_memberships
    where club_player_id = v_club_player_id and season_id = target_season_id
      and team_id <> target_team_id and status = 'active' and membership_type = 'primary'
  ) then 'secondary' else 'primary' end;

  insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
  values (v_club_player_id, target_team_id, target_season_id, v_membership_type)
  on conflict (club_player_id, team_id, season_id) do update set
    updated_at = now(), status = 'active', left_at = null
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
-- 2. remove_roster_players: bevestigde verwijdering na een synchroniseren/volledig-vervangen-
-- keuze in de UI. NIET auth.uid()-gated -- zelfde vertrouwensmodel als import_roster_rows_merge
-- (0032): enkel aanroepbaar via roster/route.ts's service-role admin-client, autorisatie gebeurt
-- daar (dezelfde club_admin/trainers_can_edit_roster-check als voor de import zelf).
--
-- Sluit de membership af (status = 'ended', left_at = current_date) i.p.v. ze te verwijderen --
-- player_team_memberships blijft de canonieke, nooit-stilzwijgend-verdwijnende bron van
-- teamgeschiedenis. De operationele players-rij wordt wel verwijderd (zelfde patroon als de
-- bestaande "supabase.from('players').delete()" voor persoonlijke teams in teams/page.tsx) --
-- dat is precies wat de speler onmiddellijk uit elke roster-weergave laat verdwijnen, zonder dat
-- club/overview's select-query aangepast moet worden.
-- ---------------------------------------------------------------------------

create or replace function public.remove_roster_players(target_team_id uuid, p_player_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_removed int := 0;
begin
  with ended as (
    update public.player_team_memberships ptm
      set status = 'ended', left_at = current_date
    from public.players p
    where p.membership_id = ptm.id
      and p.id = any(p_player_ids)
      and p.team_id = target_team_id
      and ptm.status = 'active'
    returning ptm.id
  ),
  deleted as (
    delete from public.players
    where id = any(p_player_ids) and team_id = target_team_id and role = 'player'
    returning id
  )
  select count(*) into v_removed from deleted;

  return jsonb_build_object('removed', v_removed);
end;
$$;

revoke all on function public.remove_roster_players(uuid, uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. add_club_player_to_team: "voeg speler ook toe aan ander team"-actie, rechtstreeks vanaf een
-- ingelogde sessie (auth.uid()-gated, spiegelt resolve_primary_membership hierboven in 0032).
-- Werkt samen met search_club_players_for_assignment: die levert enkel club_player_id/naam/
-- geboortejaar/teamnamen (geen contactgegevens); deze functie leest de volledige contactgegevens
-- pas na de autorisatiecheck, en enkel voor het aanmaken van de operationele players-rij.
--
-- Reactiveert een eerder 'ended' membership i.p.v. een unique-violation te geven (zelfde fix als
-- hierboven bij import_roster_player_merge -- een club_player die ooit uit dit team verwijderd
-- werd, kan zo opnieuw toegevoegd worden zonder dat de clubadmin dat als foutmelding ziet).
-- ---------------------------------------------------------------------------

create or replace function public.add_club_player_to_team(
  target_club_player_id uuid, target_team_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_team_club_id uuid;
  v_player_club_id uuid;
  v_first_name text;
  v_last_name text;
  v_date_of_birth date;
  v_email text;
  v_phone text;
  v_season_id uuid;
  v_membership_id uuid;
  v_membership_type text;
  v_operational_player_id uuid;
  v_already_active boolean;
begin
  if not public.can_manage_team_membership(target_team_id, auth.uid()) then
    raise exception 'ADD_CLUB_PLAYER_FORBIDDEN';
  end if;

  select ct.club_id into v_team_club_id
    from public.teams t join public.club_teams ct on ct.id = t.club_team_id where t.id = target_team_id;
  if v_team_club_id is null then
    raise exception 'TEAM_NOT_A_CLUB_TEAM';
  end if;

  select club_id, first_name, last_name, date_of_birth, email, phone
    into v_player_club_id, v_first_name, v_last_name, v_date_of_birth, v_email, v_phone
    from public.club_players where id = target_club_player_id;
  if v_player_club_id is null or v_player_club_id <> v_team_club_id then
    raise exception 'CLUB_PLAYER_NOT_IN_CLUB';
  end if;

  v_season_id := public.ensure_active_club_season(v_team_club_id);

  v_already_active := exists (
    select 1 from public.player_team_memberships
    where club_player_id = target_club_player_id and team_id = target_team_id
      and season_id = v_season_id and status = 'active'
  );
  if v_already_active then
    raise exception 'ALREADY_ON_TEAM';
  end if;

  v_membership_type := case when exists (
    select 1 from public.player_team_memberships
    where club_player_id = target_club_player_id and season_id = v_season_id
      and status = 'active' and membership_type = 'primary'
  ) then 'secondary' else 'primary' end;

  insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
  values (target_club_player_id, target_team_id, v_season_id, v_membership_type)
  on conflict (club_player_id, team_id, season_id) do update set
    updated_at = now(), status = 'active', left_at = null
  returning id into v_membership_id;

  select id into v_operational_player_id from public.players where membership_id = v_membership_id;
  if v_operational_player_id is null then
    insert into public.players (team_id, first_name, last_name, date_of_birth, email, phone_numbers, role, membership_id)
    values (target_team_id, v_first_name, v_last_name, v_date_of_birth, v_email,
      case when coalesce(v_phone, '') = '' then '{}'::text[] else array[v_phone] end, 'player', v_membership_id)
    returning id into v_operational_player_id;
  end if;

  return jsonb_build_object(
    'membership_id', v_membership_id, 'operational_player_id', v_operational_player_id,
    'membership_type', v_membership_type
  );
end;
$$;

revoke all on function public.add_club_player_to_team(uuid, uuid) from public, anon;
grant execute on function public.add_club_player_to_team(uuid, uuid) to authenticated;
