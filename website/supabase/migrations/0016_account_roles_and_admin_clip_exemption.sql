-- Server-managed application roles. Platform admin remains the private
-- ADMIN_EMAILS allowlist; Club Admin is assignable only through that admin UI.
alter table public.profiles
  add column if not exists account_role text not null default 'coach'
    check (account_role in ('coach', 'club_admin')),
  add column if not exists clip_limit_exempt boolean not null default false;

update public.profiles
set clip_limit_exempt = true
where lower(email) = 'jurntrio@gmail.com';

create or replace function public.enforce_clip_lifetime_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
  current_total integer;
  is_exempt boolean;
begin
  select coalesce(plan, 'free'), clips_created_total, clip_limit_exempt
    into current_plan, current_total, is_exempt
  from public.profiles
  where id = new.coach_id
  for update;

  if not found then
    raise exception using message = 'CLIP_PROFILE_NOT_FOUND', errcode = 'P0001';
  end if;

  if not is_exempt and current_plan <> 'pro' and current_total >= 20 then
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
    new.clips_created_total is distinct from old.clips_created_total or
    new.account_role is distinct from old.account_role or
    new.clip_limit_exempt is distinct from old.clip_limit_exempt
  ) then
    raise exception using message = 'PROFILE_ENTITLEMENTS_ARE_SERVER_MANAGED', errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_entitlements() from public;
notify pgrst, 'reload schema';
