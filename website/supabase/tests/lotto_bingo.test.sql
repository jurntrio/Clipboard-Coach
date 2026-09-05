begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id, email, raw_user_meta_data) values
('bc194700-0000-4000-8000-000000000001','bingo-admin@example.test','{"full_name":"Bingo test admin"}'),
('bc194700-0000-4000-8000-000000000002','bingo-club@example.test','{"full_name":"Bingo test club admin"}'),
('bc194700-0000-4000-8000-000000000003','bingo-viewer@example.test','{"full_name":"Bingo test viewer"}'),
('bc194700-0000-4000-8000-000000000004','bingo-coach@example.test','{"full_name":"Bingo test coach"}');
update public.profiles set account_role = 'platform_admin' where id = 'bc194700-0000-4000-8000-000000000001';
update public.profiles set account_role = 'club_admin' where id = 'bc194700-0000-4000-8000-000000000002';
update public.profiles set account_role = 'admin_viewer' where id = 'bc194700-0000-4000-8000-000000000003';
update public.profiles set account_role = 'coach' where id = 'bc194700-0000-4000-8000-000000000004';

select ok(public.lotto_bingo_valid_numbers(array[1,2,3,4,5,6,7,8,9,45],10),'ten unique integers including 45 accepted');
select ok(not public.lotto_bingo_valid_numbers(array[1,2,3,4,5,46],6),'46 rejected');
select ok(not public.lotto_bingo_valid_numbers(array[1,2,3,4,5,5],6),'duplicate rejected');
select ok(not public.lotto_bingo_valid_numbers(array[1,2,3,4,5,null],6),'null rejected');
select ok(not public.lotto_bingo_valid_numbers(array[1,2,3,4,5,47],6),'out of range rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub','bc194700-0000-4000-8000-000000000001',true);
select ok(public.lotto_bingo_is_admin(),'General Admin qualifies');
select throws_ok($$insert into public.lotto_bingo_participants(name,numbers) values ('Invalid 46',array[1,2,3,4,5,6,7,8,9,46])$$,'23514',null,'participant 46 rejected by DB');
select throws_ok($$insert into public.lotto_bingo_draws(draw_date,numbers) values ('2026-10-03',array[1,2,3,4,5,46])$$,'23514',null,'draw 46 rejected by DB');
select lives_ok($$insert into public.lotto_bingo_participants(id,name,numbers) values ('bc194700-0000-4000-8000-000000000010','Bingo fixture',array[1,2,3,4,5,6,7,8,9,10])$$,'admin inserts participant');
select lives_ok($$update public.lotto_bingo_participants set name='Edited fixture' where id='bc194700-0000-4000-8000-000000000010'$$,'admin updates participant');
select is((select name from public.lotto_bingo_participants where id='bc194700-0000-4000-8000-000000000010'),'Edited fixture','update persisted');
select throws_ok($$insert into public.lotto_bingo_participants(name,numbers) values ('Invalid',array[1,2,3,4,5,6,7,8,9,9])$$,'23514',null,'DB rejects duplicate participant number');
select throws_ok($$insert into public.lotto_bingo_draws(draw_date,numbers) values ('2026-10-04',array[1,2,3,4,5,6])$$,'23514',null,'DB rejects Sunday');
select throws_ok($$insert into public.lotto_bingo_draws(draw_date,numbers) values ('2026-09-26',array[1,2,3,4,5,6])$$,'23514',null,'DB rejects pre-start draw');
select throws_ok($$insert into public.lotto_bingo_draws(draw_date,numbers) values ('2026-10-03',array[1,2,3,4,5,6,7])$$,'23514',null,'DB rejects seven numbers including bonus');
select lives_ok($$insert into public.lotto_bingo_draws(id,draw_date,numbers) values ('bc194700-0000-4000-8000-000000000020','2026-10-03',array[1,2,3,4,5,6])$$,'admin inserts draw');
select throws_ok($$insert into public.lotto_bingo_draws(draw_date,numbers) values ('2026-10-03',array[7,8,9,10,11,12])$$,'23505',null,'DB rejects duplicate date');
select lives_ok($$update public.lotto_bingo_draws set numbers=array[2,3,4,5,6,7] where id='bc194700-0000-4000-8000-000000000020'$$,'admin corrects draw');
select throws_ok($$update public.lotto_bingo_settings set start_date='2026-10-10' where id=1$$,'23514',null,'cannot move start past draw');
select lives_ok($$update public.lotto_bingo_settings set fee=12 where id=1$$,'admin changes settings');
select throws_ok($$delete from public.lotto_bingo_settings where id=1$$,'23514',null,'singleton cannot disappear');

select set_config('request.jwt.claim.sub','bc194700-0000-4000-8000-000000000002',true);
select ok(not public.lotto_bingo_is_admin(),'Club Admin cannot manage');
select throws_ok($$insert into public.lotto_bingo_participants(name,numbers) values ('Forbidden',array[1,2,3,4,5,6,7,8,9,10])$$,'42501',null,'Club Admin direct insert blocked');
with changed as (update public.lotto_bingo_participants set name='Forbidden' where id='bc194700-0000-4000-8000-000000000010' returning id)
select is((select count(*)::integer from changed),0,'Club Admin direct update blocked');
with removed as (delete from public.lotto_bingo_draws where id='bc194700-0000-4000-8000-000000000020' returning id)
select is((select count(*)::integer from removed),0,'Club Admin direct deletion blocked');
select set_config('request.jwt.claim.sub','bc194700-0000-4000-8000-000000000003',true);
select ok(not public.lotto_bingo_is_admin(),'admin_viewer cannot manage');
select throws_ok($$insert into public.lotto_bingo_draws(draw_date,numbers) values ('2026-10-10',array[1,2,3,4,5,6])$$,'42501',null,'viewer direct draw insert blocked');
select set_config('request.jwt.claim.sub','bc194700-0000-4000-8000-000000000004',true);
select ok(not public.lotto_bingo_is_admin(),'coach cannot manage');
with changed as (update public.lotto_bingo_settings set fee=999 where id=1 returning id)
select is((select count(*)::integer from changed),0,'coach settings update blocked');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select ok(not public.lotto_bingo_is_admin(),'anonymous visitor cannot manage');
select is((select name from public.lotto_bingo_participants where id='bc194700-0000-4000-8000-000000000010'),'Edited fixture','public participant read');
select ok(public.lotto_bingo_snapshot()->'settings' is not null,'public snapshot includes settings');
select ok(jsonb_array_length(public.lotto_bingo_snapshot()->'draws') > 0,'public snapshot includes draws');
select throws_ok($$insert into public.lotto_bingo_participants(name,numbers) values ('Forbidden',array[1,2,3,4,5,6,7,8,9,10])$$,'42501',null,'anonymous direct insert blocked');
select throws_ok($$update public.lotto_bingo_settings set fee=999 where id=1$$,'42501',null,'anonymous direct update blocked');
select throws_ok($$delete from public.lotto_bingo_draws$$,'42501',null,'anonymous direct delete blocked');

set local role authenticated;
select set_config('request.jwt.claim.sub','bc194700-0000-4000-8000-000000000001',true);
select lives_ok($$delete from public.lotto_bingo_participants where id='bc194700-0000-4000-8000-000000000010'$$,'admin deletes participant');
select lives_ok($$delete from public.lotto_bingo_draws where id='bc194700-0000-4000-8000-000000000020'$$,'admin deletes draw');
select is((select count(*)::integer from public.lotto_bingo_draws where id='bc194700-0000-4000-8000-000000000020'),0,'draw removed');
reset role;
select * from finish();
rollback;
