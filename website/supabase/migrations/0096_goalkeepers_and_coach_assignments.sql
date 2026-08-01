-- Doelmannen markeren en per keeperstrainer toewijzen.
alter table public.players
  add column if not exists is_goalkeeper boolean not null default false;

create or replace function public.guard_goalkeeper_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_goalkeeper is distinct from old.is_goalkeeper
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and not exists (
      select 1
      from public.teams team
      join public.club_teams club_team on club_team.id = team.club_team_id
      join public.club_memberships membership on membership.club_id = club_team.club_id
      where team.id = old.team_id
        and membership.profile_id = auth.uid()
        and membership.status = 'active'
        and (
          membership.role = 'club_admin'
          or membership.function_role in ('youth_coordinator', 'head_youth_development')
        )
    )
  then
    raise exception 'Alleen een Club Admin of jeugdcoördinator kan de doelmanstatus wijzigen.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_goalkeeper_status_change_trigger on public.players;
create trigger guard_goalkeeper_status_change_trigger
before update of is_goalkeeper on public.players
for each row execute function public.guard_goalkeeper_status_change();

create table if not exists public.club_trainer_players (
  trainer_id uuid references public.club_trainers(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  primary key (trainer_id, player_id)
);

create index if not exists idx_club_trainer_players_player
  on public.club_trainer_players(player_id);

alter table public.club_trainer_players enable row level security;

-- Beheer verloopt via gecontroleerde API-routes met de service role.

insert into public.club_role_permission_defaults
  (club_id, function_role, permission_key, enabled, updated_at)
select club.id, defaults.function_role, defaults.permission_key, true, timezone('utc'::text, now())
from public.clubs club
cross join (values
  ('goalkeeper_coach', 'video.view'), ('goalkeeper_coach', 'games.view'),
  ('goalkeeper_coach', 'games.planning.manage'), ('goalkeeper_coach', 'games.selection.view'),
  ('goalkeeper_coach', 'games.report.view'), ('goalkeeper_coach', 'games.tag_link.create'),
  ('goalkeeper_coach', 'games.tag'), ('goalkeeper_coach', 'training.view'),
  ('goalkeeper_coach', 'intradesk.view'), ('goalkeeper_coach', 'clips.share'),
  ('team_manager', 'games.view'), ('team_manager', 'games.selection.view'),
  ('team_manager', 'training.view'), ('team_manager', 'intradesk.view')
) as defaults(function_role, permission_key)
where not exists (
  select 1 from public.club_role_permission_defaults existing
  where existing.club_id = club.id and existing.function_role = defaults.function_role
)
on conflict do nothing;

update public.club_role_permission_defaults
set enabled = case
  when function_role = 'goalkeeper_coach' and permission_key in ('games.selection.view', 'games.report.view') then true
  when function_role = 'team_manager' and permission_key = 'games.selection.view' then true
  else false
end,
updated_at = timezone('utc'::text, now())
where (function_role = 'goalkeeper_coach' and permission_key in ('games.selection.view', 'games.selection.manage', 'games.report.view'))
   or (function_role = 'team_manager' and permission_key in ('games.selection.view', 'games.selection.manage', 'games.report.view'));

notify pgrst, 'reload schema';
