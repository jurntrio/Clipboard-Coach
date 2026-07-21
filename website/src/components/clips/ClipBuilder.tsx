"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClipAudienceType, Player, Tag } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";
import { remuxLocalSegment } from "@/lib/media/local-clips";
import { uploadBlobToR2 } from "@/lib/r2/browser-upload";

export function ClipBuilder({
  videoId,
  teamId,
  selectedTagIds,
  tags,
  players,
  localVideo,
  localFile,
  onClipCreated
}: {
  videoId: string;
  teamId: string | null;
  selectedTagIds: string[];
  tags: Tag[];
  players: Player[];
  localVideo: boolean;
  localFile: File | null;
  onClipCreated: () => void;
}) {
  const [clipName, setClipName] = useState("");
  const [audienceType, setAudienceType] = useState<ClipAudienceType>("full_team");
  const [audiencePlayerIds, setAudiencePlayerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const supabase = createClient();

  async function handleCreateClip() {
    if (selectedTagIds.length === 0) return;
    if (localVideo && !localFile) {
      setErrorMessage("Reconnect the original match video before making clips.");
      return;
    }
    setSaving(true);
    setProgress(0);
    setStatus(localFile ? "Preparing clip…" : "Saving clip…");
    setErrorMessage("");

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("Your session has expired. Sign in again.");
      setSaving(false);
      return;
    }

    const orderedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
    const { data: clip, error } = await supabase
      .from("clips")
      .insert({
        coach_id: user.id,
        video_id: videoId,
        team_id: teamId,
        name: clipName.trim() || `Clip (${selectedTagIds.length} tags)`,
        audience_type: audienceType,
        audience_player_ids: audienceType === "specific_players" ? audiencePlayerIds : [],
        render_status: localFile ? "rendering" : "metadata_only"
      })
      .select()
      .single();

    if (!error && clip) {
      // Order segments by the tag's position in the timeline, not selection order.
      const segments = orderedTags.map((tag, index) => ({
        clip_id: clip.id,
        tag_id: tag.id,
        sequence_order: index
      }));

      const { error: segmentError } = await supabase.from("clip_segments").insert(segments);
      if (segmentError) {
        setErrorMessage(segmentError.message);
      } else if (localFile) {
        try {
          const renderedSegments = [];
          for (let index = 0; index < orderedTags.length; index += 1) {
            const tag = orderedTags[index];
            const baseProgress = index / orderedTags.length;
            const unit = 1 / orderedTags.length;
            setStatus(`Making segment ${index + 1} of ${orderedTags.length}…`);
            const rendered = await remuxLocalSegment(localFile, tag.start_time, tag.end_time, (value) => {
              setProgress(baseProgress + unit * value * 0.55);
            });

            try {
              setStatus(`Uploading segment ${index + 1} of ${orderedTags.length}…`);
              const key = `clips/${user.id}/${clip.id}/${index + 1}-${crypto.randomUUID()}.mp4`;
              const url = await uploadBlobToR2(rendered.file, key, "video/mp4", (value) => {
                setProgress(baseProgress + unit * (0.55 + value * 0.45));
              });
              renderedSegments.push({
                id: crypto.randomUUID(),
                url,
                key,
                name: tag.name,
                color: tag.color,
                file_size: rendered.file.size,
                duration: Math.max(0, tag.end_time - rendered.actualStart),
                play_start: Math.max(0, tag.start_time - rendered.actualStart),
                source_start: tag.start_time,
                source_end: tag.end_time
              });
            } finally {
              await rendered.cleanup();
            }
          }

          const { error: updateError } = await supabase
            .from("clips")
            .update({ rendered_segments: renderedSegments, render_status: "ready", render_error: null })
            .eq("id", clip.id);
          if (updateError) throw updateError;
          setProgress(1);
          setStatus("Clip ready");
          setClipName("");
          setAudiencePlayerIds([]);
          onClipCreated();
        } catch (renderError) {
          const message = renderError instanceof Error ? renderError.message : "Clip creation failed.";
          await supabase.from("clips").update({ render_status: "failed", render_error: message }).eq("id", clip.id);
          setErrorMessage(message);
          setStatus("");
        }
      } else {
        setClipName("");
        setAudiencePlayerIds([]);
        onClipCreated();
      }
    } else if (error) {
      setErrorMessage(error.message);
    }

    setSaving(false);
  }

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <h3 className="text-textBright font-semibold mb-3">Make clip</h3>
      <p className="text-textMuted text-xs mb-3">{selectedTagIds.length} tag(s) selected</p>

      <input
        type="text"
        placeholder="Clip name"
        value={clipName}
        onChange={(event) => setClipName(event.target.value)}
        className="w-full px-3 py-2 bg-input text-textPrimary rounded-lg border border-border mb-3 text-sm"
      />

      <select
        value={audienceType}
        onChange={(event) => setAudienceType(event.target.value as ClipAudienceType)}
        className="w-full px-3 py-2 bg-input text-textPrimary rounded-lg border border-border mb-3 text-sm"
      >
        <option value="full_team">Full team</option>
        <option value="selected_players">Selected match players</option>
        <option value="specific_players">Specific players</option>
      </select>

      {audienceType === "specific_players" && (
        <div className="mb-3 flex flex-wrap gap-2">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() =>
                setAudiencePlayerIds((current) =>
                  current.includes(player.id) ? current.filter((id) => id !== player.id) : [...current, player.id]
                )
              }
              className={`px-2 py-1 rounded text-xs ${
                audiencePlayerIds.includes(player.id) ? "bg-accent text-page" : "bg-button text-textSecondary"
              }`}
            >
              {getPlayerDisplayName(player)}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleCreateClip}
        disabled={selectedTagIds.length === 0 || saving || (localVideo && !localFile)}
        className="w-full py-2 bg-accent text-page rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (localFile ? "Making clip…" : "Creating…") : "Create clip"}
      </button>
      {localVideo && !localFile && <p className="mt-2 text-xs text-textMuted">Reconnect the original match video to enable clip creation.</p>}

      {saving && localFile && (
        <div className="mt-3" role="status" aria-live="polite">
          <div className="flex justify-between text-xs text-textSecondary mb-1"><span>{status}</span><span>{Math.round(progress * 100)}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-button"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
          <p className="text-xs text-textMuted mt-2">Keep this page open. The full match remains on this PC.</p>
        </div>
      )}
      {errorMessage && <p className="mt-3 text-sm text-red-300">{errorMessage}</p>}
    </div>
  );
}
