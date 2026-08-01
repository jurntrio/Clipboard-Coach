-- Een mailboxthread verwijderen is persoonlijk: andere deelnemers behouden hun kopie.
-- Een nieuw antwoord maakt de thread automatisch opnieuw zichtbaar, omdat dat antwoord een
-- nieuwe recipient-rij krijgt zonder deleted_at.
alter table public.mailbox_recipients
  add column if not exists deleted_at timestamp with time zone;

create index if not exists idx_mailbox_recipients_visible
  on public.mailbox_recipients(profile_id, message_id)
  where deleted_at is null;

notify pgrst, 'reload schema';
