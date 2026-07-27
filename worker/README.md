# Clipboard Coach Studio — video worker

> Note: large uploads (>4GB, e.g. drone footage) go through multipart
> upload from the browser directly to R2. That requires the bucket's CORS
> policy to expose the `ETag` header — see `website/README.md` for the
> policy JSON.

Background job that turns a raw upload (whatever a coach's camera produces —
could be 75GB of drone 4K footage) into a lightweight 720p HLS proxy the web
viewer can stream and scrub reliably, then deletes the original from R2.

## Flow

1. Website inserts a `videos` row and uploads the raw file straight to R2
   (as before), then calls `POST /process` on this worker.
2. Worker downloads the raw file from R2, transcodes it to 720p H.264/AAC
   HLS (5s segments) with ffmpeg, uploads the segments + playlist back to
   R2 under `videos/{id}/proxy/`.
3. Worker updates the `videos` row (`video_url` → proxy playlist,
   `processing_status` → `ready`) and deletes the raw file.
4. If anything fails, `processing_status` → `failed` and the raw file (and
   its original `video_url`) is left untouched, so nothing is lost — the
   coach just keeps watching the unprocessed original.

While processing is running, the coach can already scrub/tag the raw
upload — the swap to the compressed proxy happens invisibly once it's done.

## Remote clip extraction

Remote MP4 sources that advertise `Accept-Ranges: bytes` are read through a loopback-only range
proxy. FFmpeg then transfers only the MP4 index and media bytes around each requested tag instead
of downloading the complete multi-gigabyte camera recording. Completed segments are persisted
individually, so interrupted jobs resume from the first unfinished segment.

If a source does not support byte ranges or range extraction fails, the worker falls back once per
camera to the original full-file download path.

## Clip retention

Shared clips are retained for 365 days. The worker runs a cleanup on startup
and every 24 hours: it deletes each expired clip's rendered R2 objects first,
then deletes the clip row. Database cascades remove its segments and share
links. A storage failure stops the database deletion so an R2 object is never
silently orphaned by the retention job.

## Deploy on Railway

1. On [railway.com](https://railway.com), **New Project → Deploy from GitHub repo**,
   pick this repo, and set the service's **root directory** to `worker/`.
2. Railway auto-detects the Node app (`npm install`, `npm run build`,
   `npm start` — see `package.json`). No Dockerfile needed.
3. In the service's **Variables** tab, add everything from
   [.env.example](.env.example):
   - `WORKER_SHARED_SECRET` — make up any long random string (e.g. run
     `openssl rand -hex 32` locally). You'll paste the same value into the
     website's env vars below.
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
     `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — same values already in
     `website/.env.local`.
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same values
     already in `website/.env.local`.
4. Deploy. Railway gives the service a public URL like
   `https://clipboard-coach-worker-production.up.railway.app`.
5. In `website/.env.local` (and in Vercel's env vars once deployed), set:
   ```
   WORKER_URL=https://<your-railway-service>.up.railway.app
   WORKER_SHARED_SECRET=<the same random string from step 3>
   ```
6. Restart the website dev server. New uploads will now trigger
   compression automatically. Existing videos are untouched (they already
   have `processing_status = 'ready'` from the migration).

## Local dev

```bash
cd worker
cp .env.example .env   # fill in the same R2 + Supabase values
npm install
npm run dev
```

Point `website/.env.local`'s `WORKER_URL` at `http://localhost:8080`.
