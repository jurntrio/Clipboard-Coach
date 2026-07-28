-- Fase 3: player_invites/player_guardians schakelen over op club_player_id. Zie
-- website/docs/club-player-identity-and-seasons-plan.md ("Fase 3 -- Guardian-invite en parent-UI").
--
-- player_id blijft bestaan naast club_player_id (allebei nullable, exact 1 van de 2 gezet):
-- een club-brede speler krijgt club_player_id, maar een speler bij een puur persoonlijk
-- (niet-club) team heeft geen club_players-rij om naar te verwijzen -- die blijft op het oude
-- rechtstreekse player_id-pad. Dit is dezelfde "optioneel koppelpunt"-aanpak als
-- players.membership_id zelf (0030): club-brede identiteit is een uitbreiding, geen vervanging.

-- ---------------------------------------------------------------------------
-- 1. Schema: club_player_id + toegangsvenster op player_guardians/player_invites.
-- ---------------------------------------------------------------------------

alter table public.player_guardians alter column player_id drop not null;
alter table public.player_guardians add column club_player_id uuid references public.club_players(id) on delete cascade;
alter table public.player_guardians add column access_scope text not null default 'from_acceptance'
  check (access_scope in ('current_season', 'from_acceptance', 'all_history'));
alter table public.player_guardians add column valid_from timestamptz not null default timezone('utc'::text, now());
alter table public.player_guardians add column valid_until timestamptz;
alter table public.player_guardians add column revoked_at timestamptz;
alter table public.player_guardians add constraint player_guardians_target_xor
  check ((player_id is not null) <> (club_player_id is not null));
alter table public.player_guardians add constraint player_guardians_club_player_profile_unique
  unique (club_player_id, profile_id);

alter table public.player_invites alter column player_id drop not null;
alter table public.player_invites add column club_player_id uuid references public.club_players(id) on delete cascade;
alter table public.player_invites add constraint player_invites_target_xor
  check ((player_id is not null) <> (club_player_id is not null));

-- ---------------------------------------------------------------------------
-- 2. guardian_operational_player_ids / guardian_club_player_ids: de twee, duidelijk benoemde
-- helpers uit het plan. guardian_operational_player_ids geeft players.id's terug (voor RLS op
-- players/clips/tags/matches/videos/player_stat_events, die allemaal via players.id werken).
-- guardian_club_player_ids geeft club_player_id's terug (voor eventuele toekomstige, clubbrede
-- weergaves). Toegangsvenster (access_scope/valid_until/revoked_at) wordt hier centraal
-- afgedwongen, niet in elke aanroepende policy apart.
-- ---------------------------------------------------------------------------

