alter table public.matches
  add column if not exists match_type text
  check (match_type in ('friendly', 'competition'));

comment on column public.matches.match_type is
  'SVS classification used to distinguish friendly and competition matches.';

create or replace function public.classify_ip_u13_green_match_type()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  team_name text;
begin
  if new.match_type is not null or new.club_team_id is null then return new; end if;
  select name into team_name from public.club_teams where id = new.club_team_id;
  if lower(trim(coalesce(team_name, ''))) <> 'ip u13 groen' then return new; end if;

  new.match_type := case
    when lower(coalesce(new.official_series_name, '')) ~ '(vriend|oefen|friendly)' then 'friendly'
    when nullif(trim(coalesce(new.official_series_id, '')), '') is not null
      or nullif(trim(coalesce(new.official_series_name, '')), '') is not null then 'competition'
    else 'friendly'
  end;
  return new;
end;
$$;

drop trigger if exists classify_ip_u13_green_match_type on public.matches;
create trigger classify_ip_u13_green_match_type
before insert or update of club_team_id, official_series_id, official_series_name, match_type
on public.matches for each row execute function public.classify_ip_u13_green_match_type();

update public.matches match
set match_type = case
  when lower(coalesce(match.official_series_name, '')) ~ '(vriend|oefen|friendly)' then 'friendly'
  when nullif(trim(coalesce(match.official_series_id, '')), '') is not null
    or nullif(trim(coalesce(match.official_series_name, '')), '') is not null then 'competition'
  else 'friendly'
end
from public.club_teams team
where team.id = match.club_team_id
  and lower(trim(team.name)) = 'ip u13 groen'
  and match.match_type is null;

notify pgrst, 'reload schema';
