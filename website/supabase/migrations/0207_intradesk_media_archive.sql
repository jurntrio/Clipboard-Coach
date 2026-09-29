-- Intradesk season/team navigation and club-scoped media categories.
-- Existing training and media rows remain valid; unresolved training placement stays NULL.

alter table public.club_trainings
  add column if not exists season_id uuid references public.club_seasons(id) on delete set null,
  add column if not exists club_team_id uuid references public.club_teams(id) on delete set null;

create index if not exists club_trainings_tree_idx
  on public.club_trainings(club_id, season_id, club_team_id, status, updated_at desc);

create or replace function public.enforce_club_training_archive_path()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.season_id is not null and not exists (
    select 1 from public.club_seasons where id = new.season_id and club_id = new.club_id
  ) then raise exception 'TRAINING_SEASON_CLUB_MISMATCH'; end if;
  if new.club_team_id is not null and not exists (
    select 1 from public.club_teams where id = new.club_team_id and club_id = new.club_id and season_id = new.season_id
  ) then raise exception 'TRAINING_TEAM_PATH_MISMATCH'; end if;
  return new;
end $$;

drop trigger if exists trg_enforce_club_training_archive_path on public.club_trainings;
create trigger trg_enforce_club_training_archive_path before insert or update of club_id, season_id, club_team_id
on public.club_trainings for each row execute function public.enforce_club_training_archive_path();

-- Backfill to the best matching team in the active season. Prefer an exact age-name,
-- then the club's explicit display order, so an age with multiple variants is still visible.
with candidates as (
  select training.id, team.id as team_id, team.season_id,
    row_number() over (
      partition by training.id
      order by
        (regexp_replace(lower(team.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(training.age_category), '[^a-z0-9]', '', 'g')) desc,
        team.display_order,
        team.name
    ) as preference
  from public.club_trainings training
  join public.club_seasons season on season.club_id = training.club_id
    and (season.status = 'ACTIVE' or season.is_active)
  join public.club_teams team on team.club_id = training.club_id and team.season_id = season.id
    and team.status <> 'merged'
    and regexp_replace(lower(team.name), '[^a-z0-9]', '', 'g') like
      regexp_replace(lower(training.age_category), '[^a-z0-9]', '', 'g') || '%'
  where training.season_id is null and training.club_team_id is null
)
update public.club_trainings training set
  season_id = candidates.season_id,
  club_team_id = candidates.team_id
from candidates where candidates.id = training.id and candidates.preference = 1;

create table if not exists public.media_categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(regexp_replace(trim(name), '[[:space:]]+', ' ', 'g'))) stored,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, normalized_name)
);

create table if not exists public.clip_media_categories (
  clip_id uuid not null references public.clips(id) on delete cascade,
  category_id uuid not null references public.media_categories(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (clip_id, category_id)
);

create index if not exists media_categories_club_idx on public.media_categories(club_id, is_active, name);
create index if not exists clip_media_categories_category_idx on public.clip_media_categories(category_id, clip_id);

create or replace function public.enforce_clip_media_category_club()
returns trigger language plpgsql set search_path = public as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from public.media_categories where id = new.category_id;
  if v_club_id is null or not exists (
    select 1 from public.clips clip
    where clip.id = new.clip_id and (
      exists (
        select 1 from public.match_videos link
        join public.matches match_row on match_row.id = link.match_id
        where link.video_id = clip.video_id and match_row.club_id = v_club_id
      ) or exists (
        select 1 from public.teams operational_team
        join public.club_teams club_team on club_team.id = operational_team.club_team_id
        where operational_team.id = clip.team_id and club_team.club_id = v_club_id
      )
    )
  ) then raise exception 'CLIP_CATEGORY_CLUB_MISMATCH'; end if;
  return new;
end $$;

drop trigger if exists trg_enforce_clip_media_category_club on public.clip_media_categories;
create trigger trg_enforce_clip_media_category_club before insert or update on public.clip_media_categories
for each row execute function public.enforce_clip_media_category_club();

-- Provider-neutral storage metadata. Existing rows keep their current R2-backed behavior.
alter table public.videos
  add column if not exists storage_provider text not null default 'r2'
    check (storage_provider in ('r2', 'google_drive', 'external')),
  add column if not exists external_file_id text,
  add column if not exists external_parent_id text,
  add column if not exists storage_metadata jsonb not null default '{}'::jsonb;

insert into public.media_categories (club_id, name, is_default)
select club.id, category.name, true
from public.clubs club
cross join unnest(array[
  'Opbouw voor', 'Opbouw tegen', 'Hoekschoppen voor', 'Hoekschoppen tegen',
  'Doelpunten voor', 'Doelpunten tegen', 'Pressing voor', 'Pressing tegen',
  'Flankaanval', 'Centrale aanval'
]) as category(name)
on conflict (club_id, normalized_name) do nothing;

create or replace function public.seed_default_media_categories()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.media_categories (club_id, name, is_default)
  select new.id, category.name, true from unnest(array[
    'Opbouw voor', 'Opbouw tegen', 'Hoekschoppen voor', 'Hoekschoppen tegen',
    'Doelpunten voor', 'Doelpunten tegen', 'Pressing voor', 'Pressing tegen',
    'Flankaanval', 'Centrale aanval'
  ]) as category(name)
  on conflict (club_id, normalized_name) do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_default_media_categories on public.clubs;
create trigger trg_seed_default_media_categories after insert on public.clubs
for each row execute function public.seed_default_media_categories();

alter table public.media_categories enable row level security;
alter table public.clip_media_categories enable row level security;

create policy "Club staff can read media categories" on public.media_categories for select
using (exists (
  select 1 from public.club_people person
  join public.person_accounts account on account.person_id = person.person_id
    and account.profile_id = auth.uid() and account.status = 'active' and account.revoked_at is null
  join public.club_role_assignments role on role.club_person_id = person.id and role.status = 'active'
  where person.club_id = media_categories.club_id and person.status = 'active'
    and role.valid_from <= current_date and (role.valid_until is null or role.valid_until >= current_date)
));

create policy "Club admins manage media categories" on public.media_categories for all
using (public.is_active_club_admin(club_id, auth.uid()))
with check (public.is_active_club_admin(club_id, auth.uid()));

create policy "Club staff can read clip categories" on public.clip_media_categories for select
using (exists (
  select 1 from public.media_categories category
  where category.id = clip_media_categories.category_id
    and exists (
      select 1 from public.club_people person
      join public.person_accounts account on account.person_id = person.person_id
        and account.profile_id = auth.uid() and account.status = 'active' and account.revoked_at is null
      join public.club_role_assignments role on role.club_person_id = person.id and role.status = 'active'
      where person.club_id = category.club_id and person.status = 'active'
        and role.valid_from <= current_date and (role.valid_until is null or role.valid_until >= current_date)
    )
));

create policy "Club admins manage clip categories" on public.clip_media_categories for all
using (exists (
  select 1 from public.media_categories category
  where category.id = clip_media_categories.category_id
    and public.is_active_club_admin(category.club_id, auth.uid())
))
with check (exists (
  select 1 from public.media_categories category
  where category.id = clip_media_categories.category_id
    and public.is_active_club_admin(category.club_id, auth.uid())
));

grant select, insert, update, delete on public.media_categories to authenticated;
grant select, insert, update, delete on public.clip_media_categories to authenticated;

notify pgrst, 'reload schema';
