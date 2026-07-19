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
| **Hosting (Vercel)** | Deploys the Next.js app | [vercel.com](https://vercel.com), free tier is enough at launch. Import this repo, set the `website` folder as the project root, add the env vars from step 2. |

Not needed yet, only once you build those phases:
- **Stripe** — subscription billing.
- **Resend** — transactional email (archive warnings, etc). Supabase's built-in
  email already handles signup confirmation for free at low volume.

## 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in the values from the
services above.

## 3. Database setup

1. Open your Supabase project's SQL Editor.
2. Paste in and run `supabase/migrations/0001_init.sql`.
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

Push this repo to GitHub, import it in Vercel, set the project root to
`website/`, add the same env vars there, and deploy. Point your domain's DNS
at Vercel once it's live.

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
