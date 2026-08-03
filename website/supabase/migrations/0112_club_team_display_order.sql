alter table public.club_teams
  add column if not exists display_order integer;

with ranked as (
  select id, row_number() over (partition by club_id order by name, created_at, id) - 1 as position
  from public.club_teams
)
update public.club_teams team
set display_order = ranked.position
from ranked
where ranked.id = team.id and team.display_order is null;

alter table public.club_teams alter column display_order set default 0;
alter table public.club_teams alter column display_order set not null;

create index if not exists club_teams_display_order_idx
  on public.club_teams(club_id, display_order, name);

create or replace function public.reorder_club_teams(target_club_id uuid, ordered_team_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(array_length(ordered_team_ids, 1), 0) <> (
    select count(*) from public.club_teams where club_id = target_club_id and status <> 'merged'
  ) or exists (
    select 1 from unnest(ordered_team_ids) id
    left join public.club_teams team on team.id = id and team.club_id = target_club_id and team.status <> 'merged'
    where team.id is null
  ) or (select count(distinct listed.id) from unnest(ordered_team_ids) as listed(id)) <> coalesce(array_length(ordered_team_ids, 1), 0) then
    raise exception 'De ploegvolgorde is ongeldig of onvolledig.';
  end if;

  update public.club_teams team
  set display_order = ordered.position - 1
  from unnest(ordered_team_ids) with ordinality as ordered(id, position)
  where team.id = ordered.id and team.club_id = target_club_id;
end;
$$;

revoke all on function public.reorder_club_teams(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.list_public_club_teams(target_club_id uuid)
returns table(id uuid, name text, age_category text, level_or_competition text)
language sql stable security definer set search_path = public as $$
  select team.id, team.name, team.age_category, team.level_or_competition
  from public.club_teams team
  join public.clubs club on club.id = team.club_id
  where team.club_id = target_club_id and team.status = 'active' and club.status = 'active'
  order by team.display_order, team.name;
$$;
grant execute on function public.list_public_club_teams(uuid) to anon, authenticated;
