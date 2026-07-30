create table if not exists public.match_dossiers (
  match_id uuid primary key references public.matches(id) on delete cascade,
  lineup_notes text not null default '',
  general_report text not null default '',
  positives text not null default '',
  improvements text not null default '',
  highlights text not null default '',
  goals text not null default '',
  cards text not null default '',
  chances text not null default '',
  scouting text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.match_dossiers enable row level security;

create policy "Club staff can view accessible match dossiers"
  on public.match_dossiers for select
  using (public.can_access_club_match(match_id, auth.uid()));

revoke insert, update, delete on public.match_dossiers from authenticated, anon;
