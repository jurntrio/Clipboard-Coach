-- Auditable, idempotent selection communication batches and recipient delivery state.
create table if not exists public.match_selection_sends (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sent_by uuid references public.profiles(id) on delete set null,
  idempotency_key uuid not null,
  selection_fingerprint text not null,
  notify_not_selected boolean not null default false,
  include_selected_attention boolean not null default true,
  include_not_selected_attention boolean not null default true,
  status text not null check (status in ('sending', 'sent', 'partial', 'failed')) default 'sending',
  intended_recipient_count integer not null default 0,
  sent_recipient_count integer not null default 0,
  failed_recipient_count integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz,
  unique (match_id, idempotency_key)
);

create table if not exists public.match_selection_send_recipients (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.match_selection_sends(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  player_selected boolean not null,
  recipient_type text not null check (recipient_type in ('player', 'contact')),
  recipient_email text not null,
  recipient_name text,
  attention_included boolean not null default false,
  status text not null check (status in ('pending', 'sent', 'failed')) default 'pending',
  sent_at timestamptz,
  unique (send_id, player_id, recipient_type, recipient_email)
);

create index if not exists idx_match_selection_sends_match_created
  on public.match_selection_sends(match_id, created_at desc);
create index if not exists idx_match_selection_send_recipients_send
  on public.match_selection_send_recipients(send_id, status);

alter table public.match_selection_sends enable row level security;
alter table public.match_selection_send_recipients enable row level security;
revoke all on public.match_selection_sends from anon, authenticated;
revoke all on public.match_selection_send_recipients from anon, authenticated;

notify pgrst, 'reload schema';
