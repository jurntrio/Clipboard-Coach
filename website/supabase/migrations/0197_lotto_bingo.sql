-- Independent public Clubboys module. No payment records or separate login.
begin;
create function public.lotto_bingo_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and account_role = 'platform_admin');
$$;
revoke all on function public.lotto_bingo_is_admin() from public;
grant execute on function public.lotto_bingo_is_admin() to anon, authenticated;

create function public.lotto_bingo_valid_numbers(numbers integer[], expected_count integer)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(array_ndims(numbers) = 1 and cardinality(numbers) = expected_count
    and (select count(distinct n) = expected_count and bool_and(n between 1 and 46) from unnest(numbers) n), false);
$$;

create table public.lotto_bingo_settings (
  id integer primary key default 1 check (id = 1),
  fee numeric(8,2) not null default 10 check (fee >= 0 and fee <= 10000),
  pot_pct numeric(5,2) not null default 50 check (pot_pct >= 0 and pot_pct <= 100),
  start_date date not null default '2026-10-03' check (extract(dow from start_date) = 6)
);
insert into public.lotto_bingo_settings(id) values (1);
create table public.lotto_bingo_participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  numbers integer[] not null check (public.lotto_bingo_valid_numbers(numbers, 10))
);
create table public.lotto_bingo_draws (
  id uuid primary key default gen_random_uuid(),
  draw_date date not null unique check (extract(dow from draw_date) = 6),
  numbers integer[] not null check (public.lotto_bingo_valid_numbers(numbers, 6))
);

-- Serialize changes against the singleton settings row, including start-date edits.
create function public.lotto_bingo_validate_dates()
returns trigger language plpgsql security definer set search_path = '' as $$
declare start_value date;
begin
  if tg_table_name = 'lotto_bingo_draws' then
    select start_date into start_value from public.lotto_bingo_settings where id = 1 for share;
    if start_value is null or new.draw_date < start_value then
      raise exception 'De trekking ligt voor de startdatum.' using errcode = '23514';
    end if;
  elsif tg_op = 'DELETE' then
    raise exception 'De spelinstellingen kunnen niet verwijderd worden.' using errcode = '23514';
  elsif exists (select 1 from public.lotto_bingo_draws where draw_date < new.start_date) then
    raise exception 'De startdatum mag niet na een bestaande trekking liggen.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger lotto_bingo_draw_dates before insert or update on public.lotto_bingo_draws
for each row execute function public.lotto_bingo_validate_dates();
create trigger lotto_bingo_settings_dates before update or delete on public.lotto_bingo_settings
for each row execute function public.lotto_bingo_validate_dates();

alter table public.lotto_bingo_participants enable row level security;
alter table public.lotto_bingo_draws enable row level security;
alter table public.lotto_bingo_settings enable row level security;
revoke all on public.lotto_bingo_participants, public.lotto_bingo_draws, public.lotto_bingo_settings from anon, authenticated;
grant select on public.lotto_bingo_participants, public.lotto_bingo_draws, public.lotto_bingo_settings to anon, authenticated;
grant insert, update, delete on public.lotto_bingo_participants, public.lotto_bingo_draws, public.lotto_bingo_settings to authenticated;
create policy lotto_participants_read on public.lotto_bingo_participants for select to anon, authenticated using (true);
create policy lotto_participants_write on public.lotto_bingo_participants for all to authenticated using ((select public.lotto_bingo_is_admin())) with check ((select public.lotto_bingo_is_admin()));
create policy lotto_draws_read on public.lotto_bingo_draws for select to anon, authenticated using (true);
create policy lotto_draws_write on public.lotto_bingo_draws for all to authenticated using ((select public.lotto_bingo_is_admin())) with check ((select public.lotto_bingo_is_admin()));
create policy lotto_settings_read on public.lotto_bingo_settings for select to anon, authenticated using (true);
create policy lotto_settings_write on public.lotto_bingo_settings for all to authenticated using ((select public.lotto_bingo_is_admin())) with check ((select public.lotto_bingo_is_admin()));
revoke all on function public.lotto_bingo_validate_dates() from public;

-- A single statement gives the page/export a consistent complete snapshot, without
-- PostgREST's default row limit silently truncating a larger competition.
create function public.lotto_bingo_snapshot()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'participants', coalesce((select jsonb_agg(to_jsonb(p) order by p.name, p.id) from public.lotto_bingo_participants p), '[]'::jsonb),
    'draws', coalesce((select jsonb_agg(to_jsonb(d) order by d.draw_date) from public.lotto_bingo_draws d), '[]'::jsonb),
    'settings', (select to_jsonb(s) from public.lotto_bingo_settings s where s.id = 1)
  );
$$;
revoke all on function public.lotto_bingo_snapshot() from public;
grant execute on function public.lotto_bingo_snapshot() to anon, authenticated;
notify pgrst, 'reload schema';
commit;
