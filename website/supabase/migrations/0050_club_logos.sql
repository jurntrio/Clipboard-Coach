-- Een klein clublogo voor trainingsbladen en toekomstige clubbranding.
alter table public.clubs
  add column if not exists logo_url text;

comment on column public.clubs.logo_url is
  'Public URL or app-relative path of the club logo. Managed by platformadmin or active clubadmin.';

update public.clubs
set logo_url = '/branding/clubs/km-torhout.png'
where lower(trim(name)) in ('km torhout', 'k.m. torhout', 'km torhout 1992');

notify pgrst, 'reload schema';
