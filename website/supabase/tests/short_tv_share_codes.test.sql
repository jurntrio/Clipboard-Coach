begin;
create extension if not exists pgtap;
select plan(3);

select matches(
  public.generate_share_short_code(),
  '^[2-9A-HJ-NP-Z]{8}$',
  'a TV code contains eight unambiguous characters'
);

select isnt(
  public.generate_share_short_code(),
  public.generate_share_short_code(),
  'independent TV codes differ'
);

select ok(
  not exists (
    select 1 from public.share_links
    where short_code is null or short_code !~ '^[2-9A-HJ-NP-Z]{8}$'
  ),
  'all existing share links receive a valid TV code'
);

select * from finish();
rollback;
