-- Free accounts may create at most 20 clips over their lifetime. Deleting a
-- clip deliberately does not restore quota. Pro accounts remain unlimited,
-- but their creations are still counted for a possible later downgrade.

alter table public.profiles
  add column if not exists clips_created_total integer not null default 0
  check (clips_created_total >= 0);

-- Deleted historic clips cannot be reconstructed. Preserve at least the
-- number of clips that still exists when this migration is installed.
update public.profiles as profile
set clips_created_total = greatest(
  profile.clips_created_total,
  (select count(*)::integer from public.clips where coach_id = profile.id)
);

create or replace function public.enforce_clip_lifetime_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
  current_total integer;
begin
  select coalesce(plan, 'free'), clips_created_total
    into current_plan, current_total
  from public.profiles
  where id = new.coach_id
  for update;

  if not found then
    raise exception using message = 'CLIP_PROFILE_NOT_FOUND', errcode = 'P0001';
  end if;

  if current_plan <> 'pro' and current_total >= 20 then
    raise exception using message = 'FREE_CLIP_LIMIT_REACHED', errcode = 'P0001';
  end if;

  update public.profiles
  set clips_created_total = current_total + 1,
      updated_at = timezone('utc'::text, now())
  where id = new.coach_id;

  return new;
end;
$$;

revoke all on function public.enforce_clip_lifetime_limit() from public;

drop trigger if exists enforce_clip_lifetime_limit_before_insert on public.clips;
create trigger enforce_clip_lifetime_limit_before_insert
  before insert on public.clips
  for each row execute function public.enforce_clip_lifetime_limit();

-- Owners can edit their profile, so billing and quota fields need a guard.
-- Service-role billing/webhook updates remain allowed.
create or replace function public.protect_profile_entitlements()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and auth.uid() = old.id and pg_trigger_depth() = 1 and (
    new.plan is distinct from old.plan or
    new.stripe_customer_id is distinct from old.stripe_customer_id or
    new.stripe_subscription_id is distinct from old.stripe_subscription_id or
    new.subscription_status is distinct from old.subscription_status or
    new.clips_created_total is distinct from old.clips_created_total
  ) then
    raise exception using message = 'PROFILE_ENTITLEMENTS_ARE_SERVER_MANAGED', errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_entitlements() from public;

drop trigger if exists protect_profile_entitlements_before_update on public.profiles;
create trigger protect_profile_entitlements_before_update
  before update on public.profiles
  for each row execute function public.protect_profile_entitlements();
