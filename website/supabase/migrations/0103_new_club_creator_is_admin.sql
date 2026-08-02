-- A genuinely new club needs an administrator immediately. Joining an existing
-- club remains a pending trainer request and never grants administrative access.

alter function public.complete_club_team_onboarding(uuid, text, text, jsonb)
  rename to complete_club_team_onboarding_before_first_admin;

create function public.complete_club_team_onboarding(
  target_user_id uuid,
  user_email text,
  user_full_name text,
  onboarding jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_club_id uuid;
begin
  perform public.complete_club_team_onboarding_before_first_admin(
    target_user_id,
    user_email,
    user_full_name,
    onboarding
  );

  if onboarding->>'club_mode' <> 'new' then
    return;
  end if;

  select club.id
  into selected_club_id
  from public.clubs club
  where club.created_by = target_user_id
    and club.normalized_name = public.normalize_club_team_name(onboarding->>'club_name')
  order by club.created_at desc
  limit 1;

  if selected_club_id is null then
    raise exception 'ONBOARDING_CREATED_CLUB_NOT_FOUND';
  end if;

  update public.club_memberships
  set role = 'club_admin',
      status = 'active',
      function_role = 'club_admin',
      team_scope = 'all'
  where club_id = selected_club_id
    and profile_id = target_user_id;

  update public.profiles
  set account_role = 'club_admin'
  where id = target_user_id;
end;
$$;

revoke all on function public.complete_club_team_onboarding_before_first_admin(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_club_team_onboarding(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_club_team_onboarding(uuid, text, text, jsonb)
  to service_role;

notify pgrst, 'reload schema';