create or replace function public.guardian_operational_player_ids(target_user_id uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select pg.player_id
  from public.player_guardians pg
  where pg.profile_id = target_user_id and pg.player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
  union
  select p.id
  from public.player_guardians pg
  join public.player_team_memberships ptm on ptm.club_player_id = pg.club_player_id
  join public.club_seasons cs on cs.id = ptm.season_id
  join public.players p on p.membership_id = ptm.id
  where pg.profile_id = target_user_id and pg.club_player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
    and (
      pg.access_scope = 'all_history'
      or (pg.access_scope = 'current_season' and cs.is_active)
      or (pg.access_scope = 'from_acceptance' and coalesce(cs.ends_on, 'infinity'::date) >= pg.valid_from::date)
    );
$$;
grant execute on function public.guardian_operational_player_ids(uuid) to authenticated;

create or replace function public.guardian_club_player_ids(target_user_id uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select pg.club_player_id
  from public.player_guardians pg
  where pg.profile_id = target_user_id and pg.club_player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now());
$$;
grant execute on function public.guardian_club_player_ids(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bestaande guardian-functies/policies omgebouwd op de nieuwe helpers i.p.v. rechtstreeks
-- player_guardians.player_id -- zelfde structuur als voorheen (0026/0027/0029), enkel de bron
-- van "welke players.id's mag deze gebruiker zien" verandert.
-- ---------------------------------------------------------------------------

create or replace function public.guardian_team_ids(target_user_id uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.team_id
  from public.players p
  where p.id in (select public.guardian_operational_player_ids(target_user_id));
$$;
grant execute on function public.guardian_team_ids(uuid) to authenticated;

create or replace function public.can_guardian_view_clip(target_clip_id uuid, target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.clips c
    join public.players p on p.id in (select public.guardian_operational_player_ids(target_user_id))
    where c.id = target_clip_id
      and (
        c.audience_player_ids @> array[p.id]
        or (c.team_id = p.team_id and c.audience_type = 'full_team')
        or exists (
          select 1 from public.clip_segments cs
          join public.tags t on t.id = cs.tag_id
          where cs.clip_id = c.id and t.player_ids @> array[p.id]
        )
      )
  );
$$;
grant execute on function public.can_guardian_view_clip(uuid, uuid) to authenticated;

create or replace function public.can_guardian_view_match(target_match_id uuid, target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    where m.id = target_match_id
      and exists (select 1 from public.guardian_operational_player_ids(target_user_id) as gid where gid = any(m.player_ids))
  );
$$;
grant execute on function public.can_guardian_view_match(uuid, uuid) to authenticated;

drop policy if exists "Guardians can view their player" on public.players;
create policy "Guardians can view their player" on public.players for select
  using (id in (select public.guardian_operational_player_ids(auth.uid())));

drop policy if exists "Guardians can view relevant player stats" on public.player_stat_events;
create policy "Guardians can view relevant player stats" on public.player_stat_events for select
  using (player_id in (select public.guardian_operational_player_ids(auth.uid())));

-- ---------------------------------------------------------------------------
-- 4. guardian_dashboard_players: 1 RPC voor ParentHome, i.p.v. club_players/
-- player_team_memberships rechtstreeks via RLS open te zetten voor ouders (die tabellen tonen
-- clubbrede persoonsgegevens resp. lidmaatschapsdetails die geen enkele bestaande RLS-policy nu
-- aan een guardian toont -- zie 0030 "Trainers zien geen clubbrede persoonsgegevens"-principe,
-- hier hetzelfde toegepast op ouders). Geeft enkel de velden terug die de parent-UI nodig heeft.
-- child_key groepeert de rijen per kind (club_player_id voor een clubbrede speler, anders het
-- players.id zelf voor een persoonlijk-teamspeler) zodat een kind met meerdere teams één sectie
-- krijgt i.p.v. één per operationele players-rij.
-- ---------------------------------------------------------------------------

create or replace function public.guardian_dashboard_players()
returns table (
  child_key uuid, first_name text, last_name text, date_of_birth date,
  player_id uuid, team_id uuid, team_name text
)
language sql stable security definer set search_path = public as $$
  select pg.player_id as child_key, p.first_name, p.last_name, p.date_of_birth, p.id as player_id, p.team_id, t.name as team_name
  from public.player_guardians pg
  join public.players p on p.id = pg.player_id
  left join public.teams t on t.id = p.team_id
  where pg.profile_id = auth.uid() and pg.player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
  union all
  select pg.club_player_id as child_key, p.first_name, p.last_name, p.date_of_birth, p.id as player_id, p.team_id, t.name as team_name
  from public.player_guardians pg
  join public.player_team_memberships ptm on ptm.club_player_id = pg.club_player_id
  join public.club_seasons cs on cs.id = ptm.season_id
  join public.players p on p.membership_id = ptm.id
  left join public.teams t on t.id = p.team_id
  where pg.profile_id = auth.uid() and pg.club_player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
    and (
      pg.access_scope = 'all_history'
      or (pg.access_scope = 'current_season' and cs.is_active)
      or (pg.access_scope = 'from_acceptance' and coalesce(cs.ends_on, 'infinity'::date) >= pg.valid_from::date)
    );
$$;
revoke all on function public.guardian_dashboard_players() from public, anon;
grant execute on function public.guardian_dashboard_players() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. handle_new_user: player_invite_token-acceptatie werkt nu met club_player_id/player_id
-- (exact 1 gezet, gespiegeld vanuit de invite-rij zelf). access_scope/valid_from krijgen hier
-- hun standaardwaarde (from_acceptance / aanvaardingsmoment) -- de enige plek waar een guardian-
-- rij effectief ontstaat.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at_value timestamp with time zone;
  invite public.player_invites;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.standard_tags
    (coach_id, name, is_protected, start_offset_seconds, end_offset_seconds)
  values
    (new.id, 'Start', true, 0, 0),
    (new.id, 'Goal', true, -10, 3),
    (new.id, 'Kans', false, -10, 3),
    (new.id, 'Opbouw', false, -5, 10),
    (new.id, 'Positiespel', false, -10, 5),
    (new.id, 'Hoekschop', false, -3, 10),
    (new.id, 'Vrije trap', false, -3, 10);

  if coalesce(new.raw_user_meta_data->>'legal_accepted', 'false') = 'true'
    and new.raw_user_meta_data->>'terms_version' is not null
    and new.raw_user_meta_data->>'privacy_version' is not null
    and new.raw_user_meta_data->>'legal_statement_version' is not null then
    begin
      accepted_at_value := (new.raw_user_meta_data->>'legal_accepted_at')::timestamp with time zone;
    exception when others then
      accepted_at_value := timezone('utc'::text, now());
    end;
    insert into public.legal_acceptances
      (user_id, terms_version, privacy_version, statement_version, locale, accepted_at)
    values
      (new.id, new.raw_user_meta_data->>'terms_version',
       new.raw_user_meta_data->>'privacy_version',
       new.raw_user_meta_data->>'legal_statement_version',
       case when new.raw_user_meta_data->>'legal_locale' = 'en' then 'en' else 'nl' end,
       accepted_at_value);
  end if;

  if new.raw_user_meta_data ? 'club_onboarding' then
    perform public.complete_club_team_onboarding(
      new.id, new.email, new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->'club_onboarding'
    );
  end if;

  if new.raw_user_meta_data ? 'player_invite_token' then
    select * into invite from public.player_invites
    where token = nullif(new.raw_user_meta_data->>'player_invite_token', '')::uuid
      and used_at is null and expires_at > timezone('utc'::text, now());
    if invite.id is null then raise exception 'PLAYER_INVITE_INVALID'; end if;
    update public.profiles set account_role = 'player_parent' where id = new.id;
    insert into public.player_guardians (club_player_id, player_id, profile_id, access_scope, valid_from)
    values (invite.club_player_id, invite.player_id, new.id, 'from_acceptance', timezone('utc'::text, now()));
    update public.player_invites set used_at = timezone('utc'::text, now()), used_by = new.id where id = invite.id;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
