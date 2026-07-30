-- Reproducible dry-run and idempotent club_players -> people/club_people backfill.
-- This migration DEFINES the tooling but deliberately does not execute the backfill.

create table public.person_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  preview_hash text not null,
  status text not null check (status in ('running', 'completed', 'failed', 'rolled_back')),
  started_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

create table public.person_backfill_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.person_backfill_runs(id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete restrict,
  club_player_id uuid not null references public.club_players(id) on delete restrict,
  action text not null check (action in ('created_person_and_linked', 'already_linked')),
  person_id uuid not null references public.people(id) on delete restrict,
  club_person_id uuid not null references public.club_people(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (club_player_id)
);

create index person_backfill_actions_run_idx on public.person_backfill_actions(run_id);

create or replace function public.preview_club_people_backfill()
returns table (
  club_player_id uuid,
  club_id uuid,
  first_name text,
  last_name text,
  date_of_birth date,
  existing_club_person_id uuid,
  existing_person_id uuid,
  candidate_person_ids uuid[],
  candidate_count integer,
  classification text,
  certainty text,
  missing_identifiers boolean,
  possible_duplicate boolean,
  proposed_mutation text
)
language sql stable security definer set search_path = public as $$
  with candidates as (
    select
      player.id as club_player_id,
      array_agg(distinct candidate_person.id order by candidate_person.id)
        filter (where candidate_person.id is not null) as candidate_person_ids,
      count(distinct candidate_person.id)::integer as candidate_count
    from public.club_players player
    left join public.club_people candidate_club_person
      on candidate_club_person.club_id = player.club_id
      and candidate_club_person.id is distinct from player.club_person_id
    left join public.people candidate_person
      on candidate_person.id = candidate_club_person.person_id
      and candidate_person.status = 'active'
      and public.normalize_person_name(candidate_person.first_name)
        = public.normalize_person_name(player.first_name)
      and public.normalize_person_name(candidate_person.last_name)
        = public.normalize_person_name(player.last_name)
      and (
        (player.date_of_birth is not null and candidate_person.date_of_birth = player.date_of_birth)
        or player.date_of_birth is null
        or candidate_person.date_of_birth is null
      )
    group by player.id
  )
  select
    player.id,
    player.club_id,
    player.first_name,
    player.last_name,
    player.date_of_birth,
    linked_club_person.id,
    linked_person.id,
    coalesce(candidates.candidate_person_ids, '{}'::uuid[]),
    coalesce(candidates.candidate_count, 0),
    case
      when linked_club_person.id is not null and linked_person.id is not null then 'already_linked'
      when coalesce(candidates.candidate_count, 0) > 1 then 'multiple_candidates'
      when coalesce(candidates.candidate_count, 0) = 1 then 'review_existing_candidate'
      else 'create_new_person'
    end,
    case
      when linked_club_person.id is not null and linked_person.id is not null then 'certain'
      when coalesce(candidates.candidate_count, 0) = 0 then 'certain_new_identity'
      else 'requires_review'
    end,
    player.date_of_birth is null,
    coalesce(candidates.candidate_count, 0) > 0,
    case
      when linked_club_person.id is not null and linked_person.id is not null then 'none'
      when coalesce(candidates.candidate_count, 0) = 0
        then 'insert people; insert club_people; update club_players.club_person_id'
      else 'none until explicit review'
    end
  from public.club_players player
  left join public.club_people linked_club_person
    on linked_club_person.id = player.club_person_id
    and linked_club_person.club_id = player.club_id
  left join public.people linked_person
    on linked_person.id = linked_club_person.person_id
  left join candidates on candidates.club_player_id = player.id
  order by player.club_id, public.normalize_person_name(player.last_name),
    public.normalize_person_name(player.first_name), player.id;
$$;

create or replace function public.club_people_backfill_preview_hash()
returns text
language sql stable security definer set search_path = public as $$
  select md5(coalesce(string_agg(
    concat_ws('|',
      club_player_id::text,
      club_id::text,
      coalesce(existing_club_person_id::text, ''),
      array_to_string(candidate_person_ids, ','),
      classification,
      certainty,
      proposed_mutation
    ),
    E'\n' order by club_player_id
  ), ''))
  from public.preview_club_people_backfill();
$$;

create or replace function public.club_people_backfill_summary()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'preview_hash', public.club_people_backfill_preview_hash(),
    'total_club_players', (select count(*) from public.club_players),
    'already_linked', (select count(*) from public.preview_club_people_backfill()
      where classification = 'already_linked'),
    'new_people_proposed', (select count(*) from public.preview_club_people_backfill()
      where classification = 'create_new_person'),
    'existing_people_proposed', (select count(*) from public.preview_club_people_backfill()
      where classification = 'review_existing_candidate'),
    'certain_links', (select count(*) from public.preview_club_people_backfill()
      where certainty in ('certain', 'certain_new_identity')),
    'uncertain_links', (select count(*) from public.preview_club_people_backfill()
      where certainty = 'requires_review'),
    'possible_duplicates', (select count(*) from public.preview_club_people_backfill()
      where possible_duplicate),
    'missing_identifiers', (select count(*) from public.preview_club_people_backfill()
      where missing_identifiers),
    'multiple_candidates', (select count(*) from public.preview_club_people_backfill()
      where classification = 'multiple_candidates'),
    'memberships_before', (select count(*) from public.player_team_memberships),
    'seasons_in_memberships_before',
      (select count(distinct season_id) from public.player_team_memberships),
    'club_seasons_before', (select count(*) from public.club_seasons),
    'operational_players_linked_before',
      (select count(*) from public.players where membership_id is not null),
    'orphaned_membership_references_before', (
      select count(*) from public.player_team_memberships membership
      left join public.club_players player on player.id = membership.club_player_id
      left join public.teams team on team.id = membership.team_id
      left join public.club_seasons season on season.id = membership.season_id
      where player.id is null or team.id is null or season.id is null
    ),
    'orphaned_operational_player_references_before', (
      select count(*) from public.players player
      left join public.player_team_memberships membership on membership.id = player.membership_id
      where player.membership_id is not null and membership.id is null
    )
  );
