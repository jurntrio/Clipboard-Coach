drop trigger if exists classify_ip_u13_green_match_type on public.matches;
drop function if exists public.classify_ip_u13_green_match_type();

create or replace function public.svs_match_type(series_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(coalesce(series_name, '')), '') is null then 'friendly'
    when lower(series_name) ~ '(vriend|oefen|friendly)' then 'friendly'
    when lower(regexp_replace(series_name, '[[:space:]]+', '', 'g')) ~ '^u[0-9]+/u[0-9]+$' then 'friendly'
    else 'competition'
  end;
$$;

create or replace function public.classify_match_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.match_type := public.svs_match_type(new.official_series_name);
  return new;
end;
$$;

drop trigger if exists classify_match_type on public.matches;
create trigger classify_match_type
before insert or update of official_series_name, match_type
on public.matches for each row execute function public.classify_match_type();

update public.matches
set match_type = public.svs_match_type(official_series_name)
where match_type is distinct from public.svs_match_type(official_series_name);

notify pgrst, 'reload schema';
