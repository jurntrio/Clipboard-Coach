-- A guardian can see memberships across several seasons. Return the current
-- active season first and, within that season, the primary team first. The
-- dashboard groups rows per child and uses the first row for its headline.
create or replace function public.guardian_dashboard_players()
returns table (
  child_key uuid, first_name text, last_name text, date_of_birth date,
  player_id uuid, team_id uuid, team_name text
)
language sql stable security definer set search_path = public as $$
  with dashboard_rows as (
    select pg.player_id as child_key, p.first_name, p.last_name, p.date_of_birth,
      p.id as player_id, p.team_id, coalesce(ct.name, t.name) as team_name,
      0 as active_season_rank, 0 as primary_team_rank, null::date as season_start
    from public.player_guardians pg
    join public.players p on p.id = pg.player_id
    left join public.teams t on t.id = p.team_id
    left join public.club_teams ct on ct.id = t.club_team_id
    where pg.profile_id = auth.uid() and pg.player_id is not null
      and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())

    union all

    select pg.club_player_id as child_key, p.first_name, p.last_name, p.date_of_birth,
      p.id as player_id, p.team_id, coalesce(ct.name, t.name) as team_name,
      case when cs.is_active then 0 else 1 end as active_season_rank,
      case when ptm.membership_type = 'primary' then 0 else 1 end as primary_team_rank,
      cs.starts_on as season_start
    from public.player_guardians pg
    join public.player_team_memberships ptm on ptm.club_player_id = pg.club_player_id
    join public.club_seasons cs on cs.id = ptm.season_id
    join public.players p on p.membership_id = ptm.id
    left join public.teams t on t.id = p.team_id
    left join public.club_teams ct on ct.id = t.club_team_id
    where pg.profile_id = auth.uid() and pg.club_player_id is not null
      and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
      and (
        pg.access_scope = 'all_history'
        or (pg.access_scope = 'current_season' and cs.is_active)
        or (pg.access_scope = 'from_acceptance' and coalesce(cs.ends_on, 'infinity'::date) >= pg.valid_from::date)
      )
  )
  select row.child_key, row.first_name, row.last_name, row.date_of_birth,
    row.player_id, row.team_id, row.team_name
  from dashboard_rows row
  order by row.child_key, row.active_season_rank, row.primary_team_rank,
    row.season_start desc nulls last, row.team_name;
$$;

revoke all on function public.guardian_dashboard_players() from public, anon;
grant execute on function public.guardian_dashboard_players() to authenticated;
