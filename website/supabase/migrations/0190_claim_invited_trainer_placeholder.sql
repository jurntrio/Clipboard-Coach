-- A club invitation can target a trainer who already exists as an unlinked
-- placeholder. Claim that row before the legacy projection tries to insert a
-- duplicate (club_id, display_name).

create or replace function public.claim_invited_trainer_placeholder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  placeholder_id uuid;
begin
  if new.profile_id is null then
    return new;
  end if;

  select trainer.id into placeholder_id
  from public.club_trainers trainer
  where trainer.club_id = new.club_id
    and lower(trim(trainer.display_name)) = lower(trim(new.display_name))
    and trainer.profile_id is null
  for update;

  if placeholder_id is null then
    return new;
  end if;

  update public.club_trainers
  set profile_id = new.profile_id,
      phone_number = coalesce(new.phone_number, phone_number),
      invitation_status = 'linked'
  where id = placeholder_id;

  -- The requested insert has been fulfilled by claiming the placeholder.
  return null;
end;
$$;

drop trigger if exists aa_claim_invited_trainer_placeholder_trigger on public.club_trainers;
create trigger aa_claim_invited_trainer_placeholder_trigger
before insert on public.club_trainers
for each row execute function public.claim_invited_trainer_placeholder();
