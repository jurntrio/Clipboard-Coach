create or replace function public.classify_ip_u13_green_match_type()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  team_name text;
begin
  if new.club_team_id is null then return new; end if;
  select name into team_name from public.club_teams where id = new.club_team_id;
  if lower(trim(coalesce(team_name, ''))) <> 'ip u13 groen' then return new; end if;

  new.match_type := case
    when upper(trim(coalesce(new.official_series_name, ''))) ~ '^IP13' then 'competition'
    else 'friendly'
  end;
  return new;
end;
$$;

update public.matches match
set match_type = case
  when upper(trim(coalesce(match.official_series_name, ''))) ~ '^IP13' then 'competition'
  else 'friendly'
end
from public.club_teams team
where team.id = match.club_team_id
  and lower(trim(team.name)) = 'ip u13 groen';

notify pgrst, 'reload schema';
