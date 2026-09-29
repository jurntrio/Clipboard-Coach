alter table public.matches
  add column if not exists custom_live_tag_names text[] not null default '{}';

comment on column public.matches.custom_live_tag_names is
  'Handmatig ingevoerde live-tagopties die alleen binnen deze wedstrijd herbruikbaar zijn.';
