alter table public.clubs
  add column if not exists clip_advertising_enabled boolean not null default true;

comment on column public.clubs.clip_advertising_enabled is
  'Controls whether the club sponsor banner is shown below public shared clips.';
