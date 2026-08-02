begin;
create extension if not exists pgtap;
select plan(8);

select has_column('public', 'club_registration_invites', 'token_hash', 'club invites bewaren een tokenhash');
select has_column('public', 'player_invites', 'token_hash', 'player invites bewaren een tokenhash');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'club_registration_invites' and column_name = 'token'
), 'club invites bewaren geen bruikbaar plaintext token');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'player_invites' and column_name = 'token'
), 'player invites bewaren geen bruikbaar plaintext token');
select is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'club_registration_invites' and column_name = 'token_hash'),
  'bytea', 'club invite token_hash gebruikt bytea'
);
select is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'player_invites' and column_name = 'token_hash'),
  'bytea', 'player invite token_hash gebruikt bytea'
);
select ok(position('club_registration_invites' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0
    and position('token_hash = extensions.digest' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0,
  'clubregistratie vergelijkt uitsluitend de SHA-256 hash');
select ok(position('player_invites' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0
    and position('token_hash = extensions.digest' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0,
  'ouderregistratie vergelijkt uitsluitend de SHA-256 hash');

select * from finish();
rollback;
