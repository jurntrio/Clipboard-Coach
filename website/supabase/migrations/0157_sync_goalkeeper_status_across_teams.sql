-- A club player can have one operational players row per team membership.
-- Goalkeeper is a person-level trait, so all of those projections must agree.

create or replace function public.sync_club_player_goalkeeper_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_club_player_id uuid;
begin
  if new.membership_id is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  select membership.club_player_id into linked_club_player_id
  from public.player_team_memberships membership
  where membership.id = new.membership_id;

  if linked_club_player_id is not null then
    update public.players player
    set is_goalkeeper = new.is_goalkeeper
    from public.player_team_memberships membership
    where membership.club_player_id = linked_club_player_id
      and player.membership_id = membership.id
      and player.id <> new.id
      and player.is_goalkeeper is distinct from new.is_goalkeeper;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_club_player_goalkeeper_status on public.players;
create trigger trg_sync_club_player_goalkeeper_status
after insert or update of is_goalkeeper on public.players
for each row execute function public.sync_club_player_goalkeeper_status();

-- Repair existing linked rows. If old rows disagree, preserve goalkeeper=true:
-- that avoids silently turning an already marked goalkeeper into a field player.
alter table public.players disable trigger guard_goalkeeper_status_change_trigger;
with goalkeeper_status as (
  select membership.club_player_id, bool_or(player.is_goalkeeper) as is_goalkeeper
  from public.players player
  join public.player_team_memberships membership on membership.id = player.membership_id
  group by membership.club_player_id
)
update public.players player
set is_goalkeeper = status.is_goalkeeper
from public.player_team_memberships membership
join goalkeeper_status status on status.club_player_id = membership.club_player_id
where player.membership_id = membership.id
  and player.is_goalkeeper is distinct from status.is_goalkeeper;
alter table public.players enable trigger guard_goalkeeper_status_change_trigger;
