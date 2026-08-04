-- Optional commercial configuration for existing HOME matches. Games remains
-- the source of truth; no date, opponent or kickoff data is copied here.

create table public.sponsor_match_configurations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  selection_source text not null default 'manual' check (selection_source in ('manual','automatic')),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(match_id)
);

create table public.sponsor_match_partners (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null references public.sponsor_match_configurations(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  partner_role text not null check (partner_role in ('match_sponsor','match_ball_donor')),
  priority_weight smallint not null check (priority_weight in (90,100)),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(configuration_id,sponsor_id,partner_role)
);

create or replace function public.enforce_home_match_sponsoring()
returns trigger language plpgsql set search_path=public as $$
declare match_club uuid; home_match boolean;
begin
  select club_id,is_home_match into match_club,home_match from public.matches where id=new.match_id;
  if match_club is null or match_club<>new.club_id then raise exception 'SPONSOR_MATCH_CLUB_MISMATCH'; end if;
  if home_match is not true then raise exception 'SPONSORING_ONLY_ALLOWED_FOR_HOME_MATCHES'; end if;
  return new;
end;$$;
create trigger trg_home_match_sponsoring before insert or update on public.sponsor_match_configurations
for each row execute function public.enforce_home_match_sponsoring();

create or replace function public.enforce_match_partner_context()
returns trigger language plpgsql set search_path=public as $$
declare config_club uuid; sponsor_club uuid;
begin
  select club_id into config_club from public.sponsor_match_configurations where id=new.configuration_id;
  select club_id into sponsor_club from public.sponsors where id=new.sponsor_id;
  if config_club is null or sponsor_club is null or config_club<>sponsor_club then raise exception 'SPONSOR_MATCH_PARTNER_CLUB_MISMATCH'; end if;
  new.priority_weight:=case when new.partner_role='match_sponsor' then 100 else 90 end;
  return new;
end;$$;
create trigger trg_match_partner_context before insert or update on public.sponsor_match_partners
for each row execute function public.enforce_match_partner_context();
create trigger trg_sponsor_match_config_updated_at before update on public.sponsor_match_configurations
for each row execute function public.set_updated_at();

alter table public.sponsor_match_configurations enable row level security;
alter table public.sponsor_match_partners enable row level security;

-- One canonical, deduplicated context for future ClubTV/SVC consumers.
create or replace function public.sponsor_context_for_match(target_match_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
with match_context as (
  select id,club_id,club_team_id,season_id,match_date,is_home_match from public.matches where id=target_match_id
), candidates as (
  select a.sponsor_id,'scope'::text reason,
    case a.sponsor_level when 'main_sponsor' then 30 when 'partner' then 20 else 10 end weight,
    scope.name detail
  from match_context m join public.sponsor_scope_teams st on st.club_team_id=m.club_team_id and st.season_id=m.season_id
  join public.sponsor_scopes scope on scope.id=st.scope_id and scope.active
  join public.sponsor_assignment_scopes link on link.scope_id=scope.id
  join public.sponsor_assignments a on a.id=link.assignment_id and a.status='active' and (a.season_id is null or a.season_id=m.season_id)
    and (a.starts_on is null or a.starts_on<=m.match_date) and (a.ends_on is null or a.ends_on>=m.match_date)
  union all
  select a.sponsor_id,'clubwide',case a.sponsor_level when 'main_sponsor' then 30 when 'partner' then 20 else 10 end,scope.name
  from match_context m join public.sponsor_scopes scope on scope.club_id=m.club_id and scope.is_clubwide and scope.active
  join public.sponsor_assignment_scopes link on link.scope_id=scope.id
  join public.sponsor_assignments a on a.id=link.assignment_id and a.status='active' and (a.season_id is null or a.season_id=m.season_id)
    and (a.starts_on is null or a.starts_on<=m.match_date) and (a.ends_on is null or a.ends_on>=m.match_date)
  union all
  select relation.sponsor_id,relation.relation_type,relation.priority_weight,coalesce(relation.accent_level,'specific')
  from match_context m join public.sponsor_team_relations relation on relation.club_team_id=m.club_team_id and relation.season_id=m.season_id and relation.active
  union all
  select partner.sponsor_id,partner.partner_role,partner.priority_weight,partner.partner_role
  from match_context m join public.sponsor_match_configurations config on config.match_id=m.id and config.active
  join public.sponsor_match_partners partner on partner.configuration_id=config.id
), grouped as (
  select sponsor_id,max(weight) priority_weight,jsonb_agg(distinct jsonb_build_object('type',reason,'detail',detail)) reasons
  from candidates group by sponsor_id
)
select case when m.is_home_match is not true then jsonb_build_object('matchId',m.id,'isHomeMatch',false,'sponsors','[]'::jsonb)
else jsonb_build_object('matchId',m.id,'isHomeMatch',true,'sponsors',coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'companyName',s.company_name,'logoUrl',s.logo_url,'websiteUrl',s.website_url,
  'priorityWeight',g.priority_weight,'reasons',g.reasons) order by g.priority_weight desc,s.company_name) filter(where s.id is not null),'[]'::jsonb)) end
from match_context m left join grouped g on true left join public.sponsors s on s.id=g.sponsor_id and s.active group by m.id,m.is_home_match;
$$;
revoke all on function public.sponsor_context_for_match(uuid) from public,anon,authenticated;
grant execute on function public.sponsor_context_for_match(uuid) to service_role;

notify pgrst,'reload schema';
