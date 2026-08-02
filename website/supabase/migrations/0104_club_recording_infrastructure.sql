-- Recording infrastructure is club-specific. Existing KM Torhout installations
-- retain their 360SI setup; all other and future clubs start without one.
alter table public.clubs
  add column if not exists external_recording_url_template text,
  add column if not exists external_recording_camera_count smallint;

alter table public.clubs
  drop constraint if exists clubs_external_recording_config_check;
alter table public.clubs
  add constraint clubs_external_recording_config_check check (
    (external_recording_url_template is null and external_recording_camera_count is null)
    or (
      external_recording_url_template ~ '^https://[^[:space:]]+$'
      and external_recording_url_template like '%{recordingId}%'
      and external_recording_url_template like '%{camera}%'
      and external_recording_camera_count between 1 and 20
    )
  );

update public.clubs
set external_recording_url_template = 'https://vod.usf.sport/360si/360si-dlc/recordings/{recordingId}/video/ch{camera}.mp4',
    external_recording_camera_count = 7
where name ilike '%torhout%'
  and external_recording_url_template is null
  and external_recording_camera_count is null;

comment on column public.clubs.external_recording_url_template is
  'Club-specific HTTPS video URL containing {recordingId} and {camera}; null disables the option.';
comment on column public.clubs.external_recording_camera_count is
  'Number of selectable cameras for the configured external recording provider.';

notify pgrst, 'reload schema';
