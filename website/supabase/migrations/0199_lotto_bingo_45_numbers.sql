-- Belgian Lotto uses balls 1 through 45. Reject incompatible existing data
-- instead of silently changing a participant's choices or a recorded draw.
begin;
lock table public.lotto_bingo_participants, public.lotto_bingo_draws in access exclusive mode;
do $$ begin
  if exists (select 1 from public.lotto_bingo_participants where 46 = any(numbers))
    or exists (select 1 from public.lotto_bingo_draws where 46 = any(numbers)) then
    raise exception 'Corrigeer eerst de opgeslagen nummers 46; er worden geen nummers automatisch vervangen.';
  end if;
end $$;
create or replace function public.lotto_bingo_valid_numbers(numbers integer[], expected_count integer)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(array_ndims(numbers) = 1 and cardinality(numbers) = expected_count
    and (select count(distinct n) = expected_count and bool_and(n between 1 and 45) from unnest(numbers) n), false);
$$;
commit;
