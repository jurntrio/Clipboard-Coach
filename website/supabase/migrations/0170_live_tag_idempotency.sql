-- A mobile request may be retried while the connection is slow. Treat one tap as one
-- event, even when the same HTTP request reaches the API more than once.
alter table public.live_match_tags
  add column if not exists client_event_id uuid;

alter table public.live_match_tags
  add constraint live_match_tags_link_client_event_unique
  unique (link_id, client_event_id);

-- Clean up retry duplicates created before client event IDs existed. A genuine user
-- cannot intentionally add the same tag more than once within the same second.
-- If a duplicate was already materialized, remove its generated video tag as well.
do $$
declare
  duplicate_tag_ids uuid[];
begin
  with ranked as (
    select id, tag_id,
      row_number() over (
        partition by match_id, link_id, tag_name, player_ids,
          coalesce(lower(trim(tagger_name)), ''), date_trunc('second', occurred_at)
        order by created_at, id
      ) as duplicate_number
    from public.live_match_tags
  )
  select coalesce(array_agg(tag_id) filter (where tag_id is not null), '{}')
    into duplicate_tag_ids
  from ranked
  where duplicate_number > 1;

  with ranked as (
    select id,
      row_number() over (
        partition by match_id, link_id, tag_name, player_ids,
          coalesce(lower(trim(tagger_name)), ''), date_trunc('second', occurred_at)
        order by created_at, id
      ) as duplicate_number
    from public.live_match_tags
  )
  delete from public.live_match_tags live_tag
  using ranked
  where live_tag.id = ranked.id and ranked.duplicate_number > 1;

  delete from public.tags where id = any(duplicate_tag_ids);
end $$;

notify pgrst, 'reload schema';
