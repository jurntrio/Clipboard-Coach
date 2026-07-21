import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShareClipPlayer } from "@/components/clips/ShareClipPlayer";

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();

  const { data: shareLink } = await supabase
    .from("share_links")
    .select(
      `id, view_count, expires_at,
       clips (
         name, render_status, rendered_segments,
         videos ( video_url, title, home_team, away_team ),
         clip_segments ( sequence_order, tags ( id, name, start_time, end_time, color ) )
       )`
    )
    .eq("token", params.token)
    .single();

  if (!shareLink || !shareLink.clips) {
    notFound();
  }

  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    notFound();
  }

  await supabase.from("share_links").update({ view_count: shareLink.view_count + 1 }).eq("id", shareLink.id);

  const clip = shareLink.clips as any;
  const sourceSegments = (clip.clip_segments ?? [])
    .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
    .map((segment: any) => segment.tags)
    .filter(Boolean);
  const segments = clip.render_status === "ready" && clip.rendered_segments?.length
    ? clip.rendered_segments.map((segment: any) => ({
        id: segment.id,
        name: segment.name,
        color: segment.color,
        start_time: segment.play_start ?? 0,
        end_time: segment.duration,
        url: segment.url,
        source_start: segment.source_start,
        source_end: segment.source_end
      }))
    : sourceSegments;
  const publicClipName = /^Clip \(\d+ tags?\)$/i.test(clip.name) ? "Shared clip" : clip.name;

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-border bg-black/80 px-4 py-5">
        <div className="mx-auto flex max-w-4xl justify-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={480} height={150} className="h-auto w-full max-w-md" priority />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-textBright">{publicClipName}</h1>
          {(clip.videos?.home_team || clip.videos?.away_team) && (
            <p className="text-textMuted">
              {clip.videos?.home_team} vs {clip.videos?.away_team}
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl overflow-hidden border border-border">
          <ShareClipPlayer videoUrl={clip.videos?.video_url} segments={segments} />
        </div>
      </div>

      <footer className="border-t border-border bg-black/50 px-4 py-8 text-center">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <Image src="/branding/logo.png" alt="" width={48} height={48} className="mb-3 h-12 w-12" />
          <p className="text-sm font-semibold text-textPrimary">Made with Clipboard Coach Studio</p>
          <p className="mt-1 text-xs text-textMuted">Review matches, tag moments and share the clips that matter.</p>
          <a href="/signup" className="mt-4 inline-block rounded-lg bg-accent px-6 py-2 font-semibold text-page">
            Start making your own clips
          </a>
        </div>
      </footer>
    </div>
  );
}
