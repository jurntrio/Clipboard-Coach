-- Interne mailbox: berichten naar individuen of naar afgeleide groepen (staf/contactpersonen
-- per team), met een volledige-tekst e-mailkopie. Geen losse groepentabel: een groep is altijd
-- "staf van team X" of "contactpersonen van team X", afgeleid uit de bestaande toegangslogica
-- (club_member_can_access_team / player_guardians) zodat verzendrechten automatisch dezelfde
-- per-team inperking volgen als de rest van de app.

alter table public.profiles
  add column if not exists mailbox_email_notifications boolean not null default true;

create table if not exists public.mailbox_messages (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null,
  thread_id uuid not null,
  subject text not null,
  body text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_mailbox_messages_thread on public.mailbox_messages(thread_id, created_at);
create index if not exists idx_mailbox_messages_club on public.mailbox_messages(club_id);

-- Wat er precies gekozen werd bij verzending, enkel voor weergave/audit (niet voor delivery,
-- dat gebeurt via mailbox_recipients). label is een momentopname van de naam op verzendmoment,
-- zodat het bericht correct blijft weergeven als een team later hernoemd wordt.
create table if not exists public.mailbox_message_targets (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.mailbox_messages(id) on delete cascade not null,
  target_type text not null check (target_type in ('user', 'team_staff', 'team_contacts')),
  club_team_id uuid references public.club_teams(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  label text not null
);

create index if not exists idx_mailbox_message_targets_message on public.mailbox_message_targets(message_id);

-- De opgeloste fan-out: dit is de eigenlijke inbox per gebruiker.
create table if not exists public.mailbox_recipients (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.mailbox_messages(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  read_at timestamp with time zone,
  emailed_at timestamp with time zone,
  unique (message_id, profile_id)
);

create index if not exists idx_mailbox_recipients_profile on public.mailbox_recipients(profile_id, message_id);

alter table public.mailbox_messages enable row level security;
alter table public.mailbox_message_targets enable row level security;
alter table public.mailbox_recipients enable row level security;

-- Beheer verloopt via gecontroleerde API-routes met de service role (zelfde patroon als
-- club_trainer_players in 0096): geen client-side policies nodig.

-- Alle stafleden van een club die toegang hebben tot een bepaald team (zelfde regels als
-- club_member_can_access_team, enkel omgekeerd opgevraagd: niet "mag lid X team Y zien" maar
-- "wie mag team Y zien").
create or replace function public.club_team_staff_profile_ids(
  target_club_id uuid, target_club_team_id uuid
) returns setof uuid
language sql stable security definer set search_path = public as $$
  select membership.profile_id
  from public.club_memberships membership
  where membership.club_id = target_club_id
    and membership.status = 'active'
    and public.club_member_can_access_team(target_club_id, membership.profile_id, target_club_team_id);
$$;

grant execute on function public.club_team_staff_profile_ids(uuid, uuid) to authenticated;

-- Alle contactpersonen (guardians) van spelers in een bepaald team, mirror van de twee
-- UNION-takken in guardian_dashboard_players() (0034), maar gefilterd op team i.p.v. op
-- auth.uid(), en teruggevend welk profile_id in plaats van welke speler.
create or replace function public.club_team_contact_profile_ids(
  target_club_team_id uuid
) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct pg.profile_id
  from public.player_guardians pg
  join public.players p on p.id = pg.player_id
  join public.teams t on t.id = p.team_id
  where t.club_team_id = target_club_team_id
    and pg.player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
  union
  select distinct pg.profile_id
  from public.player_guardians pg
  join public.player_team_memberships ptm on ptm.club_player_id = pg.club_player_id
  join public.club_seasons cs on cs.id = ptm.season_id
  join public.players p on p.membership_id = ptm.id
  join public.teams t on t.id = p.team_id
  where t.club_team_id = target_club_team_id
    and pg.club_player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
    and (
      pg.access_scope = 'all_history'
      or (pg.access_scope = 'current_season' and cs.is_active)
      or (pg.access_scope = 'from_acceptance' and coalesce(cs.ends_on, 'infinity'::date) >= pg.valid_from::date)
    );
$$;

grant execute on function public.club_team_contact_profile_ids(uuid) to authenticated;

notify pgrst, 'reload schema';
