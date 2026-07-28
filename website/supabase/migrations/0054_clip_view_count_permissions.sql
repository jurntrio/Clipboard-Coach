-- Club-controlled visibility for shared-clip view counts. Club admins always
-- retain access; the configurable roles extend visibility to other users.
alter table public.clubs
  add column if not exists clip_view_count_roles text[] not null default array['club_admin']::text[];

update public.clubs
set clip_view_count_roles = array['club_admin']::text[]
where clip_view_count_roles is null or not ('club_admin' = any(clip_view_count_roles));

-- Increment in one database statement so simultaneous page opens cannot
-- overwrite one another. Only the trusted service-role share page may call it.
create or replace function public.increment_share_link_view(target_link_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.share_links
  set view_count = coalesce(view_count, 0) + 1
  where id = target_link_id
  returning view_count;
$$;

revoke all on function public.increment_share_link_view(uuid) from public, anon, authenticated;
grant execute on function public.increment_share_link_view(uuid) to service_role;

notify pgrst, 'reload schema';
