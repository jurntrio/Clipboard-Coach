-- Safe, person-bound invitations and claims. Replaces every automatic name-only claim.
create extension if not exists pgcrypto;

alter table public.person_accounts drop constraint if exists person_accounts_link_method_check;
alter table public.person_accounts add constraint person_accounts_link_method_check
  check (link_method in ('personal_invite', 'admin_review', 'verified_import', 'self_registration'));

create or replace function public.link_person_account(
  target_person_id uuid,
  target_profile_id uuid,
  link_method_value text,
  actor_profile_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  link_id uuid;
begin
  if link_method_value not in (
    'personal_invite', 'admin_review', 'verified_import', 'self_registration'
  ) then
    raise exception 'ACCOUNT_LINK_METHOD_INVALID';
  end if;
  if not exists (select 1 from public.profiles where id = actor_profile_id) then
    raise exception 'ACCOUNT_LINK_ACTOR_INVALID';
  end if;

  perform 1 from public.people where id = target_person_id for update;
  if not found then raise exception 'PERSON_NOT_FOUND'; end if;
  perform 1 from public.profiles where id = target_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  insert into public.person_accounts(
    person_id, profile_id, status, link_method, verified_at, verified_by
  ) values (
    target_person_id, target_profile_id, 'active', link_method_value,
    timezone('utc', now()), actor_profile_id
  ) returning id into link_id;

  insert into public.identity_audit_log(
    actor_profile_id, action, target_table, target_id, details
  ) values (
    actor_profile_id, 'account_linked', 'person_accounts', link_id,
    jsonb_build_object(
      'person_id', target_person_id,
      'profile_id', target_profile_id,
      'link_method', link_method_value
    )
  );
  return link_id;
end;
$$;

create table public.person_account_invitations (
  id uuid primary key default gen_random_uuid(),
  club_person_id uuid not null references public.club_people(id) on delete restrict,
  token_hash bytea not null unique,
  intended_email text,
  status text not null default 'pending'
    check (status in ('pending', 'used', 'expired', 'revoked')),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '14 days'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  check (
    (status = 'pending' and used_at is null and used_by is null and revoked_at is null)
    or (status = 'used' and used_at is not null and used_by is not null)
    or (status in ('expired', 'revoked') and used_at is null)
  )
);

create index person_account_invitations_club_person_idx
  on public.person_account_invitations(club_person_id, created_at desc);
create unique index person_account_invitations_one_pending_idx
  on public.person_account_invitations(club_person_id)
  where status = 'pending';

alter table public.person_account_invitations enable row level security;
create policy "Club admins read person invitations"
on public.person_account_invitations for select
using (exists (
  select 1 from public.club_people cp
  where cp.id = person_account_invitations.club_person_id
    and public.is_active_club_admin(cp.club_id, auth.uid())
));
revoke all on public.person_account_invitations from anon, authenticated;
grant select on public.person_account_invitations to authenticated;

create or replace function public.create_person_account_invitation(
  target_club_person_id uuid,
  intended_email_value text,
  actor_profile_id uuid,
  lifetime interval default interval '14 days'
) returns table(token text, invitation_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  club_id_value uuid;
  raw_token text;
begin
  select club_id into club_id_value from public.club_people
  where id = target_club_person_id and status = 'active';
  if club_id_value is null then raise exception 'CLUB_PERSON_NOT_FOUND'; end if;
  if not public.is_active_club_admin(club_id_value, actor_profile_id) then
    raise exception 'CLUB_ADMIN_REQUIRED';
  end if;
  if lifetime <= interval '0 seconds' or lifetime > interval '30 days' then
    raise exception 'PERSON_INVITE_LIFETIME_INVALID';
  end if;
  if exists (
    select 1 from public.person_accounts pa
    join public.club_people cp on cp.person_id = pa.person_id
    where cp.id = target_club_person_id and pa.status = 'active' and pa.revoked_at is null
  ) then raise exception 'PERSON_ALREADY_HAS_ACCOUNT'; end if;

  update public.person_account_invitations invitation set
    status = case when invitation.expires_at <= timezone('utc', now()) then 'expired' else 'revoked' end,
    revoked_at = case when invitation.expires_at > timezone('utc', now())
      then timezone('utc', now()) else invitation.revoked_at end,
    revoked_by = case when invitation.expires_at > timezone('utc', now())
      then actor_profile_id else invitation.revoked_by end
  where invitation.club_person_id = target_club_person_id and invitation.status = 'pending';

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.person_account_invitations(
    club_person_id, token_hash, intended_email, created_by, expires_at
  ) values (
    target_club_person_id,
    extensions.digest(raw_token, 'sha256'),
    nullif(lower(trim(intended_email_value)), ''),
    actor_profile_id,
    timezone('utc', now()) + lifetime
  ) returning id, person_account_invitations.expires_at
  into invitation_id, expires_at;
  token := raw_token;
  return next;
end;
$$;

create or replace function public.consume_person_account_invitation(
  raw_token text,
  target_profile_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  invitation public.person_account_invitations;
  person_id_value uuid;
  profile_email text;
  link_id uuid;
begin
  if raw_token is null or length(raw_token) <> 64 then
    raise exception 'PERSON_INVITE_INVALID';
  end if;
  select * into invitation from public.person_account_invitations
  where token_hash = extensions.digest(raw_token, 'sha256')
  for update;
  if invitation.id is null then raise exception 'PERSON_INVITE_INVALID'; end if;
  if invitation.status = 'used' then raise exception 'PERSON_INVITE_ALREADY_USED'; end if;
  if invitation.status <> 'pending' then raise exception 'PERSON_INVITE_NOT_PENDING'; end if;
  if invitation.expires_at <= timezone('utc', now()) then
    update public.person_account_invitations set status = 'expired'
    where id = invitation.id;
    raise exception 'PERSON_INVITE_EXPIRED';
  end if;

  select email into profile_email from public.profiles where id = target_profile_id for update;
  if profile_email is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if invitation.intended_email is not null
    and lower(trim(profile_email)) <> invitation.intended_email
  then raise exception 'PERSON_INVITE_WRONG_ACCOUNT'; end if;

  select person_id into person_id_value from public.club_people
  where id = invitation.club_person_id for update;
  if person_id_value is null then raise exception 'CLUB_PERSON_NOT_FOUND'; end if;

  link_id := public.link_person_account(
    person_id_value, target_profile_id, 'personal_invite', invitation.created_by
  );
  update public.person_account_invitations set
    status = 'used', used_at = timezone('utc', now()), used_by = target_profile_id
  where id = invitation.id and status = 'pending';
  if not found then raise exception 'PERSON_INVITE_CONCURRENTLY_USED'; end if;
  return link_id;
end;
$$;

create or replace function public.create_person_claim_review(
  target_profile_id uuid,
  target_candidate_person_id uuid,
  target_club_id uuid,
  reason_value text,
  evidence_value jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare review_id uuid;
begin
  if reason_value not in ('name_match', 'email_match', 'ambiguous_match', 'manual_request') then
    raise exception 'PERSON_CLAIM_REASON_INVALID';
  end if;
  if not exists (select 1 from public.profiles where id = target_profile_id) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if target_candidate_person_id is not null and not exists (
    select 1 from public.club_people
    where club_id = target_club_id and person_id = target_candidate_person_id
  ) then raise exception 'PERSON_CLAIM_CANDIDATE_NOT_IN_CLUB'; end if;
  insert into public.person_claim_reviews(
    requested_profile_id, candidate_person_id, club_id, reason, evidence
  ) values (
    target_profile_id, target_candidate_person_id, target_club_id, reason_value, evidence_value
  ) returning id into review_id;
  return review_id;
end;
$$;

create or replace function public.review_person_claim(
  target_review_id uuid,
  decision text,
  actor_profile_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  review public.person_claim_reviews;
  link_id uuid;
begin
  select * into review from public.person_claim_reviews where id = target_review_id for update;
  if review.id is null then raise exception 'PERSON_CLAIM_REVIEW_NOT_FOUND'; end if;
  if review.status <> 'pending' then raise exception 'PERSON_CLAIM_ALREADY_REVIEWED'; end if;
  if not public.is_active_club_admin(review.club_id, actor_profile_id) then
    raise exception 'CLUB_ADMIN_REQUIRED';
  end if;
  if decision = 'approved' then
    if review.candidate_person_id is null then raise exception 'PERSON_CLAIM_CANDIDATE_REQUIRED'; end if;
    link_id := public.link_person_account(
      review.candidate_person_id, review.requested_profile_id, 'admin_review', actor_profile_id
    );
  elsif decision <> 'rejected' then
    raise exception 'PERSON_CLAIM_DECISION_INVALID';
  end if;
  update public.person_claim_reviews set
    status = decision, reviewed_by = actor_profile_id, reviewed_at = timezone('utc', now())
  where id = review.id;
  insert into public.identity_audit_log(
    actor_profile_id, club_id, action, target_table, target_id, details
  ) values (
    actor_profile_id, review.club_id, 'claim_review_resolved',
    'person_claim_reviews', review.id, jsonb_build_object('decision', decision)
  );
  return link_id;
end;
$$;

-- Runs after the existing profile-creation trigger. A bad token aborts the whole signup.
create or replace function public.process_new_user_person_invitation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ? 'person_invite_token' then
    if new.raw_user_meta_data ? 'club_onboarding' then
      raise exception 'PERSON_INVITE_ONBOARDING_CONFLICT';
    end if;
    perform public.consume_person_account_invitation(
      new.raw_user_meta_data->>'person_invite_token', new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists zz_process_person_invitation on auth.users;
create trigger zz_process_person_invitation
after insert on auth.users
for each row execute function public.process_new_user_person_invitation();

-- Safe replacement: never update or select an unlinked placeholder by display_name.
create or replace function public.complete_club_team_onboarding(
  target_user_id uuid, user_email text, user_full_name text, onboarding jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  selected_club_id uuid;
  selected_team_id uuid;
  v_trainer_id uuid;
  v_person_id uuid;
  v_club_person_id uuid;
  v_role_assignment_id uuid;
  v_candidate_person_id uuid;
  v_candidate_count integer := 0;
  mode text := onboarding->>'club_mode';
  team_mode text := onboarding->>'team_mode';
  requested_role text := coalesce(onboarding->>'team_role', 'coach');
  club_name_value text := trim(coalesce(onboarding->>'club_name', ''));
  registration_value text := nullif(trim(coalesce(onboarding->>'registration_number', '')), '');
  team_name_value text := trim(coalesce(onboarding->>'team_name', ''));
  trainer_name_value text := coalesce(nullif(trim(user_full_name), ''), user_email);
  safe_display_name text;
  similar_club record;
begin
  if requested_role not in ('coach', 'assistant_coach', 'team_manager') then requested_role := 'coach'; end if;
  if mode = 'existing' then
    select id into selected_club_id from public.clubs
    where id = nullif(onboarding->>'club_id', '')::uuid and status = 'active';
    if selected_club_id is null then raise exception 'ONBOARDING_CLUB_NOT_FOUND'; end if;
  elsif mode = 'new' then
    if club_name_value = '' or team_name_value = '' then raise exception 'ONBOARDING_FIELDS_REQUIRED'; end if;
    if registration_value is not null then
      select id into selected_club_id from public.clubs
      where lower(trim(rbfa_registration_number)) = lower(registration_value);
      if selected_club_id is not null then raise exception 'DUPLICATE_REGISTRATION_USE_EXISTING'; end if;
    end if;
    if exists(select 1 from public.clubs where normalized_name = public.normalize_club_team_name(club_name_value))
      then raise exception 'DUPLICATE_CLUB_NAME_USE_EXISTING'; end if;
    select * into similar_club from public.clubs
    where similarity(normalized_name, public.normalize_club_team_name(club_name_value)) >= 0.72
    order by similarity(normalized_name, public.normalize_club_team_name(club_name_value)) desc limit 1;
    if found and not coalesce((onboarding->>'similar_club_acknowledged')::boolean, false)
      then raise exception 'SIMILAR_CLUB_REQUIRES_CONFIRMATION'; end if;
    insert into public.clubs(name, normalized_name, rbfa_registration_number, status, created_by)
    values (club_name_value, public.normalize_club_team_name(club_name_value), registration_value, 'active', target_user_id)
    returning id into selected_club_id;
  else raise exception 'ONBOARDING_MODE_INVALID';
  end if;

  -- Joining an existing club is a pending request, never self-granted active access.
  insert into public.club_memberships(club_id, profile_id, role, status)
  values(selected_club_id, target_user_id, 'trainer', case when mode = 'new' then 'active' else 'pending' end)
  on conflict(club_id, profile_id) do update set status = excluded.status;
  if mode = 'new' then update public.profiles set account_role = 'coach' where id = target_user_id; end if;

  if team_mode = 'existing' then
    select id into selected_team_id from public.club_teams
    where id = nullif(onboarding->>'team_id', '')::uuid and club_id = selected_club_id and status = 'active';
    if selected_team_id is null then raise exception 'ONBOARDING_TEAM_NOT_FOUND'; end if;
  elsif team_mode = 'new' or mode = 'new' then
    if team_name_value = '' then raise exception 'ONBOARDING_TEAM_REQUIRED'; end if;
    insert into public.club_teams(
      club_id, name, normalized_name, age_category, level_or_competition,
      status, created_by, approved_by, approved_at
    ) values (
      selected_club_id, team_name_value, public.normalize_club_team_name(team_name_value),
      nullif(trim(coalesce(onboarding->>'age_category', '')), ''),
      nullif(trim(coalesce(onboarding->>'level_or_competition', '')), ''),
      case when mode = 'new' then 'active' else 'pending' end, target_user_id,
      case when mode = 'new' then target_user_id else null end,
      case when mode = 'new' then timezone('utc', now()) else null end
    ) returning id into selected_team_id;
  else raise exception 'ONBOARDING_TEAM_MODE_INVALID';
  end if;

  insert into public.people(first_name, last_name, created_by)
  values (
    coalesce(nullif(split_part(trainer_name_value, ' ', 1), ''), trainer_name_value),
    coalesce(nullif(trim(substr(trainer_name_value, length(split_part(trainer_name_value, ' ', 1)) + 1)), ''), '-'),
    target_user_id
  ) returning id into v_person_id;
  insert into public.club_people(club_id, person_id, created_by)
  values(selected_club_id, v_person_id, target_user_id) returning id into v_club_person_id;
  select (array_agg(distinct p.id order by p.id))[1], count(distinct p.id)::integer
  into v_candidate_person_id, v_candidate_count
  from public.club_people cp join public.people p on p.id = cp.person_id
  where cp.club_id = selected_club_id and p.id <> v_person_id and p.status = 'active'
    and public.normalize_person_name(p.first_name || p.last_name)
      = public.normalize_person_name(trainer_name_value);
  if v_candidate_count > 0 then
    perform public.create_person_claim_review(
      target_user_id,
      case when v_candidate_count = 1 then v_candidate_person_id else null end,
      selected_club_id,
      case when v_candidate_count = 1 then 'name_match' else 'ambiguous_match' end,
      jsonb_build_object('new_person_id', v_person_id, 'candidate_count', v_candidate_count)
    );
  else
    perform public.link_person_account(v_person_id, target_user_id, 'self_registration', target_user_id);
  end if;

  safe_display_name := trainer_name_value;
  if exists (
    select 1 from public.club_trainers
    where club_id = selected_club_id and lower(trim(display_name)) = lower(trim(safe_display_name))
  ) then safe_display_name := trainer_name_value || ' · ' || left(target_user_id::text, 8); end if;
  insert into public.club_trainers(
    club_id, profile_id, club_person_id, display_name, invitation_status
  ) values (
    selected_club_id, target_user_id, v_club_person_id, safe_display_name, 'linked'
  ) returning id into v_trainer_id;

  insert into public.club_role_assignments(
    club_person_id, role_type, club_team_id, status, created_by
  ) values (
    v_club_person_id,
    case requested_role when 'assistant_coach' then 'assistant_trainer'
      when 'team_manager' then 'team_manager' else 'trainer' end,
    selected_team_id, case when mode = 'new' then 'active' else 'suspended' end, target_user_id
  ) returning id into v_role_assignment_id;
  insert into public.club_trainer_teams(
    trainer_id, club_team_id, role, status, club_role_assignment_id
  ) values (
    v_trainer_id, selected_team_id, requested_role,
    case when mode = 'new' then 'active' else 'pending' end, v_role_assignment_id
  );
end;
$$;

revoke all on function public.create_person_account_invitation(uuid,text,uuid,interval)
  from public, anon, authenticated;
revoke all on function public.consume_person_account_invitation(text,uuid)
  from public, anon, authenticated;
revoke all on function public.create_person_claim_review(uuid,uuid,uuid,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.review_person_claim(uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.complete_club_team_onboarding(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_person_account_invitation(uuid,text,uuid,interval) to service_role;
grant execute on function public.consume_person_account_invitation(text,uuid) to service_role;
grant execute on function public.create_person_claim_review(uuid,uuid,uuid,text,jsonb) to service_role;
grant execute on function public.review_person_claim(uuid,text,uuid) to service_role;

notify pgrst, 'reload schema';
