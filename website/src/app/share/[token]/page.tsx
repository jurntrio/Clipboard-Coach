import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTime } from "@/lib/utils";
import { ShareClipPlayer } from "@/components/clips/ShareClipPlayer";

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();

  const { data: shareLink } = await supabase
    .from("share_links")
    .select(
      `id, view_count, expires_at,
       clips (
         name,
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
  const segments = (clip.clip_segments ?? [])
    .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
    .map((segment: any) => segment.tags)
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-page">
      <div className="bg-black/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent rounded flex items-center justify-center">
              <span className="text-page font-bold text-sm">CC</span>
            </div>
            <span className="text-textBright font-semibold">Clipboard Coach Studio</span>
          </div>
          <a href="/signup" className="px-4 py-1.5 bg-accent text-page text-sm rounded font-semibold">
            Try it free
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-textBright">{clip.name}</h1>
          {(clip.videos?.home_team || clip.videos?.away_team) && (
            <p className="text-textMuted">
              {clip.videos?.home_team} vs {clip.videos?.away_team}
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl overflow-hidden border border-border">
          <ShareClipPlayer videoUrl={clip.videos?.video_url} segments={segments} />
        </div>

        <div className="mt-6 space-y-2">
          {segments.map((segment: any) => (
            <div key={segment.id} className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-textPrimary font-medium">{segment.name}</span>
              <span className="text-textMuted text-sm ml-auto">
                {formatTime(segment.start_time)} - {formatTime(segment.end_time)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center pb-8">
          <p className="text-textMuted text-sm">Made with Clipboard Coach Studio</p>
          <a href="/signup" className="inline-block mt-2 px-6 py-2 bg-accent text-page rounded-lg font-semibold">
            Start making your own clips
          </a>
        </div>
      </div>
    </div>
  );
}
