# Clipboard Coach Studio — Web

Web version of the desktop app: Teams, Video Viewer + Tagging, Clip Builder,
Clip Library, and Shareable Clip links. Player tracking/heatmaps stay
desktop-only and are not part of this project.

Scaffolded from `migration-guide.docx`, scoped down to the core product
(no billing, no archive cron, no drawing overlays, no multi-video "match"
grouping) so there's something runnable to build on first. Those can be
layered in later — see "Not built yet" below.

## 1. What you need before this runs

| Service | Why | Where to get it |
|---|---|---|
| **Supabase project** | Database + auth (email/password) | [supabase.com](https://supabase.com) → New project. Grab the Project URL, anon key, and service role key from Project Settings → API. |
| **Cloudflare R2 bucket** | Video file storage | [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → Create bucket (`clipboard-coach-videos`). Create an API token with Object Read & Write, note the Account ID + Access Key ID + Secret. Enable the bucket's public access (or a custom domain) to get `R2_PUBLIC_URL`. |
| **Domain name** (optional but recommended) | So share links look like `clipboardcoach.studio/share/...` instead of a Vercel subdomain | Any registrar (~€10/year). |
| **Hosting (Netlify)** | Deploys the Next.js app | Import this repo in Netlify, set `website` as the base directory, and add the env vars from step 2. |

### Required R2 CORS configuration

Uploads go directly from the visitor's browser to R2. In the R2 bucket,
open **Settings > CORS Policy** and allow the exact production website origin
(plus localhost while developing):

```json
[
  {
    "AllowedOrigins": ["https://your-domain.example", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace `https://your-domain.example` with the deployed site's precise origin
(no path and normally no trailing slash). `ETag` is required for multipart
uploads; `PUT` and `Content-Type` are required for every upload.

Not needed yet, only once you build those phases:
- **Stripe** — subscription billing.
- **Resend** — transactional email (archive warnings, etc). Supabase's built-in
  email already handles signup confirmation for free at low volume.
- **Railway** (or similar) — hosts the `worker/` service that compresses
  raw uploads into a web-friendly HLS proxy. Optional: without it, videos
  just keep playing straight from the raw R2 upload. See
  [`worker/README.md`](../worker/README.md) for setup.

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values from the
services above.

## 3. Database setup

1. Open your Supabase project's SQL Editor.
2. Run every file in `supabase/migrations/` in numeric order. Existing installations must at least run the new `0004_local_clip_assets.sql` migration before deploying local clip export.
3. In Authentication → Providers, make sure Email is enabled.
4. In Authentication → URL Configuration, set the Site URL to your app URL
   (`http://localhost:3000` for now, your real domain once deployed) and add
   `<site-url>/auth/callback` as a redirect URL.

## 4. Run it

```bash
cd website
npm install
npm run dev
```

Visit `http://localhost:3000`, sign up, and you should land on the dashboard.

## 5. Deploy

Push this repo to GitHub. Netlify deploys the `website/` app from that repository.
Keep the production domain and the Netlify subdomain in the R2 CORS policy.

## Local-first video mode

"Use video from this PC" stores only video metadata and tags in Supabase. The
match file remains on that device. Mediabunny reads the file lazily and copies
the H.264/HEVC and AAC packets for each selected tag into a small MP4 without re-encoding;
only those clip files are uploaded to R2. This avoids uploading a 5–10 GB match
and keeps CPU and memory use much lower than browser transcoding.

The current local export path accepts MP4/MOV/M4V with H.264 or HEVC video and
AAC (or no) audio. HEVC playback depends on support in the viewer's browser and
operating system. A local match must be selected again when browser permissions are not
remembered or when continuing on another device. Tags remain available online.

## What's ported

- Teams & players (create/delete teams, add/remove players)
- Video upload straight to R2, played back in-browser
- Tagging: quick "standard tag" buttons + custom tags, timeline with tag
  markers, active-player selector per video
- Clip builder: select tags, name the clip, choose an audience
- Clip library with segment-jumping preview (plays each tagged range in
  order — no server-side video rendering)
- Public share links with view counts and a "try it free" CTA

## Not built yet (intentionally out of scope for this first pass)

- **Billing (Stripe)** — `clips`/`profiles` schema has no subscription
  columns yet; add them back when you're ready to charge.
- **Archive cron** — old videos are never auto-deleted from R2 right now.
  Watch your R2 storage/costs until this exists.
- **Tactical drawing overlays** — desktop-only for now.
- **Multi-video "match" grouping** — the desktop app can stitch multiple
  video files into one match timeline; the web schema treats each upload as
  its own thing. Revisit if coaches need combined-halves timelines on the
  web too.
- **Player tracking / heatmaps** — deliberately excluded, personal-use only.
