begin;
create extension if not exists pgtap;
select plan(8);

select ok(not has_function_privilege('authenticated', 'public.delete_match_transaction(uuid)', 'EXECUTE'),
  'transactionele delete is niet rechtstreeks browser-aanroepbaar');

insert into auth.users(id, email, raw_user_meta_data)
values ('a1070000-0000-0000-0000-000000000001', 'delete-test@example.test', '{"full_name":"Delete Test"}');

insert into public.videos(id, coach_id, title, video_url, video_key)
values
  ('a1070000-0000-0000-0000-000000000010', 'a1070000-0000-0000-0000-000000000001', 'Disposable', 'https://media.test/disposable.mp4', 'videos/disposable.mp4'),
  ('a1070000-0000-0000-0000-000000000011', 'a1070000-0000-0000-0000-000000000001', 'Shared', 'https://media.test/shared.mp4', 'videos/shared.mp4');

insert into public.clips(id, coach_id, video_id, name, rendered_segments)
values ('a1070000-0000-0000-0000-000000000020', 'a1070000-0000-0000-0000-000000000001',
  'a1070000-0000-0000-0000-000000000010', 'Disposable clip', '[{"key":"clips/disposable.mp4"}]');

insert into public.matches(id, coach_id, team_a_name, team_b_name)
values
  ('a1070000-0000-0000-0000-000000000030', 'a1070000-0000-0000-0000-000000000001', 'A', 'B'),
  ('a1070000-0000-0000-0000-000000000031', 'a1070000-0000-0000-0000-000000000001', 'C', 'D');

insert into public.match_videos(match_id, video_id, sequence_order, label)
values
  ('a1070000-0000-0000-0000-000000000030', 'a1070000-0000-0000-0000-000000000010', 0, 'Disposable'),
  ('a1070000-0000-0000-0000-000000000030', 'a1070000-0000-0000-0000-000000000011', 1, 'Shared'),
  ('a1070000-0000-0000-0000-000000000031', 'a1070000-0000-0000-0000-000000000011', 0, 'Shared elsewhere');

select set_config('test.delete_cleanup', public.delete_match_transaction('a1070000-0000-0000-0000-000000000030')::text, true);

select ok(not exists(select 1 from public.matches where id = 'a1070000-0000-0000-0000-000000000030'),
  'de doelwedstrijd is verwijderd');
select ok(not exists(select 1 from public.videos where id = 'a1070000-0000-0000-0000-000000000010'),
  'uitsluitend gekoppelde video is atomair verwijderd');
select ok(exists(select 1 from public.videos where id = 'a1070000-0000-0000-0000-000000000011'),
  'gedeelde video blijft bestaan');
select ok(exists(select 1 from public.matches where id = 'a1070000-0000-0000-0000-000000000031'),
  'andere wedstrijd blijft bestaan');
select ok((current_setting('test.delete_cleanup')::jsonb->'clipKeys') ? 'clips/disposable.mp4',
  'R2-clipsleutel wordt teruggegeven voor cleanup na commit');
select ok((current_setting('test.delete_cleanup')::jsonb->'videoKeys') ? 'videos/disposable.mp4',
  'R2-videosleutel wordt teruggegeven voor cleanup na commit');
select throws_ok(
  $$select public.delete_match_transaction('a1070000-0000-0000-0000-000000000099')$$,
  'P0001', 'MATCH_NOT_FOUND', 'onbekende wedstrijd wordt expliciet geweigerd'
);

select * from finish();
rollback;
