"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { createClient } from "@/lib/supabase/client";
import { getTagColor } from "@/lib/utils";
import type { LiveMatchTag, Match, StandardTag, Tag, Video } from "@/types/database";

const RECORDING_START_TAG = "start opname";

function isRecordingStartTag(tagName: string) {
  return tagName.trim().toLocaleLowerCase("nl") === RECORDING_START_TAG;
}

function liveTagVideoSeconds(liveTag: LiveMatchTag, match: Match) {
  if (!match.match_date || !match.recording_start_time) return null;
  const recordingStartedAt = new Date(`${match.match_date}T${match.recording_start_time}`);
  if (Number.isNaN(recordingStartedAt.getTime())) return null;
  const seconds = (new Date(liveTag.occurred_at).getTime() - recordingStartedAt.getTime()) / 1000;
  return Math.max(0, seconds + (match.live_tag_offset_seconds ?? 0));
}

function liveTagElapsedSeconds(liveTag: LiveMatchTag, match: Match | null) {
  return match ? liveTagVideoSeconds(liveTag, match) : null;
}

/**
 * Auto-materializes live-tagged moments (tagged during the match, before video exists)
 * into real `tags` once a video is attached, and lets a coach re-sync the live-tag
 * clock against the video by calibrating a single known moment.
 */
export function useLiveTagSync<TMatch extends Match>({
  matchId,
  match,
  canManageSources,
  currentUserId,
  videos,
  liveTags,
  setLiveTags,
  tags,
  setTags,
  standardTags,
  offsets,
  combinedTime,
  setMatch,
  setError,
  loadMatch
}: {
  matchId: string;
  match: TMatch | null;
  canManageSources: boolean;
  currentUserId: string;
  videos: Video[];
  liveTags: LiveMatchTag[];
  setLiveTags: Dispatch<SetStateAction<LiveMatchTag[]>>;
  tags: Tag[];
  setTags: Dispatch<SetStateAction<Tag[]>>;
  standardTags: StandardTag[];
  offsets: { map: Map<string, number>; total: number };
  combinedTime: number;
  setMatch: Dispatch<SetStateAction<TMatch | null>>;
  setError: (message: string) => void;
  loadMatch: () => Promise<void>;
}) {
  const supabase = createClient();
  const [clubLiveTagProfiles, setClubLiveTagProfiles] = useState<Array<{ name: string; live_start_offset_seconds: number; live_end_offset_seconds: number }>>([]);
  const [calibratingLiveTagId, setCalibratingLiveTagId] = useState<string | null>(null);
  const materializingLiveTagIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!match || !canManageSources || !currentUserId || !videos.length) return;
    const pending = liveTags.filter((liveTag) => !liveTag.tag_id && !materializingLiveTagIdsRef.current.has(liveTag.id));
    if (!pending.length) return;
    void materializeLiveTags(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, currentUserId, videos, liveTags]);

  async function materializeLiveTags(pending: LiveMatchTag[]) {
    const recordingStarts = liveTags
      .filter((liveTag) => isRecordingStartTag(liveTag.tag_name))
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    for (const liveTag of pending) {
      materializingLiveTagIdsRef.current.add(liveTag.id);
      try {
        let elapsed = liveTagElapsedSeconds(liveTag, match);
        let targetVideo = videos[0];
        if (recordingStarts.length) {
          const recordingIndex = recordingStarts.findLastIndex((start) => start.occurred_at <= liveTag.occurred_at);
          if (recordingIndex >= 0) {
            targetVideo = videos[recordingIndex];
            if (!targetVideo) continue;
            elapsed = (new Date(liveTag.occurred_at).getTime() - new Date(recordingStarts[recordingIndex].occurred_at).getTime()) / 1000;
          }
        }
        if (elapsed === null || !targetVideo) continue;
        // Live-tag timestamps are match-relative and must remain unchanged even
        // when the currently linked recording is shorter. A longer/replacement
        // source can be linked later, and the coach chooses the camera while
        // building the clip.
        const localTime = Math.max(0, elapsed);
        const clubProfile = clubLiveTagProfiles.find((item) => item.name.trim().toLowerCase() === liveTag.tag_name.trim().toLowerCase());
        const personalProfile = standardTags.find((item) => item.name.trim().toLowerCase() === liveTag.tag_name.trim().toLowerCase());
        const startOffset = isRecordingStartTag(liveTag.tag_name) ? 0 : clubProfile?.live_start_offset_seconds ?? personalProfile?.live_start_offset_seconds ?? personalProfile?.start_offset_seconds ?? -5;
        const endOffset = isRecordingStartTag(liveTag.tag_name) ? 0 : clubProfile?.live_end_offset_seconds ?? personalProfile?.live_end_offset_seconds ?? personalProfile?.end_offset_seconds ?? 5;
        const startTime = Math.max(0, localTime + startOffset);
        const endTime = Math.max(startTime, localTime + endOffset);
        const playerIds = liveTag.player_ids?.length ? liveTag.player_ids : targetVideo.active_player_ids;
        const response = await fetch(`/api/matches/${matchId}/live-tags/materialize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveTagId: liveTag.id, videoId: targetVideo.id, occurredAtSeconds: localTime, startTime, endTime, color: getTagColor(liveTag.tag_name), playerIds })
        });
        const body = await response.json().catch(() => null) as { tag?: Tag; error?: string } | null;
        const createdTag = body?.tag;
        if (!response.ok || !createdTag) { setError(body?.error || "Could not create tag from live tag."); continue; }
        setTags((current) => [...current.filter((tag) => tag.id !== createdTag.id), createdTag]
          .sort((a, b) => (offsets.map.get(a.video_id) ?? 0) + a.start_time - ((offsets.map.get(b.video_id) ?? 0) + b.start_time)));
        setLiveTags((current) => current.map((item) => item.id === liveTag.id ? { ...item, tag_id: createdTag.id } : item));
      } finally {
        materializingLiveTagIdsRef.current.delete(liveTag.id);
      }
    }
  }

  async function confirmLiveTagCalibration() {
    const liveTag = liveTags.find((item) => item.id === calibratingLiveTagId);
    setCalibratingLiveTagId(null);
    if (!liveTag || !match) return;
    const currentComputed = liveTagElapsedSeconds(liveTag, match);
    if (currentComputed === null) return;
    const delta = combinedTime - currentComputed;
    if (Math.abs(delta) < 0.01) return;
    const newOffset = (match.live_tag_offset_seconds ?? 0) + delta;
    setError("");
    const { error: matchError } = await supabase.from("matches").update({ live_tag_offset_seconds: newOffset }).eq("id", matchId);
    if (matchError) { setError(matchError.message); return; }
    setMatch((current) => current ? { ...current, live_tag_offset_seconds: newOffset } : current);

    const materializedTagIds = new Set(liveTags.filter((item) => item.tag_id).map((item) => item.tag_id as string));
    for (const tag of tags.filter((item) => materializedTagIds.has(item.id))) {
      const newStart = Math.max(0, tag.start_time + delta);
      const newEnd = Math.max(newStart, tag.end_time + delta);
      const newOccurred = Math.max(0, tag.occurred_at_seconds + delta);
      await supabase.from("tags").update({ start_time: newStart, end_time: newEnd, occurred_at_seconds: newOccurred }).eq("id", tag.id);
    }
    await loadMatch();
  }

  return { clubLiveTagProfiles, setClubLiveTagProfiles, calibratingLiveTagId, setCalibratingLiveTagId, confirmLiveTagCalibration };
}
