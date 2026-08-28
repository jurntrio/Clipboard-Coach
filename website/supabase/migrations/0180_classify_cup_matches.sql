alter table public.matches
  drop constraint if exists matches_match_type_check;

alter table public.matches
  add constraint matches_match_type_check
  check (match_type in ('friendly', 'competition', 'cup'));

create or replace function public.svs_match_type(series_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when nullif(trim(coalesce(series_name, '')), '') is null then 'friendly'
    when upper(trim(series_name)) like 'B%' then 'cup'
    when lower(series_name) ~ '(vriend|oefen|friendly)' then 'friendly'
    when lower(regexp_replace(series_name, '[[:space:]]+', '', 'g')) ~ '^u[0-9]+/u[0-9]+$' then 'friendly'
    else 'competition'
  end;
$$;

update public.matches
set match_type = public.svs_match_type(official_series_name)
where match_type is distinct from public.svs_match_type(official_series_name);

comment on column public.matches.match_type is
  'SVS classification: friendly, regular competition, or cup (official series name starts with B).';
