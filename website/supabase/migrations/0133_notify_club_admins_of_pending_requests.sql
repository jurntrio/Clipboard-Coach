-- A pending club-membership or team request currently only surfaces via a badge count
-- the admin sees on their next dashboard visit. Push it into the mailbox too, so an admin
-- who isn't actively watching the app still finds out. Uses the existing mailbox tables
-- (not e-mail): a system-style message from the requester, addressed to every active
-- club_admin of the club. If a club somehow has no active club_admin, nothing is sent.

create or replace function public.notify_club_admins_of_pending_request(
  p_club_id uuid, p_sender_id uuid, p_subject text, p_body text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_message_id uuid;
  v_thread_id uuid := gen_random_uuid();
  v_recipient_count integer;
begin
  select count(*) into v_recipient_count
  from public.club_memberships
  where club_id = p_club_id and role = 'club_admin' and status = 'active' and profile_id <> p_sender_id;
  if v_recipient_count = 0 then return; end if;

  insert into public.mailbox_messages(club_id, sender_id, thread_id, subject, body)
  values (p_club_id, p_sender_id, v_thread_id, p_subject, p_body)
  returning id into v_message_id;

  insert into public.mailbox_recipients(message_id, profile_id)
  select v_message_id, profile_id
  from public.club_memberships
  where club_id = p_club_id and role = 'club_admin' and status = 'active' and profile_id <> p_sender_id;
end;
$$;

revoke all on function public.notify_club_admins_of_pending_request(uuid, uuid, text, text)
  from public, anon, authenticated;

create or replace function public.complete_club_team_onboarding_before_first_admin(
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
  v_team_name text;
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

  if mode = 'existing' then
    select name into v_team_name from public.club_teams where id = selected_team_id;
    perform public.notify_club_admins_of_pending_request(
      selected_club_id, target_user_id,
      'Nieuwe aanvraag om lid te worden',
      trainer_name_value || ' vraagt toegang tot de club als trainer' ||
        case when team_mode = 'new'
          then ' en wil een nieuw team aanmaken: "' || team_name_value || '".'
          else ' voor team "' || coalesce(v_team_name, team_name_value) || '".'
        end ||
        ' Ga naar Clubbeheer > Goedkeuringen om deze aanvraag te bekijken.'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
