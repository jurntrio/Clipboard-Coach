-- A paid standalone trainer owns a private club tenant. Keep the training
-- bundle in that tenant aligned with the profile plan so the drawing tool and
-- private Intradesk work without a manual platform-admin module toggle.

create or replace function public.sync_paid_personal_trainer_modules()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  personal_club_id uuid;
  paid boolean := new.plan = 'pro' and coalesce(new.subscription_status, 'active') not in ('canceled', 'unpaid', 'incomplete_expired');
begin
  for personal_club_id in
    select club.id
    from public.clubs club
    where club.is_personal and club.created_by = new.id
  loop
    insert into public.club_module_entitlements(club_id, module_key, enabled)
    values
      (personal_club_id, 'training', true),
      (personal_club_id, 'intradesk', true),
      (personal_club_id, 'training_builder', paid)
    on conflict (club_id, module_key) do update set enabled = excluded.enabled;
  end loop;
  return new;
end;
$$;

revoke all on function public.sync_paid_personal_trainer_modules() from public, anon, authenticated;

drop trigger if exists sync_paid_personal_trainer_modules_trigger on public.profiles;
create trigger sync_paid_personal_trainer_modules_trigger
after update of plan, subscription_status on public.profiles
for each row
when (old.plan is distinct from new.plan or old.subscription_status is distinct from new.subscription_status)
execute function public.sync_paid_personal_trainer_modules();

insert into public.club_module_entitlements(club_id, module_key, enabled)
select club.id, module.module_key, true
from public.clubs club
join public.profiles profile on profile.id = club.created_by and profile.plan = 'pro'
cross join (values ('training'), ('training_builder'), ('intradesk')) as module(module_key)
where club.is_personal
on conflict (club_id, module_key) do update set enabled = true;

notify pgrst, 'reload schema';
