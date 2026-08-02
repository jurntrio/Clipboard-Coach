# Tests

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
