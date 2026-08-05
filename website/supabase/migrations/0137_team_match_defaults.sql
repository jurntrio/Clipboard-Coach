-- Reusable team match defaults, copied to each match as an editable snapshot.
alter table public.club_teams
  add column if not exists match_format text check (match_format in ('5v5', '8v8', '11v11')),
  add column if not exists match_period_count integer check (match_period_count between 1 and 12),
  add column if not exists match_period_minutes integer check (match_period_minutes between 1 and 120),
  add column if not exists match_minimum_players integer check (match_minimum_players between 1 and 30);

alter table public.matches
  add column if not exists match_format text check (match_format in ('5v5', '8v8', '11v11')),
  add column if not exists match_period_count integer check (match_period_count between 1 and 12),
  add column if not exists match_period_minutes integer check (match_period_minutes between 1 and 120),
  add column if not exists match_minimum_players integer check (match_minimum_players between 1 and 30);

create or replace function public.match_defaults_for_age_category(category text)
returns table(match_format text, period_count integer, period_minutes integer, minimum_players integer)
language sql immutable as $$
  select case
      when upper(trim(category)) ~ '^U([7-9])$' then '5v5'
      when upper(trim(category)) ~ '^U(10|11|12|13)$' then '8v8'
      when upper(trim(category)) ~ '^U(14|15|16|17|18|19)$' then '11v11'
      when upper(trim(category)) in ('SENIOREN', 'OUDEREN') then '11v11'
    end,
    case when upper(trim(category)) in ('SENIOREN', 'OUDEREN') then 2 else 4 end,
    case
      when upper(trim(category)) ~ '^U([7-9]|10|11)$' then 15
      when upper(trim(category)) ~ '^U(12|13|14|15|16|17|18|19)$' then 20
      when upper(trim(category)) in ('SENIOREN', 'OUDEREN') then 45
    end,
    case
      when upper(trim(category)) ~ '^U([7-9])$' then 5
      when upper(trim(category)) ~ '^U(10|11|12|13)$' then 8
      when upper(trim(category)) ~ '^U(14|15|16|17|18|19)$' or upper(trim(category)) in ('SENIOREN', 'OUDEREN') then 11
    end
  where category is not null and (
    upper(trim(category)) ~ '^U([7-9]|10|11|12|13|14|15|16|17|18|19)$'
    or upper(trim(category)) in ('SENIOREN', 'OUDEREN')
  );
$$;

with derived_defaults as (
  select team.id, defaults.*
  from public.club_teams team
  cross join lateral public.match_defaults_for_age_category(team.age_category) defaults
)
update public.club_teams team
set match_format = coalesce(team.match_format, defaults.match_format),
    match_period_count = coalesce(team.match_period_count, defaults.period_count),
    match_period_minutes = coalesce(team.match_period_minutes, defaults.period_minutes),
    match_minimum_players = coalesce(team.match_minimum_players, defaults.minimum_players)
from derived_defaults defaults
where defaults.id = team.id
  and (team.match_format is null or team.match_period_count is null
   or team.match_period_minutes is null or team.match_minimum_players is null);

create or replace function public.apply_team_match_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare team_defaults record;
begin
  if new.club_team_id is null then return new; end if;
  select match_format, match_period_count, match_period_minutes, match_minimum_players
    into team_defaults from public.club_teams where id = new.club_team_id;
  new.match_format := coalesce(new.match_format, team_defaults.match_format);
  new.match_period_count := coalesce(new.match_period_count, team_defaults.match_period_count);
  new.match_period_minutes := coalesce(new.match_period_minutes, team_defaults.match_period_minutes);
  new.match_minimum_players := coalesce(new.match_minimum_players, team_defaults.match_minimum_players);
  return new;
end;
$$;

drop trigger if exists apply_team_match_defaults_trigger on public.matches;
create trigger apply_team_match_defaults_trigger
before insert or update of club_team_id on public.matches
for each row execute function public.apply_team_match_defaults();

notify pgrst, 'reload schema';
