-- Small, sports-facing injury register. No diagnosis or internal medical notes.

alter table public.club_role_assignments
  drop constraint if exists club_role_assignments_role_type_check;
alter table public.club_role_assignments
  add constraint club_role_assignments_role_type_check check (role_type in (
    'trainer', 'assistant_trainer', 'goalkeeper_coach', 'team_manager', 'scout',
    'hospitality_worker', 'volunteer', 'board_member', 'club_employee',
    'doctor', 'physiotherapist'
  ));

create table public.player_injuries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  start_date date not null,
  expected_end_date date,
  ended_at timestamptz,
  status text not null default 'injured' check (status in ('injured', 'available')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expected_end_date is null or expected_end_date >= start_date),
  check ((status = 'injured' and ended_at is null) or (status = 'available' and ended_at is not null))
);

create unique index player_injuries_one_active_idx on public.player_injuries(player_id) where status = 'injured';
create index player_injuries_club_player_idx on public.player_injuries(club_id, player_id, start_date desc);

create table public.player_injury_history (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.player_injuries(id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  old_status text not null check (old_status in ('available', 'injured')),
  new_status text not null check (new_status in ('available', 'injured')),
  start_date date not null,
  expected_end_date date,
  message text not null check (char_length(trim(message)) between 1 and 2000),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  changed_at timestamptz not null default timezone('utc', now()),
  check (expected_end_date is null or expected_end_date >= start_date)
);

create index player_injury_history_player_idx on public.player_injury_history(club_id, player_id, changed_at desc);

create or replace function public.can_read_player_injury(target_club_id uuid, target_player_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.players p
    join public.teams t on t.id = p.team_id
    join public.club_teams ct on ct.id = t.club_team_id
    join public.club_memberships cm on cm.club_id = ct.club_id and cm.profile_id = target_user_id
    where p.id = target_player_id and ct.club_id = target_club_id and cm.status = 'active'
      and (
        cm.role in ('club_admin', 'club_admin_viewer')
        or cm.team_scope = 'all'
        or exists (select 1 from public.club_member_team_access a where a.club_id = ct.club_id and a.profile_id = target_user_id and a.club_team_id = ct.id)
        or exists (select 1 from public.club_trainers tr join public.club_trainer_teams tt on tt.trainer_id = tr.id where tr.profile_id = target_user_id and tr.club_id = ct.club_id and tt.club_team_id = ct.id and tt.status = 'active')
      )
      and (cm.role in ('club_admin','club_admin_viewer') or coalesce(cm.function_role, cm.role) in ('trainer','assistant_trainer','team_manager','youth_coordinator','head_youth_development','technical_director','doctor','physiotherapist'))
  );
$$;

create or replace function public.can_manage_player_injury(target_club_id uuid, target_player_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_read_player_injury(target_club_id, target_player_id, target_user_id)
    and exists (
      select 1 from public.club_memberships cm
      where cm.club_id = target_club_id
        and cm.profile_id = target_user_id
        and cm.status = 'active'
        and (
          cm.role = 'club_admin'
          or cm.function_role in (
            'doctor', 'physiotherapist', 'youth_coordinator',
            'head_youth_development', 'technical_director'
          )
        )
    );
$$;

alter table public.player_injuries enable row level security;
alter table public.player_injury_history enable row level security;
create policy "Authorized staff read player injuries" on public.player_injuries for select using (public.can_read_player_injury(club_id, player_id, auth.uid()));
create policy "Medical staff create player injuries" on public.player_injuries for insert with check (public.can_manage_player_injury(club_id, player_id, auth.uid()) and created_by = auth.uid());
create policy "Medical staff update player injuries" on public.player_injuries for update using (public.can_manage_player_injury(club_id, player_id, auth.uid())) with check (public.can_manage_player_injury(club_id, player_id, auth.uid()));
create policy "Authorized staff read injury history" on public.player_injury_history for select using (public.can_read_player_injury(club_id, player_id, auth.uid()));
create policy "Medical staff append injury history" on public.player_injury_history for insert with check (public.can_manage_player_injury(club_id, player_id, auth.uid()) and changed_by = auth.uid());

revoke all on public.player_injuries, public.player_injury_history from anon, authenticated;
grant select, insert, update on public.player_injuries to authenticated;
grant select, insert on public.player_injury_history to authenticated;
revoke update, delete on public.player_injury_history from authenticated;
notify pgrst, 'reload schema';


