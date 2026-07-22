-- Public share links are resolved exclusively by the server-side share route,
-- which uses the service-role client after receiving an unguessable token.
-- Browser clients must never be able to enumerate tokens or update link rows.

drop policy if exists "Anyone can view share links" on public.share_links;
drop policy if exists "Anyone can increment view count" on public.share_links;

-- Keep RLS enabled explicitly in case it was changed outside the migrations.
alter table public.share_links enable row level security;
