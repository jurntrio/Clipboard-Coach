alter table public.matches
  add column if not exists official_series_id text,
  add column if not exists official_series_name text;

comment on column public.matches.official_series_id is
  'Competition series identifier supplied by the official fixture provider.';
comment on column public.matches.official_series_name is
  'Competition series name supplied by the official fixture provider.';

notify pgrst, 'reload schema';
