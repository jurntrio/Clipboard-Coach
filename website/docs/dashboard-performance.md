# Dashboard performance changes

All changes are restricted to `website/`. Existing user changes are retained.
No local Next.js build, production migration or infrastructure setting change was performed.

## Changes

- `netlify.toml`: immutable Next.js static assets; one-week caching for branding, icons and clubboys assets.
- `src/lib/supabase/middleware.ts`: verified JWT claims for redirects; cookie refresh logic retained.
- `src/lib/auth/active-club.ts`: claims supply identity and metadata. When the emergency `ADMIN_EMAILS` allowlist is configured, current Auth user data is still fetched so a stale email cannot grant admin access.
- `src/lib/auth/profile.ts`, `src/app/dashboard/layout.tsx`: request-scoped React cache shares account role and onboarding profile data.
- `src/lib/auth/club-access.ts`: one service-role RPC supplies raw access rows, followed by the same permission calculation. Only missing-function errors (`42883`, `PGRST202`) use the legacy path. The emergency email admin path remains independent of the database.
- `supabase/migrations/0210_club_access_bundle.sql`: UTC role validity filters, nested overrides/defaults and active goalkeeper groups. Fixed `pg_catalog` search path; only `service_role` can execute.
- `src/app/api/matches/[id]/viewer/route.ts`: returns `currentUserId`, personal standard tags and team A players. Roster and personal tags use the authenticated client, preserving RLS.
- `src/app/dashboard/matches/[matchId]/page.tsx`: viewer, template and admin-status fetches start independently. No preliminary client Auth calls or separate roster query. Player selection, staff exclusion, sorting and 401 redirect are retained.
- `src/app/dashboard/matches/[matchId]/loading.tsx`, `src/app/dashboard/videos/[videoId]/loading.tsx`, `src/app/dashboard/teams/loading.tsx`, `src/app/dashboard/teams/[teamId]/loading.tsx`, `src/app/dashboard/intradesk/loading.tsx`: accessible loading skeletons. Both viewer pages also show their skeleton during the initial client-side data fetch.
- `src/app/dashboard/videos/[videoId]/page.tsx`: initial loading skeleton. ClipBuilder already used `next/dynamic` with `ssr: false` on both viewer pages, so no further lazy-loading change was needed.
- `tests/auth-roundtrips.test.cjs`, `tests/club-access-bundle.test.cjs`, `tests/fixtures/club-access-before.ts`, `tests/match-viewer-loading.test.cjs`: auth/cookies, original-versus-RPC/fallback permission equivalence, expected permissions, keeper scope, authorization and RLS query checks. The historical fixture freezes the pre-change access implementation from commit `621d68d`.
- `supabase/tests/club_access_bundle.test.sql`: database checks for function existence, execution grants, fixed search path and an unknown account.
- `scripts/test-extension-resolution.cjs`: test-only resolver for existing extensionless TypeScript imports under Node 24; no new dependency.

## Validation

From `website/` with Node 24:

```powershell
npm.cmd run typecheck
node --require ./scripts/test-extension-resolution.cjs --test tests/*.test.cjs tests/*.test.ts
```

Typecheck passed. The full test run passed 130 tests with 0 failures.
Without the test resolver, three existing test files fail to resolve extensionless imports
(`clip-images`, `clip-intro`, `phase-tags`).
Database tests were added but not executed locally: Docker/PostgreSQL are unavailable.
No end-to-end browser timings or deployed cache headers were measured.

## Manual deployment and verification

1. Deploy the website through the normal Netlify workflow. Leave the current region unchanged.
2. Review migration `0210_club_access_bundle.sql`, run your Supabase dry-run/repair procedure and deploy it yourself. Do not deploy it from application startup. Until then, access requests try the RPC and fall back, so the bundle latency benefit arrives after migration deployment.
3. Run the Supabase database tests, including `club_access_bundle.test.sql`, in your database test environment before production deployment.
4. Optionally enable asymmetric JWT signing keys in Supabase. This enables local claims verification with cached signing keys; symmetric keys safely fall back to Auth network verification. The configured emergency email allowlist still requires fresh Auth user data.
5. Check actual deployed `Cache-Control` headers for a Next.js static asset and branding/icon/clubboys assets. Reused branding filenames may retain old browser content for up to a week; use a new filename/version when an immediate refresh is required.
6. Check unauthenticated redirects and authorized/unauthorized match viewers; compare club admin, read-only, trainer, team-scoped and goalkeeper accounts. Verify personal tags, selected players, local video reconnection and clip creation.
7. Compare dashboard/viewer request timings in browser developer tools. Permission sets must remain identical; no shared response caching was added for authenticated data.
