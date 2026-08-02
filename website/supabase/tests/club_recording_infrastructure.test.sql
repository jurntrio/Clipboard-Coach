begin;
create extension if not exists pgtap;
select plan(4);

select is(
  (select external_recording_url_template from public.clubs where name = 'KM Torhout'),
  'https://vod.usf.sport/360si/360si-dlc/recordings/{recordingId}/video/ch{camera}.mp4',
  'KM Torhout retains its external recording provider'
);
select is(
  (select external_recording_camera_count::integer from public.clubs where name = 'KM Torhout'),
  7,
  'KM Torhout retains its seven cameras'
);

insert into public.clubs(name, normalized_name, status)
values ('Neutral Test Club', 'neutral test club', 'active');

select is(
  (select external_recording_url_template from public.clubs where name = 'Neutral Test Club'),
  null,
  'a new club has no external recording provider by default'
);
select is(
  (select general_sponsor_url from public.clubs where name = 'Neutral Test Club'),
  null,
  'a new club has no sponsor artwork by default'
);

select * from finish();
rollback;
