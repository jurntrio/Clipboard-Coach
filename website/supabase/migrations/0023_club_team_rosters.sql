-- Club-owned operational teams and roster editing permissions.
alter table public.club_teams
  add column if not exists trainers_can_edit_roster boolean not null default true;

alter table public.teams
  add column if not exists club_team_id uuid references public.club_teams(id) on delete cascade;

create unique index if not exists teams_club_team_unique
  on public.teams(club_team_id) where club_team_id is not null;

alter table public.teams drop constraint if exists teams_coach_id_fkey;
alter table public.teams alter column coach_id drop not null;
alter table public.teams
  add constraint teams_coach_id_fkey foreign key (coach_id)
  references public.profiles(id) on delete set null;

create or replace function public.add_team_owner_as_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coach_id is not null then
    insert into public.team_staff_members (team_id, user_id, added_by)
    values (new.id, new.coach_id, new.coach_id)
    on conflict (team_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

-- Create one operational roster for every club team. Club rosters deliberately
-- have no personal owner and therefore survive trainer account deletion.
insert into public.teams (coach_id, name, club_name, club_team_id)
select null, ct.name, c.name, ct.id
from public.club_teams ct
join public.clubs c on c.id = ct.club_id
where ct.status not in ('rejected', 'archived', 'merged')
  and not exists (select 1 from public.teams t where t.club_team_id = ct.id);

create or replace function public.can_manage_club_roster(target_team_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    join public.club_teams ct on ct.id = t.club_team_id
    where t.id = target_team_id
      and (
        exists (
          select 1 from public.club_memberships cm
          where cm.club_id = ct.club_id and cm.profile_id = target_user_id
            and cm.role = 'club_admin' and cm.status = 'active'
        )
        or (
          ct.trainers_can_edit_roster
          and exists (
            select 1
            from public.club_trainer_teams ctt
            join public.club_trainers ctr on ctr.id = ctt.trainer_id
            where ctt.club_team_id = ct.id and ctr.profile_id = target_user_id
              and ctt.status = 'active'
          )
        )
      )
  );
$$;

drop policy if exists "Assigned club users can view operational teams" on public.teams;
create policy "Assigned club users can view operational teams" on public.teams for select
using (
  club_team_id is not null and exists (
    select 1
    from public.club_teams ct
    where ct.id = teams.club_team_id and (
      exists (
        select 1 from public.club_memberships cm
        where cm.club_id = ct.club_id and cm.profile_id = auth.uid()
          and cm.role = 'club_admin' and cm.status = 'active'
      )
      or exists (
        select 1 from public.club_trainer_teams ctt
        join public.club_trainers ctr on ctr.id = ctt.trainer_id
        where ctt.club_team_id = ct.id and ctr.profile_id = auth.uid()
          and ctt.status = 'active'
      )
    )
  )
);

drop policy if exists "Assigned club users can view roster players" on public.players;
create policy "Assigned club users can view roster players" on public.players for select
using (
  team_id in (
    select t.id from public.teams t
    where t.club_team_id is not null and (
      public.can_manage_club_roster(t.id, auth.uid())
      or exists (
        select 1 from public.club_trainer_teams ctt
        join public.club_trainers ctr on ctr.id = ctt.trainer_id
        where ctt.club_team_id = t.club_team_id and ctr.profile_id = auth.uid()
          and ctt.status = 'active'
      )
    )
  )
);

drop policy if exists "Authorized club users can insert roster players" on public.players;
create policy "Authorized club users can insert roster players" on public.players for insert
with check (public.can_manage_club_roster(team_id, auth.uid()));

drop policy if exists "Authorized club users can update roster players" on public.players;
create policy "Authorized club users can update roster players" on public.players for update
using (public.can_manage_club_roster(team_id, auth.uid()))
with check (public.can_manage_club_roster(team_id, auth.uid()));

drop policy if exists "Authorized club users can delete roster players" on public.players;
create policy "Authorized club users can delete roster players" on public.players for delete
using (public.can_manage_club_roster(team_id, auth.uid()));

notify pgrst, 'reload schema';
