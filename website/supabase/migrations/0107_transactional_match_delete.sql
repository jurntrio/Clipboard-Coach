-- Keep relational match/video cleanup atomic. External R2 objects are returned for best-effort cleanup after commit.

create or replace function public.delete_match_transaction(target_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  disposable_ids uuid[];
  cleanup jsonb;
begin
  if not exists (select 1 from public.matches where id = target_match_id for update) then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  select coalesce(array_agg(link.video_id), array[]::uuid[])
  into disposable_ids
  from public.match_videos link
  where link.match_id = target_match_id
    and not exists (
      select 1 from public.match_videos other
      where other.video_id = link.video_id and other.match_id <> target_match_id
    );

  select jsonb_build_object(
    'clipKeys', coalesce((
      select jsonb_agg(segment->>'key')
      from public.clips clip
      cross join lateral jsonb_array_elements(coalesce(clip.rendered_segments, '[]'::jsonb)) segment
      where clip.video_id = any(disposable_ids)
        and nullif(segment->>'key', '') is not null
    ), '[]'::jsonb),
    'videoKeys', coalesce((
      select jsonb_agg(video.video_key)
      from public.videos video
      where video.id = any(disposable_ids)
        and nullif(video.video_key, '') is not null
        and video.video_key not like 'local/%'
    ), '[]'::jsonb)
  ) into cleanup;

  delete from public.matches where id = target_match_id;
  delete from public.videos where id = any(disposable_ids);

  return cleanup;
end;
$$;

revoke all on function public.delete_match_transaction(uuid) from public, anon, authenticated;
grant execute on function public.delete_match_transaction(uuid) to service_role;

notify pgrst, 'reload schema';
