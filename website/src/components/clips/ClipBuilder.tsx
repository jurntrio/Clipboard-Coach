"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClipAudienceType, Player, Tag, Team } from "@/types/database";
import { formatTime, getPlayerDisplayName } from "@/lib/utils";
import { remuxLocalSegment } from "@/lib/media/local-clips";
import { uploadBlobToR2 } from "@/lib/r2/browser-upload";
import { isPeriodMarker } from "@/lib/tags";
import { useI18n } from "@/i18n/client";
import { localMediaMessages } from "@/i18n/local-media";
import { ClipCreationImages } from "./ClipCreationImages";
import { emptyClipImages, parseClipImages } from "@/lib/clip-images";

export function ClipBuilder({
  videoId,
  teamId,
  selectedTagIds,
  tags,
  players,
  localVideo,
  localVideoIds,
  localFile,
  localFilesByVideoId,
  localSourcesReady,
  siblingCamerasByVideoId,
  matchLabel,
  onClipCreated
}: {
  videoId: string;
  videoIds?: string[];
  teamId: string | null;
  selectedTagIds: string[];
  tags: Tag[];
  players: Player[];
  localVideo: boolean;
  localVideoIds?: string[];
  localFile: File | null;
  localFilesByVideoId?: Record<string, File>;
  localSourcesReady?: boolean;
  siblingCamerasByVideoId?: Record<string, { id: string; camera_number: number | null; label: string }[]>;
  matchLabel?: string;
  onClipCreated: () => void;
}) {
  const canUseLocalSources = localSourcesReady ?? !!localFile;
  const localSourceIds = new Set(localVideoIds ?? (localVideo ? [videoId] : []));
  const clipTagIds = selectedTagIds.filter((id) => {
    const tag = tags.find((item) => item.id === id);
    return tag ? !isPeriodMarker(tag.name) : false;
  });
  const [orderedClipTagIds, setOrderedClipTagIds] = useState<string[]>([]);
  const clipCandidateTags = orderedClipTagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => !!tag && !isPeriodMarker(tag.name));
  const [clipName, setClipName] = useState("");
  const [audienceType, setAudienceType] = useState<ClipAudienceType>("full_team");
  const [audiencePlayerIds, setAudiencePlayerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [clipImages, setClipImages] = useState(emptyClipImages);
  const [imagesReady, setImagesReady] = useState(false);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>(players);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(teamId ?? "");
  const [newTeamPlayerName, setNewTeamPlayerName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [clipAllowance, setClipAllowance] = useState<{ plan: "free" | "pro"; used: number; exempt: boolean } | null>(null);
  const [cameraSelectionByTag, setCameraSelectionByTag] = useState<Record<string, string[]>>({});
  const supabase = createClient();
  const { t } = useI18n();
  const freeClipLimit = 20;
  const clipLimitReached = !clipAllowance?.exempt && clipAllowance?.plan === "free" && clipAllowance.used >= freeClipLimit;

  function selectedCamerasForTag(tag: Tag) {
    return cameraSelectionByTag[tag.id] ?? [tag.video_id];
  }

  function toggleTagCamera(tag: Tag, cameraVideoId: string) {
    setCameraSelectionByTag((current) => {
      const existing = current[tag.id] ?? [tag.video_id];
      const next = existing.includes(cameraVideoId) ? existing.filter((id) => id !== cameraVideoId) : [...existing, cameraVideoId];
      return { ...current, [tag.id]: next.length ? next : existing };
    });
  }

  useEffect(() => setTeamPlayers(players), [players]);
  useEffect(() => setClipImages(emptyClipImages()), [videoId]);
  useEffect(() => setSelectedTeamId(teamId ?? ""), [teamId]);
  useEffect(() => {
    setOrderedClipTagIds((current) => [
      ...current.filter((id) => clipTagIds.includes(id)),
      ...clipTagIds.filter((id) => !current.includes(id))
    ]);
  }, [selectedTagIds, tags]);
  useEffect(() => {
    let active = true;
    const loadClipAllowance = async () => {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      const { data } = await client.from("profiles").select("plan, clips_created_total, clip_limit_exempt").eq("id", user.id).single();
      if (active && data) setClipAllowance({ plan: data.plan === "pro" ? "pro" : "free", used: data.clips_created_total ?? 0, exempt: data.clip_limit_exempt === true });
    };
    void loadClipAllowance();
    return () => { active = false; };
  }, []);

  async function handleCreateClip() {
    if (!imagesReady) return;
    let chosenImages;
    try { chosenImages = parseClipImages({ ...clipImages, tags: Object.fromEntries(Object.entries(clipImages.tags).filter(([id]) => clipTagIds.includes(id))) }); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "Controleer de clipbeelden."); return; }
    if (clipTagIds.length === 0) return;
    if (clipLimitReached) {
      setErrorMessage(t("clip.freeLimit"));
      return;
    }
    if (localVideo && !canUseLocalSources) {
      setErrorMessage(t("clip.reconnectOriginal"));
      return;
    }
    if (audienceType === "specific_players" && audiencePlayerIds.length === 0) {
      setErrorMessage(t("clip.selectPerson"));
      return;
    }
    if (audienceType === "full_team" && !selectedTeamId) {
      setErrorMessage(t("clip.selectFullTeam"));
      return;
    }
    setSaving(true);
    setProgress(0);
    setStatus(localFile ? t("clip.preparing") : t("clip.saving"));
    setErrorMessage("");

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage(t("errors.sessionExpired"));
      setSaving(false);
      return;
    }

    const orderedTags = orderedClipTagIds
      .map((id) => tags.find((tag) => tag.id === id))
      .filter((tag): tag is Tag => !!tag && !isPeriodMarker(tag.name));
    const expandedSegments = orderedTags.flatMap((tag) => {
      const siblings = siblingCamerasByVideoId?.[tag.video_id] ?? [];
      if (siblings.length < 2) return [{ tag, videoId: tag.video_id }];
      const chosen = new Set(selectedCamerasForTag(tag));
      return siblings.filter((camera) => chosen.has(camera.id)).map((camera) => ({ tag, videoId: camera.id }));
    }).filter((segment, index, allSegments) =>
      allSegments.findIndex((candidate) => candidate.tag.id === segment.tag.id && candidate.videoId === segment.videoId) === index
    );
    if (localSourceIds.size > 0) {
      const missingLocalSegments = expandedSegments.filter(({ videoId: sourceVideoId }) => localSourceIds.has(sourceVideoId) &&
        !(localFilesByVideoId?.[sourceVideoId] ?? (sourceVideoId === videoId ? localFile : null))
      );
      if (missingLocalSegments.length > 0) {
        setErrorMessage(t("clip.reconnectAll"));
        setSaving(false);
        return;
      }
    }
    let resolvedClipName = clipName.trim();
    if (!resolvedClipName && orderedTags.length === 1) {
      resolvedClipName = orderedTags[0].name;
    } else if (!resolvedClipName) {
      const { count } = await supabase.from("clips").select("id", { count: "exact", head: true }).eq("video_id", videoId);
      const sequence = String((count ?? 0) + 1).padStart(2, "0");
      resolvedClipName = `Clip ${sequence} ${matchLabel?.trim() || t("clip.match")}`;
    }
    const { data: clip, error } = await supabase
      .from("clips")
      .insert({
        coach_id: user.id,
        video_id: videoId,
        team_id: selectedTeamId || null,
        name: resolvedClipName,
        audience_type: audienceType,
        audience_player_ids: audienceType === "specific_players" ? audiencePlayerIds : [],
        render_status: "rendering"
      })
      .select()
      .single();

    if (!error && clip) {
      setClipAllowance((current) => current ? { ...current, used: current.used + 1 } : current);
      // Order segments by the tag's position in the timeline, not selection order.
      const segments = expandedSegments.map(({ tag, videoId }, index) => ({
        clip_id: clip.id,
        tag_id: tag.id,
        video_id: videoId,
        sequence_order: index
      }));

      const { data: createdSegments, error: segmentError } = await supabase.from("clip_segments").insert(segments).select("id, sequence_order");
      if (segmentError) {
        setErrorMessage(segmentError.message);
      } else {
        try {
          const renderedSegments = [];
          for (let index = 0; index < expandedSegments.length; index += 1) {
            const { tag, videoId: sourceVideoId } = expandedSegments[index];
            const sourceFile = localFilesByVideoId?.[sourceVideoId] ?? (sourceVideoId === videoId && localVideo ? localFile : null);
            if (!sourceFile) {
              if (localSourceIds.has(sourceVideoId)) throw new Error(t("clip.reconnectAll"));
              continue;
            }
            const baseProgress = index / expandedSegments.length;
            const unit = 1 / expandedSegments.length;
            setStatus(t("clip.makingSegment", { current: index + 1, total: expandedSegments.length }));
            const rendered = await remuxLocalSegment(sourceFile, tag.start_time, tag.end_time, (value) => {
              setProgress(baseProgress + unit * value * 0.55);
            }, localMediaMessages(t));

            try {
              setStatus(t("clip.uploadingSegment", { current: index + 1, total: expandedSegments.length }));
              const key = `clips/${user.id}/${clip.id}/${index + 1}-${crypto.randomUUID()}.mp4`;
              const url = await uploadBlobToR2(rendered.file, key, "video/mp4", (value) => {
                setProgress(baseProgress + unit * (0.55 + value * 0.45));
              });
              const renderedSegment = {
                id: crypto.randomUUID(),
                url,
                key,
                name: tag.name,
                color: tag.color,
                file_size: rendered.file.size,
                duration: Math.max(0, tag.end_time - rendered.actualStart),
                play_start: Math.max(0, tag.start_time - rendered.actualStart),
                source_start: tag.start_time,
                source_end: tag.end_time,
                drawing_time_base: "clip",
                drawings: (tag.drawings ?? [])
                  .filter((drawing) =>
                    (drawing.video_id ?? tag.video_id) === sourceVideoId
                    && drawing.video_time >= tag.start_time
                    && drawing.video_time <= tag.end_time
                  )
                  .sort((first, second) => first.video_time - second.video_time)
                  .map((drawing) => ({
                    id: drawing.id,
                    key: drawing.key,
                    url: drawing.url,
                    at_seconds: Math.max(0, drawing.video_time - tag.start_time),
                    duration_seconds: Math.max(1, drawing.duration_seconds || 5)
                  }))
              };
              renderedSegments.push(renderedSegment);
              const createdSegment = createdSegments?.find((segment) => segment.sequence_order === index);
              if (!createdSegment) throw new Error(t("clip.creationFailed"));
              const { error: checkpointError } = await supabase.from("clip_segments").update({
                render_status: "pending",
                rendered_segment: { ...renderedSegment, clip_segment_id: createdSegment.id, sequence_order: index },
                render_error: null,
                render_completed_at: null
              }).eq("id", createdSegment.id);
              if (checkpointError) throw checkpointError;
            } finally {
              await rendered.cleanup();
            }
          }

          const localSegmentCount = expandedSegments.filter(({ videoId: sourceVideoId }) => localSourceIds.has(sourceVideoId)).length;
          if (renderedSegments.length < localSegmentCount) {
            throw new Error(t("clip.reconnectAll"));
          }

          const { error: updateError } = await supabase.from("clips").update({
            rendered_segments: renderedSegments,
            render_status: "rendering",
            render_error: null
          }).eq("id", clip.id);
          if (updateError) throw updateError;
          const processResponse = await fetch(`/api/clips/${clip.id}/process`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: chosenImages }) });
          if (!processResponse.ok) {
            const body = await processResponse.json().catch(() => null) as { error?: string } | null;
            throw new Error(body?.error || t("clip.conversionFailed"));
          }
          setProgress(1);
          setStatus(t("clip.uploadedPreparing"));
          setClipName("");
          setAudiencePlayerIds([]);
          setAudienceType("full_team");
          setCameraSelectionByTag({});
          setClipImages(emptyClipImages());
          onClipCreated();
          setOpen(false);
        } catch (renderError) {
          const message = renderError instanceof Error ? renderError.message : t("clip.creationFailed");
          const cleanupResponse = await fetch(`/api/clips/${clip.id}`, { method: "DELETE" });
          if (!cleanupResponse.ok) await supabase.from("clips").update({ render_status: "failed", render_error: message }).eq("id", clip.id);
          setErrorMessage(message);
          setStatus("");
        }
      }
    } else if (error) {
      setErrorMessage(error.message.includes("FREE_CLIP_LIMIT_REACHED")
        ? t("clip.freeLimit")
        : error.message);
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

  function moveClipTag(tagId: string, direction: -1 | 1) {
    setOrderedClipTagIds((current) => {
      const index = current.indexOf(tagId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function recipientButton(player: Player, belongsToTeam: boolean) {
    const selected = audienceType === "full_team" ? belongsToTeam : audiencePlayerIds.includes(player.id);
    return <button type="button" key={player.id} onClick={() => toggleRecipient(player.id)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${selected ? "border-accent bg-accentDim text-textPrimary" : "border-borderButton bg-button text-textSecondary hover:border-accent"}`}><input type="checkbox" tabIndex={-1} readOnly checked={selected} /><span>{getPlayerDisplayName(player)}</span></button>;
  }

  function splitName(value: string) {
    const parts = value.trim().split(/\s+/);
    return { firstName: parts.shift() ?? "", lastName: parts.join(" ") };
  }

  async function loadAvailableTeams() {
    const { data } = await supabase.from("teams").select("*").not("name", "ilike", "EXTRA").order("name");
    setAvailableTeams(data ?? []);
    if (!selectedTeamId && data?.length === 1) await selectTeam(data[0].id);
  }

  async function selectTeam(nextTeamId: string) {
    setSelectedTeamId(nextTeamId);
    setAudiencePlayerIds([]);
    if (!nextTeamId) { setTeamPlayers([]); return; }
    const { data } = await supabase.from("players").select("*").eq("team_id", nextTeamId).neq("role", "staff").order("last_name");
    setTeamPlayers(data ?? []);
  }

  async function addTeamPlayer() {
    if (!selectedTeamId || !newTeamPlayerName.trim() || addingPerson) {
      if (!selectedTeamId) setErrorMessage(t("clip.selectSavedTeam"));
      return;
    }
    setAddingPerson(true);
    setErrorMessage("");
    const { firstName, lastName } = splitName(newTeamPlayerName);
    const { data, error } = await supabase.from("players").insert({ team_id: selectedTeamId, first_name: firstName, last_name: lastName, role: "player" }).select().single();
    if (error) setErrorMessage(error.message);
    else if (data) {
      setTeamPlayers((current) => [...current, data]);
      if (audienceType === "specific_players") setAudiencePlayerIds((current) => [...current, data.id]);
      setNewTeamPlayerName("");
    }
    setAddingPerson(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold text-textBright">{t("clip.make")}</h3>
      <p className="mb-3 mt-1 text-xs text-textMuted">{t("clip.selected", { count: clipTagIds.length })}</p>
      {clipAllowance && !clipAllowance.exempt && <p className={`mb-3 text-xs ${clipLimitReached ? "text-red-300" : "text-textMuted"}`}>{clipAllowance.plan === "pro" ? t("clip.proPlan", { count: clipAllowance.used }) : t("clip.freeUsed", { used: clipAllowance.used, limit: freeClipLimit })}</p>}
      <button type="button" onClick={() => { setErrorMessage(""); setOpen(true); void loadAvailableTeams(); }} disabled={clipTagIds.length === 0 || (localVideo && !canUseLocalSources) || clipLimitReached} className="w-full rounded-lg bg-accent py-2 font-semibold text-page hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{t("clip.create")}</button>
      {localVideo && !canUseLocalSources && <p className="mt-2 text-xs text-textMuted">{t("clip.reconnectAll")}</p>}
      {clipLimitReached && <p className="mt-2 text-xs text-red-300">{t("clip.freeLimit")}</p>}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => { if (!saving) setOpen(false); }}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-xl border border-borderButton bg-cardAlt p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={t("clip.create")}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold text-textBright">{t("clip.create")}</h2><p className="text-xs text-textMuted">{t("clip.chooseAudience")}</p></div>
              <button type="button" disabled={saving} onClick={() => setOpen(false)} className="text-textMuted hover:text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">&times;</button>
            </div>

            <label className="block text-sm text-textSecondary">{t("clip.name")}
              <input type="text" placeholder={clipTagIds.length === 1 ? tags.find((tag) => tag.id === clipTagIds[0])?.name || t("tag.name") : `Clip 01 ${matchLabel?.trim() || t("clip.match")}`} value={clipName} onChange={(event) => setClipName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary" />
            </label>

            <ClipCreationImages videoId={videoId} tags={clipCandidateTags} value={clipImages} onChange={setClipImages} onReady={setImagesReady} disabled={saving} />

            <div className="mt-4 rounded-lg border border-border bg-cardDeep p-3">
              <h3 className="text-sm font-semibold text-textPrimary">{t("clip.segmentOrder")}</h3>
              <p className="mb-2 mt-1 text-[11px] text-textMuted">{t("clip.segmentOrderHelp")}</p>
              <ol className="space-y-1.5">
                {clipCandidateTags.map((tag, index) => {
                  const siblings = siblingCamerasByVideoId?.[tag.video_id] ?? [];
                  const selected = selectedCamerasForTag(tag);
                  return (
                    <li key={tag.id} className="grid grid-cols-[1.25rem_minmax(8rem,12rem)_1fr_auto] items-center gap-2 rounded-lg border border-borderSubtle bg-card px-2.5 py-2 max-md:grid-cols-[1.25rem_1fr_auto]">
                      <span className="text-center text-xs font-bold text-accent">{index + 1}</span>
                      <span className="min-w-0">
                        <strong className="block truncate text-xs text-textPrimary">{tag.name}</strong>
                        <small className="text-[10px] text-textMuted">{formatTime(tag.start_time)}–{formatTime(tag.end_time)}</small>
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-md:col-span-3 max-md:pl-7">
                        {siblings.length > 1 && siblings.map((camera) => {
                          const checked = selected.includes(camera.id);
                          return <button key={camera.id} type="button" disabled={saving} onClick={() => toggleTagCamera(tag, camera.id)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "border-accent bg-accentDim text-textBright" : "border-borderButton bg-button text-textSecondary hover:bg-cardHover"}`}>{camera.label}</button>;
                        })}
                      </div>
                      <span className="flex gap-2 max-md:col-start-3 max-md:row-start-1">
                        <button type="button" disabled={index === 0 || saving} onClick={() => moveClipTag(tag.id, -1)} aria-label={t("clip.moveUp", { name: tag.name })} title={t("clip.moveUp", { name: tag.name })} className="grid h-8 w-8 place-items-center rounded border border-borderButton bg-button text-sm text-textPrimary disabled:cursor-not-allowed disabled:opacity-25">↑</button>
                        <button type="button" disabled={index === clipCandidateTags.length - 1 || saving} onClick={() => moveClipTag(tag.id, 1)} aria-label={t("clip.moveDown", { name: tag.name })} title={t("clip.moveDown", { name: tag.name })} className="grid h-8 w-8 place-items-center rounded border border-borderButton bg-button text-sm text-textPrimary disabled:cursor-not-allowed disabled:opacity-25">↓</button>
                      </span>
                    </li>
                  );
                })}
              </ol>
              {clipCandidateTags.some((tag) => (siblingCamerasByVideoId?.[tag.video_id]?.length ?? 0) > 1) && (
                <p className="text-[11px] text-textMuted">{t("clip.camerasPerTagHelp")}</p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-sm text-textSecondary">{t("clip.team")}
                <select value={selectedTeamId} onChange={(event) => void selectTeam(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary">
                  <option value="">{t("clip.selectTeam")}</option>
                  {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${audienceType === "full_team" ? "border-accent bg-accentDim" : "border-border bg-cardDeep"}`}>
                <input type="checkbox" checked={audienceType === "full_team"} onChange={(event) => { setAudienceType(event.target.checked ? "full_team" : "specific_players"); setAudiencePlayerIds([]); }} />
                <span><strong className="block text-sm text-textPrimary">{t("clip.fullTeam")}{selectedTeamId ? ` · ${availableTeams.find((team) => team.id === selectedTeamId)?.name ?? ""}` : ""}</strong><span className="text-xs text-textMuted">{t("clip.includesPlayers", { count: teamPlayers.length })}</span></span>
              </label>

              <details className="rounded-lg border border-border bg-cardDeep px-3 py-2" open>
                <summary className="cursor-pointer text-sm font-semibold text-textPrimary">{t("clip.teamPlayers", { count: teamPlayers.length })}</summary>
                <div className="mt-3 space-y-2">{teamPlayers.map((player) => recipientButton(player, true))}{!teamPlayers.length && <p className="text-xs text-textMuted">{t("clip.noTeamPlayers")}</p>}</div>
                <div className="mt-3 flex gap-2"><input value={newTeamPlayerName} onChange={(event) => setNewTeamPlayerName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addTeamPlayer(); } }} placeholder={t("clip.addPlayerName")} className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" /><button type="button" disabled={addingPerson || !newTeamPlayerName.trim()} onClick={() => void addTeamPlayer()} className="rounded-lg bg-button px-3 py-2 text-sm font-semibold text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">{t("clip.add")}</button></div>
              </details>

            </div>

            {saving && localVideo && (
              <div className="mt-4" role="status" aria-live="polite"><div className="mb-1 flex justify-between text-xs text-textSecondary"><span>{status}</span><span>{Math.round(progress * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-button"><div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} /></div><p className="mt-2 text-xs text-textMuted">{t("clip.keepOpen")}</p></div>
            )}
            {errorMessage && <p className="mt-3 text-sm text-red-300">{errorMessage}</p>}
            <div className="mt-5 flex gap-3"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-button px-4 py-2 text-textPrimary disabled:cursor-not-allowed disabled:opacity-50">{t("common.cancel")}</button><button type="button" onClick={() => void handleCreateClip()} disabled={saving || clipLimitReached || !imagesReady} className="flex-1 rounded-lg bg-accent px-4 py-2 font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50">{saving ? (localFile ? t("clip.making") : t("clip.creating")) : t("clip.create")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
