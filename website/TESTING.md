# Tests

Saved R2 clip regression checks:

```powershell
node --test tests/clip-builder.test.cjs tests/clip-creation-failure.test.cjs tests/clip-recording-sources.test.cjs tests/clip-drawing-selection.test.cjs tests/viewer-clips-route.test.cjs
```

In the match viewer, select a tag backed by a saved private R2 camera, create a
named clip, and verify that it appears under Clips with its maker and transitions
from processing to ready. Open it and verify playback. Maker-profile lookup
failures must not hide clips. A processing failure must preserve the saved clip
and show an error. The signed source lookup must reject inaccessible matches,
unrelated video/job links and unfinished recordings.

GitHub Actions runs the complete quality check on every pull request and on pushes to `main` or `master`.

The web job installs the locked npm dependencies, checks TypeScript, and creates the same optimized Next.js build used for production. It uses inert CI-only environment values and does not contact the production services.

The database job starts a temporary Supabase database in Docker, applies every migration in order, and runs every pgTAP file in `supabase/tests`. Each test is rolled back, so test records are discarded. A failed migration or assertion blocks the workflow.

Run the web checks locally from `website`:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
```

Run the database tests locally when Docker Desktop is available:

```powershell
npx.cmd supabase db start
npx.cmd supabase test db
npx.cmd supabase stop --no-backup
```
