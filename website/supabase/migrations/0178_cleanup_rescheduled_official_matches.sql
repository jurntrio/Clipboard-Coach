-- Before the importer had stable rescheduling support, an official date/time
-- correction could create another row. Keep the best row per actual fixture.
with candidates as (
  select match.id,
    case when match.completed_at is not null
      or exists (select 1 from public.match_videos item where item.match_id = match.id)
      or exists (select 1 from public.match_tag_links item where item.match_id = match.id)
      or exists (select 1 from public.live_match_tags item where item.match_id = match.id)
      or exists (select 1 from public.player_stat_events item where item.match_id = match.id)
      or exists (select 1 from public.match_player_selections item where item.match_id = match.id)
      or exists (select 1 from public.match_dossiers item where item.match_id = match.id)
      or exists (select 1 from public.match_guest_players item where item.match_id = match.id)
      or exists (select 1 from public.sponsor_match_configurations item where item.match_id = match.id)
      or exists (select 1 from public.match_selection_sends item where item.match_id = match.id)
      then 1 else 0 end as has_user_content,
    row_number() over (
      partition by match.club_team_id,
        lower(trim(match.team_b_name)),
        coalesce(nullif(lower(trim(match.official_series_name)), ''), match.match_date::text),
        match.is_home_match
      order by
        case when match.completed_at is not null
          or exists (select 1 from public.match_videos item where item.match_id = match.id)
          or exists (select 1 from public.match_tag_links item where item.match_id = match.id)
          or exists (select 1 from public.live_match_tags item where item.match_id = match.id)
          or exists (select 1 from public.player_stat_events item where item.match_id = match.id)
          or exists (select 1 from public.match_player_selections item where item.match_id = match.id)
          or exists (select 1 from public.match_dossiers item where item.match_id = match.id)
          or exists (select 1 from public.match_guest_players item where item.match_id = match.id)
          or exists (select 1 from public.sponsor_match_configurations item where item.match_id = match.id)
          or exists (select 1 from public.match_selection_sends item where item.match_id = match.id)
          then 1 else 0 end desc,
        match.updated_at desc, match.created_at desc, match.id desc
    ) as position
  from public.matches match
  where match.external_source = 'voetbal_vlaanderen_download'
    and match.club_team_id is not null
), removable as (
  select id from candidates where position > 1 and has_user_content = 0
)
delete from public.matches match
using removable
where match.id = removable.id;

notify pgrst, 'reload schema';
