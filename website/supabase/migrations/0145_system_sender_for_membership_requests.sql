-- Membership requests are system notifications, not messages from the applicant.
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
  values (p_club_id, null, v_thread_id, p_subject, p_body)
  returning id into v_message_id;

  insert into public.mailbox_recipients(message_id, profile_id)
  select v_message_id, profile_id
  from public.club_memberships
  where club_id = p_club_id and role = 'club_admin' and status = 'active' and profile_id <> p_sender_id;
end;
$$;

revoke all on function public.notify_club_admins_of_pending_request(uuid, uuid, text, text)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