$$;

create or replace function public.execute_club_people_backfill(expected_preview_hash text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  run_id_value uuid;
  current_preview_hash text;
  preview_row record;
  person_id_value uuid;
  club_person_id_value uuid;
begin
  -- One backfill at a time. The preview hash prevents executing a stale reviewed plan.
  perform pg_advisory_xact_lock(hashtext('club_people_backfill_v1'));
  current_preview_hash := public.club_people_backfill_preview_hash();
  if expected_preview_hash is null or expected_preview_hash <> current_preview_hash then
    raise exception 'PERSON_BACKFILL_PREVIEW_CHANGED';
  end if;
  if exists (
    select 1 from public.preview_club_people_backfill()
    where certainty = 'requires_review'
  ) then
    raise exception 'PERSON_BACKFILL_REVIEW_REQUIRED';
  end if;

  insert into public.person_backfill_runs(preview_hash, status, started_by)
  values (current_preview_hash, 'running', auth.uid())
  returning id into run_id_value;

  for preview_row in
    select * from public.preview_club_people_backfill()
    order by club_player_id
  loop
    if preview_row.classification = 'already_linked' then
      insert into public.person_backfill_actions(
        run_id, club_id, club_player_id, action, person_id, club_person_id
      ) values (
        run_id_value, preview_row.club_id, preview_row.club_player_id, 'already_linked',
        preview_row.existing_person_id, preview_row.existing_club_person_id
      ) on conflict (club_player_id) do nothing;
      continue;
    end if;

    if preview_row.classification <> 'create_new_person' then
      raise exception 'PERSON_BACKFILL_UNSAFE_CLASSIFICATION';
    end if;

    -- Lock the source row; a concurrent rerun must observe the newly added link.
    perform 1 from public.club_players
    where id = preview_row.club_player_id and club_person_id is null
    for update;
    if not found then continue; end if;

    insert into public.people(
      first_name, last_name, date_of_birth, created_by
    ) values (
      preview_row.first_name, preview_row.last_name, preview_row.date_of_birth, auth.uid()
    ) returning id into person_id_value;

    insert into public.club_people(club_id, person_id, created_by)
    values (preview_row.club_id, person_id_value, auth.uid())
    returning id into club_person_id_value;

    update public.club_players
    set club_person_id = club_person_id_value
    where id = preview_row.club_player_id and club_person_id is null;
    if not found then raise exception 'PERSON_BACKFILL_SOURCE_CHANGED'; end if;

    insert into public.person_backfill_actions(
      run_id, club_id, club_player_id, action, person_id, club_person_id
    ) values (
      run_id_value, preview_row.club_id, preview_row.club_player_id,
      'created_person_and_linked', person_id_value, club_person_id_value
    );

    insert into public.identity_audit_log(
      actor_profile_id, club_id, action, target_table, target_id, details
    ) values
      (auth.uid(), preview_row.club_id, 'person_created', 'people', person_id_value,
        jsonb_build_object('source_table', 'club_players', 'source_id', preview_row.club_player_id,
          'backfill_run_id', run_id_value)),
      (auth.uid(), preview_row.club_id, 'club_person_created', 'club_people', club_person_id_value,
        jsonb_build_object('source_table', 'club_players', 'source_id', preview_row.club_player_id,
          'backfill_run_id', run_id_value));
  end loop;

  update public.person_backfill_runs set
    status = 'completed',
    completed_at = timezone('utc', now()),
    summary = public.club_people_backfill_summary()
  where id = run_id_value;
  return run_id_value;
exception when others then
  -- The function is transactional: all rows, including a running run row, roll back together.
  raise;
end;
$$;

create or replace function public.rollback_club_people_backfill(target_run_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  action_row record;
begin
  perform pg_advisory_xact_lock(hashtext('club_people_backfill_v1'));
  if not exists (
    select 1 from public.person_backfill_runs
    where id = target_run_id and status = 'completed'
    for update
  ) then raise exception 'PERSON_BACKFILL_RUN_NOT_ROLLBACKABLE'; end if;

  for action_row in
    select * from public.person_backfill_actions
    where run_id = target_run_id and action = 'created_person_and_linked'
    order by club_player_id
  loop
    if exists (
      select 1 from public.person_accounts
      where person_id = action_row.person_id and status = 'active'
    ) or exists (
      select 1 from public.club_role_assignments
      where club_person_id = action_row.club_person_id and status <> 'ended'
    ) then
      raise exception 'PERSON_BACKFILL_ROLLBACK_HAS_LATER_DEPENDENCIES';
    end if;

    update public.club_players set club_person_id = null
    where id = action_row.club_player_id
      and club_person_id = action_row.club_person_id;
    if not found then raise exception 'PERSON_BACKFILL_ROLLBACK_SOURCE_CHANGED'; end if;

    -- Preserve provenance and auditability: rollback archives, it never deletes identities.
    update public.club_people set status = 'inactive', left_at = current_date
    where id = action_row.club_person_id;
    update public.people set status = 'archived'
    where id = action_row.person_id;

    insert into public.identity_audit_log(
      actor_profile_id, club_id, action, target_table, target_id, details
    ) values (
      auth.uid(), action_row.club_id, 'identity_manual_correction',
      'club_players', action_row.club_player_id,
      jsonb_build_object('operation', 'backfill_rollback', 'backfill_run_id', target_run_id,
        'person_id', action_row.person_id, 'club_person_id', action_row.club_person_id)
    );
  end loop;

  update public.person_backfill_runs set
    status = 'rolled_back',
    completed_at = timezone('utc', now())
  where id = target_run_id;
end;
$$;

alter table public.person_backfill_runs enable row level security;
alter table public.person_backfill_actions enable row level security;

create policy "Club admins read person backfill runs"
on public.person_backfill_runs for select
using (exists (
  select 1 from public.person_backfill_actions action
  where action.run_id = person_backfill_runs.id
    and public.is_active_club_admin(action.club_id, auth.uid())
));

create policy "Club admins read person backfill actions"
on public.person_backfill_actions for select
using (public.is_active_club_admin(club_id, auth.uid()));

revoke all on public.person_backfill_runs, public.person_backfill_actions
  from anon, authenticated;
grant select on public.person_backfill_runs, public.person_backfill_actions to authenticated;

revoke all on function public.preview_club_people_backfill() from public, anon, authenticated;
revoke all on function public.club_people_backfill_preview_hash() from public, anon, authenticated;
revoke all on function public.club_people_backfill_summary() from public, anon, authenticated;
revoke all on function public.execute_club_people_backfill(text) from public, anon, authenticated;
revoke all on function public.rollback_club_people_backfill(uuid) from public, anon, authenticated;
grant execute on function public.preview_club_people_backfill() to service_role;
grant execute on function public.club_people_backfill_preview_hash() to service_role;
grant execute on function public.club_people_backfill_summary() to service_role;
grant execute on function public.execute_club_people_backfill(text) to service_role;
grant execute on function public.rollback_club_people_backfill(uuid) to service_role;

notify pgrst, 'reload schema';
