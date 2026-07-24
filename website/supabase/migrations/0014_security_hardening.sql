-- Security hardening for staff invitations, upload URL quotas, and worker job locks.

create table if not exists public.team_staff_invitations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  invited_user_id uuid references public.profiles(id) on delete cascade not null,
  invited_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_id, invited_user_id)
);
create index if not exists idx_team_staff_invitations_user on public.team_staff_invitations(invited_user_id);
alter table public.team_staff_invitations enable row level security;

-- Memberships for registered users are now created only by the server after
-- the invited user accepts. Team-owner membership still comes from the
-- security-definer trigger in migration 0009.
drop policy if exists "Team owners can add staff memberships" on public.team_staff_members;

create table if not exists public.api_rate_limits (
  user_id uuid references public.profiles(id) on delete cascade not null,
  operation text not null,
  window_started_at timestamp with time zone not null,
  request_count integer not null check (request_count >= 0),
  primary key (user_id, operation)
);
alter table public.api_rate_limits enable row level security;

create or replace function public.consume_upload_part_url_quota(requested_count integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_window timestamp with time zone := date_trunc('minute', timezone('utc'::text, now()));
  updated_count integer;
begin
  if current_user_id is null or requested_count < 1 or requested_count > 100 then
    return false;
  end if;

  insert into public.api_rate_limits (user_id, operation, window_started_at, request_count)
  values (current_user_id, 'multipart-part-url', current_window, requested_count)
  on conflict (user_id, operation) do update
  set window_started_at = case
        when api_rate_limits.window_started_at = current_window then api_rate_limits.window_started_at
        else current_window
      end,
      request_count = case
        when api_rate_limits.window_started_at = current_window then api_rate_limits.request_count + requested_count
        else requested_count
      end
  returning request_count into updated_count;

  return updated_count <= 500;
end;
$$;
revoke all on function public.consume_upload_part_url_quota(integer) from public;
grant execute on function public.consume_upload_part_url_quota(integer) to authenticated;

create table if not exists public.worker_job_locks (
  resource_kind text not null check (resource_kind in ('video', 'clip')),
  resource_id uuid not null,
  lock_token uuid not null,
  acquired_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  primary key (resource_kind, resource_id)
);
alter table public.worker_job_locks enable row level security;
create or replace function public.accept_team_staff_invitation(invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.team_staff_invitations%rowtype;
begin
  select * into invitation
  from public.team_staff_invitations
  where id = invitation_id and invited_user_id = auth.uid()
  for update;
  if not found then return false; end if;

  insert into public.team_staff_members (team_id, user_id, added_by)
  values (invitation.team_id, invitation.invited_user_id, invitation.invited_by)
  on conflict (team_id, user_id) do nothing;
  delete from public.team_staff_invitations where id = invitation.id;
  return true;
end;
$$;
revoke all on function public.accept_team_staff_invitation(uuid) from public;
grant execute on function public.accept_team_staff_invitation(uuid) to authenticated;
