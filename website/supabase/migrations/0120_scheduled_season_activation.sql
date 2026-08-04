-- Capacity-aware scheduling and a service-role worker for lightweight activation.

create or replace function public.reserve_season_transition(target_club_id uuid,target_season_id uuid,target_slot_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare slot_row record; reservation_id uuid; used_capacity integer; message_id uuid:=gen_random_uuid();
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_SCHEDULE_FORBIDDEN'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  select * into slot_row from public.season_activation_slots where id=target_slot_id for update;
  if slot_row.id is null or slot_row.starts_at<=now() or slot_row.closes_at<=now() then raise exception 'SLOT_CLOSED'; end if;
  select count(*) into used_capacity from public.season_transition_reservations where slot_id=target_slot_id and status in ('SCHEDULED','RUNNING');
  if used_capacity>=slot_row.capacity then raise exception 'SLOT_FULL'; end if;
  update public.season_transition_reservations set status='CANCELLED',updated_at=now() where club_id=target_club_id and season_id=target_season_id and status='SCHEDULED';
  insert into public.season_transition_reservations(club_id,season_id,slot_id,status,created_by)
  values(target_club_id,target_season_id,target_slot_id,'SCHEDULED',auth.uid()) returning id into reservation_id;
  insert into public.mailbox_messages(id,club_id,sender_id,thread_id,subject,body)
  values(message_id,target_club_id,auth.uid(),message_id,'Seizoensovergang gepland','De seizoensovergang is gepland voor '||slot_row.starts_at::text||' UTC.');
  insert into public.mailbox_recipients(message_id,profile_id) select message_id,profile_id from public.club_memberships where club_id=target_club_id and role in ('club_admin','club_admin_viewer') and status='active' on conflict do nothing;
  return reservation_id;
end $$;

create or replace function public.cancel_season_transition(target_club_id uuid,target_season_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_SCHEDULE_FORBIDDEN'; end if;
  update public.season_transition_reservations reservation set status='CANCELLED',updated_at=now()
  from public.season_activation_slots slot where reservation.slot_id=slot.id and reservation.club_id=target_club_id and reservation.season_id=target_season_id and reservation.status='SCHEDULED' and slot.closes_at>now();
  if not found then raise exception 'RESERVATION_NOT_CHANGEABLE'; end if;
end $$;

create or replace function public.execute_due_season_transitions(batch_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public as $$
declare reservation record; checks jsonb; run_id uuid; completed integer:=0; failed integer:=0; message_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'WORKER_FORBIDDEN'; end if;
  for reservation in select r.*,s.starts_at from public.season_transition_reservations r join public.season_activation_slots s on s.id=r.slot_id
    where r.status='SCHEDULED' and s.starts_at<=now() order by s.starts_at for update of r skip locked limit least(greatest(batch_limit,1),50)
  loop
    begin
      update public.season_transition_reservations set status='RUNNING',updated_at=now() where id=reservation.id;
      perform pg_advisory_xact_lock(hashtextextended(reservation.club_id::text,0));
      if exists(select 1 from public.club_seasons where id=reservation.season_id and club_id=reservation.club_id and status='ACTIVE') then
        update public.season_transition_reservations set status='COMPLETED',updated_at=now() where id=reservation.id; completed:=completed+1; continue;
      end if;
      checks:='[]'::jsonb;
      if not exists(select 1 from public.club_seasons where id=reservation.season_id and club_id=reservation.club_id and status='PREPARATION') then checks:=checks||jsonb_build_object('level','ERROR','code','INVALID_TARGET','message','Doelseizoen is niet in voorbereiding.'); end if;
      if not exists(select 1 from public.club_teams where club_id=reservation.club_id and season_id=reservation.season_id and status<>'merged') then checks:=checks||jsonb_build_object('level','ERROR','code','NO_TEAMS','message','Geen teams voorbereid.'); end if;
      if exists(select 1 from jsonb_array_elements(checks) item where item->>'level'='ERROR') then raise exception 'PREFLIGHT_BLOCKED: %',checks::text; end if;
      insert into public.season_transition_runs(club_id,season_id,status,trigger_source,checks) values(reservation.club_id,reservation.season_id,'RUNNING','SCHEDULED',checks) returning id into run_id;
      update public.club_seasons set is_active=false,status='ARCHIVED',archived_at=coalesce(archived_at,now()) where club_id=reservation.club_id and status='ACTIVE' and id<>reservation.season_id;
      update public.club_seasons set is_active=true,status='ACTIVE',activation_at=coalesce(activation_at,now()),archived_at=null where id=reservation.season_id and club_id=reservation.club_id;
      update public.season_transition_runs set status='COMPLETED',completed_at=now() where id=run_id;
      update public.season_transition_reservations set status='COMPLETED',updated_at=now() where id=reservation.id;
      message_id:=gen_random_uuid();insert into public.mailbox_messages(id,club_id,sender_id,thread_id,subject,body) values(message_id,reservation.club_id,null,message_id,'Nieuw seizoen actief','Het voorbereide seizoen is succesvol geactiveerd.');
      insert into public.mailbox_recipients(message_id,profile_id) select message_id,profile_id from public.club_memberships where club_id=reservation.club_id and role in ('club_admin','club_admin_viewer') and status='active' on conflict do nothing;
      completed:=completed+1;
    exception when others then
      update public.season_transition_reservations set status='FAILED',updated_at=now() where id=reservation.id;
      insert into public.season_transition_runs(club_id,season_id,status,trigger_source,checks,error_message,completed_at)
      values(reservation.club_id,reservation.season_id,'FAILED','SCHEDULED',coalesce(checks,'[]'::jsonb),sqlerrm,now());
      failed:=failed+1;run_id:=null;
    end;
  end loop;
  return jsonb_build_object('completed',completed,'failed',failed);
end $$;

revoke all on function public.reserve_season_transition(uuid,uuid,uuid) from public,anon;
revoke all on function public.cancel_season_transition(uuid,uuid) from public,anon;
revoke all on function public.execute_due_season_transitions(integer) from public,anon,authenticated;
grant execute on function public.reserve_season_transition(uuid,uuid,uuid) to authenticated;
grant execute on function public.cancel_season_transition(uuid,uuid) to authenticated;
grant execute on function public.execute_due_season_transitions(integer) to service_role;
notify pgrst,'reload schema';
