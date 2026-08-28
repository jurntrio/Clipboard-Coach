-- A match has one stable active live-tag URL. Preserve the newest active link
-- and deactivate older duplicates before enforcing that invariant.
with ranked_active_links as (
  select id,
    row_number() over (partition by match_id order by created_at desc, id desc) as position
  from public.match_tag_links
  where active = true
)
update public.match_tag_links as link
set active = false
from ranked_active_links as ranked
where link.id = ranked.id
  and ranked.position > 1;

create unique index if not exists match_tag_links_one_active_per_match_idx
  on public.match_tag_links(match_id)
  where active = true;
