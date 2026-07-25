-- Immutable evidence that an account holder accepted the applicable legal
-- versions during registration. Rows are written only by the auth trigger.
create table if not exists public.legal_acceptances (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  terms_version text not null,
  privacy_version text not null,
  statement_version text not null,
  locale text not null check (locale in ('nl', 'en')),
  accepted_at timestamp with time zone not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_legal_acceptances_user_id on public.legal_acceptances(user_id);
alter table public.legal_acceptances enable row level security;

drop policy if exists "Users can view own legal acceptances" on public.legal_acceptances;
create policy "Users can view own legal acceptances"
  on public.legal_acceptances for select
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at_value timestamp with time zone;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.standard_tags (coach_id, name, is_protected)
  values
    (new.id, 'Start', true),
    (new.id, 'Goal', true);

  if coalesce(new.raw_user_meta_data->>'legal_accepted', 'false') = 'true'
    and new.raw_user_meta_data->>'terms_version' is not null
    and new.raw_user_meta_data->>'privacy_version' is not null
    and new.raw_user_meta_data->>'legal_statement_version' is not null then
    begin
      accepted_at_value := (new.raw_user_meta_data->>'legal_accepted_at')::timestamp with time zone;
    exception when others then
      accepted_at_value := timezone('utc'::text, now());
    end;

    insert into public.legal_acceptances (
      user_id, terms_version, privacy_version, statement_version, locale, accepted_at
    ) values (
      new.id,
      new.raw_user_meta_data->>'terms_version',
      new.raw_user_meta_data->>'privacy_version',
      new.raw_user_meta_data->>'legal_statement_version',
      case when new.raw_user_meta_data->>'legal_locale' = 'en' then 'en' else 'nl' end,
      accepted_at_value
    );
  end if;

  return new;
end;
$$;
