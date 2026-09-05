# Clubboys Lotto Bingo

Public route: `/clubboys/lottobingo`. It uses its own styling adapted from the
supplied `clubboys_lotto_bingo_v2.html`, outside the dashboard layout. The supplied
Clubboys logo is served locally. No iframe, separate login, or localStorage data.

Apply `supabase/migrations/0197_lotto_bingo.sql` and
`supabase/migrations/0198_lotto_bingo_rpc_convention.sql`, then
`supabase/migrations/0199_lotto_bingo_45_numbers.sql` before deploying the web code.
Admin entry uses ten individual number boxes for participants and six for draws.
The module owns three tables and four narrowly scoped database functions. The
public snapshot function runs as the invoker and respects RLS; it returns a
consistent complete snapshot without the normal REST row limit. The page fetches
on navigation, focus and every 15 seconds while visible. Each successful edit
reloads the snapshot immediately. Failed requests keep the last known stand and
show an error. There are no changes to SVS account permissions.

Only `profiles.account_role = 'platform_admin'` may manage this module. The
navigation and client read the existing SVS session and role. Each write uses
the existing authenticated Supabase client and is independently enforced by RLS.
No service-role key is used. The legacy emergency email allowlist and
`admin_viewer` do not bypass the database role requirement. Check that the
intended General Admin has the canonical platform role before rollout.

Participants have a name and exactly ten distinct integers from 1 through 45.
Draws have one unique Saturday date, on or after the configured start, and six
distinct main numbers. Constraints and triggers enforce these rules even for
direct requests. Settings contain one protected singleton row. Its start cannot
be moved past existing draws. Optimistic comparisons reject stale record edits.

There is no payment status. Every registered participant contributes the configured
fee times the pot percentage: defaults €10 and 50%, hence €5 per participant.
Default start: 3 October 2026. All registered participants compete. Each number
counts once, across all draws. The earliest completion date determines winners;
players completing on the same draw divide the pot equally. Displayed individual
shares round to cents; handling indivisible residual cents is external. Correcting
or deleting participants/draws recomputes scores and winners, with confirmation.

General Admin can generate PNG or JPEG images for Facebook from a freshly fetched
snapshot. Eight participants per image keeps the complete ranking readable; each
page has the logo, pot, latest draw, winner summary, chosen/missing balls, timestamp,
page number and public address. Images are generated locally and downloaded using
explicit links; this does not publish anything to Facebook. Regenerate after edits.

Checks:

```powershell
node --test tests/lotto-bingo.test.ts
npm run typecheck
npm run lint
npm run build
supabase test db
```

`supabase/tests/lotto_bingo.test.sql` covers role permissions, direct writes,
constraints and the public snapshot inside a rolled-back transaction.
No existing browser data is automatically imported; the provided HTML is a
visual/functional reference. The live module starts with no participants/draws.
