"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClipAudienceType, Player, Tag } from "@/types/database";
import { getPlayerDisplayName } from "@/lib/utils";
import { remuxLocalSegment } from "@/lib/media/local-clips";
import { uploadBlobToR2 } from "@/lib/r2/browser-upload";
import { isPeriodMarker } from "@/lib/tags";
import Link from "next/link";

export function ClipBuilder({
  videoId,
  teamId,
  selectedTagIds,
  tags,
  players,
  extraPlayers = [],
  localVideo,
  localFile,
  localFilesByVideoId,
  localSourcesReady,
  onClipCreated
}: {
  videoId: string;
  teamId: string | null;
  selectedTagIds: string[];
  tags: Tag[];
  players: Player[];
  extraPlayers?: Player[];
  localVideo: boolean;
  localFile: File | null;
  localFilesByVideoId?: Record<string, File>;
  localSourcesReady?: boolean;
  onClipCreated: () => void;
}) {
  const canUseLocalSources = localSourcesReady ?? !!localFile;
  const clipTagIds = selectedTagIds.filter((id) => {
    const tag = tags.find((item) => item.id === id);
    return tag ? !isPeriodMarker(tag.name) : false;
  });
  const [clipName, setClipName] = useState("");
  const [audienceType, setAudienceType] = useState<ClipAudienceType>("full_team");
  const [audiencePlayerIds, setAudiencePlayerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>(players);
  const [extraPeople, setExtraPeople] = useState<Player[]>(extraPlayers);
  const [newTeamPlayerName, setNewTeamPlayerName] = useState("");
  const [newExtraName, setNewExtraName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const supabase = createClient();

  useEffect(() => setTeamPlayers(players), [players]);
  useEffect(() => setExtraPeople(extraPlayers), [extraPlayers]);

  async function handleCreateClip() {
    if (clipTagIds.length === 0) return;
    if (localVideo && !canUseLocalSources) {
      setErrorMessage("Reconnect the original match video before making clips.");
      return;
    }
    if (audienceType === "specific_players" && audiencePlayerIds.length === 0) {
      setErrorMessage("Select at least one person, or choose the full team.");
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

    const orderedTags = tags.filter((tag) => clipTagIds.includes(tag.id) && !isPeriodMarker(tag.name));
    const { data: clip, error } = await supabase
      .from("clips")
      .insert({
        coach_id: user.id,
        video_id: videoId,
        team_id: teamId,
        name: clipName.trim() || `Clip (${clipTagIds.length} tags)`,
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
            const sourceFile = localFilesByVideoId?.[tag.video_id] ?? localFile;
            if (!sourceFile) throw new Error(`Reconnect the source video for segment ${index + 1}.`);
            const rendered = await remuxLocalSegment(sourceFile, tag.start_time, tag.end_time, (value) => {
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
          setAudienceType("full_team");
          onClipCreated();
          setOpen(false);
        } catch (renderError) {
          const message = renderError instanceof Error ? renderError.message : "Clip creation failed.";
          await supabase.from("clips").update({ render_status: "failed", render_error: message }).eq("id", clip.id);
          setErrorMessage(message);
          setStatus("");
        }
      } else {
        setClipName("");
        setAudiencePlayerIds([]);
        setAudienceType("full_team");
        onClipCreated();
        setOpen(false);
      }
    } else if (error) {
      setErrorMessage(error.message);
    }

    setSaving(false);
  }

  function toggleRecipient(playerId: string) {
    setAudiencePlayerIds((current) => {
      const startingIds = audienceType === "full_team" ? teamPlayers.map((player) => player.id) : current;
      return startingIds.includes(playerId) ? startingIds.filter((id) => id !== playerId) : [...startingIds, playerId];
    });
    setAudienceType("specific_players");
  }

  function recipientButton(player: Player, belongsToTeam: boolean) {
    const selected = audienceType === "full_team" ? belongsToTeam : audiencePlayerIds.includes(player.id);
    return <button type="button" key={player.id} onClick={() => toggleRecipient(player.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${selected ? "border-accent bg-accentDim text-textPrimary" : "border-borderButton bg-button text-textSecondary hover:border-accent"}`}><input type="checkbox" tabIndex={-1} readOnly checked={selected} /><span>{getPlayerDisplayName(player)}</span></button>;
  }

  function splitName(value: string) {
    const parts = value.trim().split(/\s+/);
    return { firstName: parts.shift() ?? "", lastName: parts.join(" ") };
  }

  async function addTeamPlayer() {
    if (!teamId || !newTeamPlayerName.trim() || addingPerson) {
      if (!teamId) setErrorMessage("Select a saved team before adding a player.");
      return;
    }
    setAddingPerson(true);
    setErrorMessage("");
    const { firstName, lastName } = splitName(newTeamPlayerName);
    const { data, error } = await supabase.from("players").insert({ team_id: teamId, first_name: firstName, last_name: lastName, role: "player" }).select().single();
    if (error) setErrorMessage(error.message);
    else if (data) {
      setTeamPlayers((current) => [...current, data]);
      if (audienceType === "specific_players") setAudiencePlayerIds((current) => [...current, data.id]);
      setNewTeamPlayerName("");
    }
    setAddingPerson(false);
  }

  async function addExtraPerson() {
    if (!newExtraName.trim() || addingPerson) return;
    setAddingPerson(true);
    setErrorMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMessage("Your session has expired."); setAddingPerson(false); return; }
    const { data: existingTeam } = await supabase.from("teams").select("id").ilike("name", "EXTRA").limit(1).maybeSingle();
    let extraTeamId = existingTeam?.id;
    if (!extraTeamId) {
      const { data: createdTeam, error: teamError } = await supabase.from("teams").insert({ coach_id: user.id, name: "EXTRA" }).select("id").single();
      if (teamError) { setErrorMessage(teamError.message); setAddingPerson(false); return; }
      extraTeamId = createdTeam.id;
    }
    const { firstName, lastName } = splitName(newExtraName);
    const { data, error } = await supabase.from("players").insert({ team_id: extraTeamId, first_name: firstName, last_name: lastName, role: "player" }).select().single();
    if (error) setErrorMessage(error.message);
    else if (data) {
      setExtraPeople((current) => [...current, data]);
      setAudiencePlayerIds((current) => Array.from(new Set([...(audienceType === "full_team" ? teamPlayers.map((player) => player.id) : current), data.id])));
      setAudienceType("specific_players");
      setNewExtraName("");
    }
    setAddingPerson(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold text-textBright">Make clip</h3>
      <p className="mb-3 mt-1 text-xs text-textMuted">{clipTagIds.length} clip tag(s) selected</p>
      <button type="button" onClick={() => { setErrorMessage(""); setOpen(true); }} disabled={clipTagIds.length === 0 || (localVideo && !canUseLocalSources)} className="w-full rounded-lg bg-accent py-2 font-semibold text-page hover:opacity-90 disabled:opacity-50">Create clip</button>
      {localVideo && !canUseLocalSources && <p className="mt-2 text-xs text-textMuted">Reconnect all source videos used by this match to enable clip creation.</p>}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => { if (!saving) setOpen(false); }}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-borderButton bg-cardAlt p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create clip">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold text-textBright">Create clip</h2><p className="text-xs text-textMuted">Choose who can find this clip.</p></div>
              <button type="button" disabled={saving} onClick={() => setOpen(false)} className="text-textMuted hover:text-textPrimary disabled:opacity-50">&times;</button>
            </div>

            <label className="block text-sm text-textSecondary">Clip name
              <input type="text" placeholder="Clip name" value={clipName} onChange={(event) => setClipName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />
            </label>

            <div className="mt-4 space-y-3">
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${audienceType === "full_team" ? "border-accent bg-accentDim" : "border-border bg-cardDeep"}`}>
                <input type="checkbox" checked={audienceType === "full_team"} onChange={() => { setAudienceType("full_team"); setAudiencePlayerIds([]); }} />
                <span><strong className="block text-sm text-textPrimary">Full selected team</strong><span className="text-xs text-textMuted">Select everyone, or open the list below.</span></span>
              </label>

              <details className="rounded-lg border border-border bg-cardDeep px-3 py-2" open>
                <summary className="cursor-pointer text-sm font-semibold text-textPrimary">Players in selected team ({teamPlayers.length})</summary>
                <div className="mt-3 space-y-2">{teamPlayers.map((player) => recipientButton(player, true))}{!teamPlayers.length && <p className="text-xs text-textMuted">No players in this team yet.</p>}</div>
                <div className="mt-3 flex gap-2"><input value={newTeamPlayerName} onChange={(event) => setNewTeamPlayerName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addTeamPlayer(); } }} placeholder="Add player name" className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /><button type="button" disabled={addingPerson || !newTeamPlayerName.trim()} onClick={() => void addTeamPlayer()} className="rounded-lg bg-button px-3 py-2 text-sm font-semibold text-textPrimary disabled:opacity-50">Add</button></div>
              </details>

              <details className="rounded-lg border border-border bg-cardDeep px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-textPrimary">EXTRA ({extraPeople.length})</summary>
                <p className="mt-2 text-xs text-textMuted">For opponents or other people who are not in a fixed team.</p>
                <div className="mt-3 space-y-2">{extraPeople.map((player) => recipientButton(player, false))}</div>
                <div className="mt-3 flex gap-2"><input value={newExtraName} onChange={(event) => setNewExtraName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addExtraPerson(); } }} placeholder="Add extra person" className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /><button type="button" disabled={addingPerson || !newExtraName.trim()} onClick={() => void addExtraPerson()} className="rounded-lg bg-button px-3 py-2 text-sm font-semibold text-textPrimary disabled:opacity-50">Add</button></div>
                <Link href="/dashboard/teams" className="mt-2 inline-block text-xs text-accent hover:underline">Manage EXTRA in Teams</Link>
              </details>
            </div>

            {saving && localFile && (
              <div className="mt-4" role="status" aria-live="polite"><div className="mb-1 flex justify-between text-xs text-textSecondary"><span>{status}</span><span>{Math.round(progress * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-button"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} /></div><p className="mt-2 text-xs text-textMuted">Keep this page open. The full match remains on this PC.</p></div>
            )}
            {errorMessage && <p className="mt-3 text-sm text-red-300">{errorMessage}</p>}
            <div className="mt-5 flex gap-3"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-button px-4 py-2 text-textPrimary disabled:opacity-50">Cancel</button><button type="button" onClick={() => void handleCreateClip()} disabled={saving} className="flex-1 rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:opacity-50">{saving ? (localFile ? "Making clip…" : "Creating…") : "Create clip"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
