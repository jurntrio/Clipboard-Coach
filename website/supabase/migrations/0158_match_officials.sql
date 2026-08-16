alter table public.matches
  add column if not exists official_referee_name text,
  add column if not exists official_assistant_referee_1_name text,
  add column if not exists official_assistant_referee_2_name text,
  add column if not exists official_officials_synced_at timestamp with time zone;

comment on column public.matches.official_referee_name is 'Door Voetbal Vlaanderen aangeduide scheidsrechter.';
comment on column public.matches.official_assistant_referee_1_name is 'Door Voetbal Vlaanderen aangeduide eerste assistent-scheidsrechter.';
comment on column public.matches.official_assistant_referee_2_name is 'Door Voetbal Vlaanderen aangeduide tweede assistent-scheidsrechter.';

notify pgrst, 'reload schema';
