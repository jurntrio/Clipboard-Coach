"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClipAudienceType, Player, Tag } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";

export function ClipBuilder({
  videoId,
  teamId,
  selectedTagIds,
  tags,
  players,
  onClipCreated
}: {
  videoId: string;
  teamId: string | null;
  selectedTagIds: string[];
  tags: Tag[];
  players: Player[];
  onClipCreated: () => void;
}) {
  const [clipName, setClipName] = useState("");
  const [audienceType, setAudienceType] = useState<ClipAudienceType>("full_team");
  const [audiencePlayerIds, setAudiencePlayerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleCreateClip() {
    if (selectedTagIds.length === 0) return;
    setSaving(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { data: clip, error } = await supabase
      .from("clips")
      .insert({
        coach_id: user!.id,
        video_id: videoId,
        team_id: teamId,
        name: clipName.trim() || `Clip (${selectedTagIds.length} tags)`,
        audience_type: audienceType,
        audience_player_ids: audienceType === "specific_players" ? audiencePlayerIds : []
      })
      .select()
      .single();

    if (!error && clip) {
      // Order segments by the tag's position in the timeline, not selection order.
      const orderedTagIds = tags.filter((tag) => selectedTagIds.includes(tag.id)).map((tag) => tag.id);
      const segments = orderedTagIds.map((tagId, index) => ({
        clip_id: clip.id,
        tag_id: tagId,
        sequence_order: index
      }));

      await supabase.from("clip_segments").insert(segments);
      setClipName("");
      setAudiencePlayerIds([]);
      onClipCreated();
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
        disabled={selectedTagIds.length === 0 || saving}
        className="w-full py-2 bg-accent text-page rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Creating..." : "Create clip"}
      </button>
    </div>
  );
}
