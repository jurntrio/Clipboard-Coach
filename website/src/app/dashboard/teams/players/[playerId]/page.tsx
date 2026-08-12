"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { buildPublicShareUrl } from "@/lib/share-url";
import { getPlayerDisplayName } from "@/lib/utils";
import type { Player } from "@/types/database";
import { ClipCard } from "@/components/clips/ClipCard";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { EditPlayerModal } from "@/components/teams/EditPlayerModal";
import { ShareClipDialog } from "@/components/clips/ShareClipDialog";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/messages";
import { MenuIcon } from "@/components/ui/MenuIcon";
import { PlayerInjuries } from "@/components/teams/PlayerInjuries";

type PlayerWithTeam = Player & { teams: { name: string; club_team_id: string | null } | null };
type Guardian = { id: string; profile_id: string; access_scope: string; valid_from: string; valid_until: string | null; revoked_at: string | null; created_at: string; profiles: { email: string; full_name: string | null } | null };
type PlayerInvite = { id: string; contact_label: string | null; contact_phone: string | null; contact_email: string | null; created_at: string; expires_at: string; sent_at: string | null; delivery_error: string | null; used_at: string | null; used_by: string | null };
type ClubPlayerContact = { id: string; club_id: string; first_name: string; last_name: string; date_of_birth: string | null; address: string | null; postal_code: string | null; city: string | null; email: string | null; phone: string | null; national_registry_number: string | null; birth_place: string | null; photo_url: string | null };
type TeamTraining = { id: string; club_team_id: string | null; player_group_id: string | null; training_date: string; start_time: string; field_option_id: string | null; locker_room_option_id: string | null; attendance_status: "unknown" | "present" | "absent"; can_edit_attendance: boolean; club_teams: { name: string } | null; player_groups: { name: string; icon: string | null } | null };
type ExtraGroup = { id: string; name: string; icon: string | null; active: boolean };
type GroupEvaluation = { id: string; score: number; note: string | null; evaluated_at: string; player_groups: { name: string; icon: string | null } | null; player_group_evaluation_criteria: { name: string } | null; profiles: { full_name: string | null } | null };
type TeamMatch = { id: string; club_team_id: string | null; team_a_id: string | null; team_b_id: string | null; team_a_name: string; team_b_name: string; match_date: string | null; start_time: string | null; status: string; score_a: number | null; score_b: number | null; is_home_match: boolean };
const accessScopeKeys: Record<string, MessageKey> = { current_season: "guardianInvite.scopeCurrentSeason", from_acceptance: "guardianInvite.scopeFromAcceptance", all_history: "guardianInvite.scopeAllHistory" };
type PlayerClip = {
  id: string;
  name: string;
  created_at: string;
  team_id: string | null;
  audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  render_status: string;
  rendered_segments: { id: string; url: string; name: string; color: string; duration: number; play_start?: number; drawing_time_base?: "clip"; mobile_compatible?: boolean; drawings?: Array<{ id: string; url: string; at_seconds: number; duration_seconds: number }> }[];
  videos: {
    id: string;
    title: string | null;
    video_url: string;
    match_videos: {
      match_id: string;
      matches: {
        id: string;
        team_a_name: string;
        team_b_name: string;
        match_date: string | null;
        start_time: string | null;
        score_a: number | null;
        score_b: number | null;
      } | null;
    }[];
  } | null;
  clip_segments: {
    id: string;
    sequence_order: number;
    video_id: string | null;
    videos: { video_url: string } | null;
    tags: { id: string; name: string; start_time: number; end_time: number; color: string; player_ids: string[] } | null;
  }[];
};

export default function PlayerClipsPage() {
  const { t, locale } = useI18n();
  const { playerId } = useParams<{ playerId: string }>();
  const [player, setPlayer] = useState<PlayerWithTeam | null>(null);
  const [clips, setClips] = useState<PlayerClip[]>([]);
  const [stats, setStats] = useState({ goals: 0, assists: 0 });
  const [selectedClip, setSelectedClip] = useState<PlayerClip | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareDialog, setShareDialog] = useState<{ clipName: string; shareUrl: string } | null>(null);
  const [shareError, setShareError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [invitePending, setInvitePending] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [invites, setInvites] = useState<PlayerInvite[]>([]);
  const [guardiansError, setGuardiansError] = useState("");
  const [guardiansBusy, setGuardiansBusy] = useState("");
  const [contactDrafts, setContactDrafts] = useState<{ lastName: string; firstName: string; email: string; phone: string }[]>([{ lastName: "", firstName: "", email: "", phone: "" }]);
  const [teamTrainings, setTeamTrainings] = useState<TeamTraining[]>([]);
  const [extraGroups, setExtraGroups] = useState<ExtraGroup[]>([]);
  const [groupEvaluations, setGroupEvaluations] = useState<GroupEvaluation[]>([]);
  const [teamMatches, setTeamMatches] = useState<TeamMatch[]>([]);
  const [optionNames, setOptionNames] = useState<Record<string, string>>({});
  const [attendanceBusy, setAttendanceBusy] = useState("");
  const [attendanceError, setAttendanceError] = useState("");
  const [clubPlayerContact, setClubPlayerContact] = useState<ClubPlayerContact | null>(null);
  const [canEditChildInfo, setCanEditChildInfo] = useState(false);
  const [guardianDetailId, setGuardianDetailId] = useState<string | null>(null);
  const [guardianDetailDraft, setGuardianDetailDraft] = useState({ address: "", postalCode: "", city: "", phone: "", notes: "" });
  const [childInfoDraft, setChildInfoDraft] = useState({ address: "", postalCode: "", city: "", email: "", phone: "", nationalRegistryNumber: "", birthPlace: "" });
  const [childInfoSaving, setChildInfoSaving] = useState(false);
  const [childInfoSaved, setChildInfoSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("contact");
  const [currentlyInjured, setCurrentlyInjured] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function updateContactDraft(index: number, field: "lastName" | "firstName" | "email" | "phone", value: string) {
    setContactDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  async function createGuardianInvite(index: number) {
    const draft = contactDrafts[index];
    setInvitePending(true);
    setInviteError("");
    const response = await fetch(`/api/players/${playerId}/invite`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactLabel: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(), contactEmail: draft.email.trim(), contactPhone: draft.phone.trim() })
    });
    const body = await response.json().catch(() => null) as { token?: string; emailSent?: boolean; deliveryError?: string; error?: string } | null;
    setInvitePending(false);
    if (!response.ok || !body?.token) { setInviteError(body?.error || "De uitnodigingslink kon niet aangemaakt worden."); return; }
    setInviteLink(`${window.location.origin}/join/${body.token}`);
    if (draft.email.trim() && !body.emailSent) setInviteError(`De link is aangemaakt, maar de e-mail kon niet worden verzonden${body.deliveryError ? `: ${body.deliveryError}` : "."}`);
    setContactDrafts((current) => current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : [{ lastName: "", firstName: "", email: "", phone: "" }]);
    await loadGuardians();
  }

  async function loadChildInfo(currentPlayer: PlayerWithTeam) {
    if (!currentPlayer.membership_id) { setClubPlayerContact(null); return; }
    const { data: membership } = await supabase.from("player_team_memberships").select("club_player_id").eq("id", currentPlayer.membership_id).maybeSingle();
    if (!membership?.club_player_id) { setClubPlayerContact(null); return; }
    const { data: clubPlayer } = await supabase.from("club_players").select("id, club_id, first_name, last_name, date_of_birth, address, postal_code, city, email, phone, birth_place, photo_url").eq("id", membership.club_player_id).maybeSingle();
    if (!clubPlayer) { setClubPlayerContact(null); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: membershipRow } = await supabase.from("club_memberships").select("role").eq("club_id", clubPlayer.club_id).eq("profile_id", user.id).eq("status", "active").maybeSingle();
    const canEdit = membershipRow?.role === "club_admin";
    const { data: guardian } = await supabase.from("player_guardians").select("id").eq("club_player_id", clubPlayer.id).eq("profile_id", user.id).is("revoked_at", null).maybeSingle();
    if (guardian?.id) {
      const { data: details } = await supabase.from("player_guardian_details").select("address, postal_code, city, phone, notes").eq("guardian_id", guardian.id).maybeSingle();
      setGuardianDetailId(guardian.id);
      setGuardianDetailDraft({ address: details?.address ?? "", postalCode: details?.postal_code ?? "", city: details?.city ?? "", phone: details?.phone ?? "", notes: details?.notes ?? "" });
    } else setGuardianDetailId(null);
    const { data: sensitive } = canEdit
      ? await supabase.from("club_players").select("national_registry_number").eq("id", clubPlayer.id).maybeSingle()
      : { data: null };
    const completePlayer = { ...clubPlayer, national_registry_number: sensitive?.national_registry_number ?? null };
    setClubPlayerContact(completePlayer);
    setChildInfoDraft({ address: clubPlayer.address ?? "", postalCode: clubPlayer.postal_code ?? "", city: clubPlayer.city ?? "", email: clubPlayer.email ?? "", phone: clubPlayer.phone ?? "", nationalRegistryNumber: completePlayer.national_registry_number ?? "", birthPlace: clubPlayer.birth_place ?? "" });
    setCanEditChildInfo(canEdit);
  }

  async function saveChildInfo() {
    if (!clubPlayerContact) return;
    setChildInfoSaving(true);
    setChildInfoSaved(false);
    const { error } = await supabase.from("club_players").update({
      address: childInfoDraft.address.trim() || null,
      postal_code: childInfoDraft.postalCode.trim() || null,
      city: childInfoDraft.city.trim() || null,
      email: childInfoDraft.email.trim() || null,
      phone: childInfoDraft.phone.trim() || null,
      national_registry_number: childInfoDraft.nationalRegistryNumber.trim() || null,
      birth_place: childInfoDraft.birthPlace.trim() || null,
    }).eq("id", clubPlayerContact.id);
    setChildInfoSaving(false);
    if (!error) { setChildInfoSaved(true); await loadChildInfo(player as PlayerWithTeam); }
  }

  async function uploadPlayerPhoto(file: File) {
    if (!clubPlayerContact || !canEditChildInfo) return;
    setPhotoError("");
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setPhotoError("Kies een PNG-, JPEG- of WebP-afbeelding.");
    if (file.size > 5 * 1024 * 1024) return setPhotoError("De spelersfoto mag maximaal 5 MB groot zijn.");
    setPhotoBusy(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const key = `clubs/${clubPlayerContact.club_id}/players/${clubPlayerContact.id}-${crypto.randomUUID()}.${extension}`;
      const prepare = await fetch('/api/videos/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, contentType: file.type }) });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Upload kon niet worden voorbereid.");
      const put = await fetch(prepared.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error(`Upload mislukt (HTTP ${put.status}).`);
      const { error } = await supabase.from('club_players').update({ photo_url: prepared.publicUrl }).eq('id', clubPlayerContact.id);
      if (error) throw error;
      await loadChildInfo(player as PlayerWithTeam);
    } catch (reason) {
      setPhotoError(reason instanceof Error ? reason.message : "De spelersfoto kon niet worden geüpload.");
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function loadGuardians() {
    const response = await fetch(`/api/players/${playerId}/guardians`);
    const body = await response.json().catch(() => null) as { guardians?: Guardian[]; invites?: PlayerInvite[] } | null;
    if (response.ok && body) { setGuardians(body.guardians ?? []); setInvites(body.invites ?? []); }
  }

  async function revokeGuardian(id: string) {
    setGuardiansBusy(id); setGuardiansError("");
    const response = await fetch(`/api/players/${playerId}/guardians`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guardianId: id }) });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setGuardiansBusy("");
    if (!response.ok) { setGuardiansError(body?.error || "Intrekken mislukt."); return; }
    await loadGuardians();
  }

  async function cancelInvite(id: string) {
    setGuardiansBusy(id); setGuardiansError("");
    const response = await fetch(`/api/players/${playerId}/guardians`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancelInviteId: id }) });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setGuardiansBusy("");
    if (!response.ok) { setGuardiansError(body?.error || "Annuleren mislukt."); return; }
    await loadGuardians();
  }

  useEffect(() => { void loadPlayerAndClips(); void loadGuardians(); }, [playerId]);

  async function loadPlayerAndClips() {
    setLoading(true);
    const [profileResponse, clipResult, statsResult] = await Promise.all([
      fetch(`/api/players/${playerId}`, { cache: "no-store" }),
      supabase.from("clips").select(`
        id, name, created_at, team_id, audience_type, audience_player_ids, render_status, rendered_segments,
        videos(id, title, video_url, match_videos(match_id, matches(id, team_a_name, team_b_name, match_date, start_time, score_a, score_b))),
        clip_segments(id, sequence_order, video_id, videos(video_url), tags(id, name, start_time, end_time, color, player_ids))
      `).order("created_at", { ascending: false }),
      supabase.from("player_career_stats").select("goals, assists").eq("player_id", playerId).maybeSingle()
    ]);

    const profileBody = await profileResponse.json().catch(() => null) as { player?: PlayerWithTeam } | null;
    const loadedPlayer = profileResponse.ok ? profileBody?.player ?? null : null;
    setPlayer(loadedPlayer);
    setStats({ goals: statsResult.data?.goals ?? 0, assists: statsResult.data?.assists ?? 0 });
    const allClips = (clipResult.data as unknown as PlayerClip[] | null) ?? [];
    if (loadedPlayer) {
      void fetch(`/api/players/${playerId}/injuries`, { cache: "no-store" }).then(async response => {
        if (!response.ok) return;
        const body = await response.json() as { injuries?: Array<{ status: string }> };
        setCurrentlyInjured(body.injuries?.some(item => item.status === "injured") ?? false);
      });
      void loadChildInfo(loadedPlayer);
      const clubTeamId = loadedPlayer.teams?.club_team_id;
      if (clubTeamId) {
        const scheduleResponse = await fetch(`/api/players/${playerId}/schedule`);
        const schedule = await scheduleResponse.json().catch(() => null) as { trainings?: TeamTraining[]; matches?: TeamMatch[]; optionNames?: Record<string, string>; extraGroups?: ExtraGroup[]; evaluations?: GroupEvaluation[] } | null;
        setTeamTrainings(scheduleResponse.ok ? schedule?.trainings ?? [] : []);
        setTeamMatches(scheduleResponse.ok ? schedule?.matches ?? [] : []);
        setOptionNames(scheduleResponse.ok ? schedule?.optionNames ?? {} : {});
        setExtraGroups(scheduleResponse.ok ? schedule?.extraGroups ?? [] : []);
        setGroupEvaluations(scheduleResponse.ok ? schedule?.evaluations ?? [] : []);
      } else {
        setTeamTrainings([]);
        setTeamMatches([]);
        setOptionNames({});
        setExtraGroups([]);
        setGroupEvaluations([]);
      }
    } else {
      setTeamTrainings([]);
      setTeamMatches([]);
      setOptionNames({});
      setExtraGroups([]);
      setGroupEvaluations([]);
    }
    setClips(allClips.filter((clip) => {
      if (!loadedPlayer) return false;
      if (clip.audience_player_ids.includes(playerId) || clip.clip_segments.some((segment) => segment.tags?.player_ids.includes(playerId))) return true;
      return clip.team_id === loadedPlayer.team_id && clip.audience_type === "full_team";
    }));
    setLoading(false);
  }

  async function updateTrainingAttendance(trainingId: string, status: TeamTraining["attendance_status"]) {
    setAttendanceBusy(trainingId);
    setAttendanceError("");
    const response = await fetch(`/api/trainings/sessions/${trainingId}/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, status })
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setAttendanceBusy("");
    if (!response.ok) {
      setAttendanceError(body?.error || "De aanwezigheid kon niet worden aangepast.");
      return;
    }
    setTeamTrainings(current => current.map(training => training.id === trainingId ? { ...training, attendance_status: status } : training));
  }

  function currentTeamMatchNames(match: TeamMatch) {
    // Importers persist the intended display names. Re-deriving a side from
    // is_home_match can replace the opponent with the player's own team.
    return `${match.team_a_name} – ${match.team_b_name}`;
  }

  async function saveGuardianDetails() {
    if (!guardianDetailId) return;
    setChildInfoSaving(true); setChildInfoSaved(false);
    const { error } = await supabase.from("player_guardian_details").upsert({
      guardian_id: guardianDetailId,
      address: guardianDetailDraft.address.trim() || null,
      postal_code: guardianDetailDraft.postalCode.trim() || null,
      city: guardianDetailDraft.city.trim() || null,
      phone: guardianDetailDraft.phone.trim() || null,
      notes: guardianDetailDraft.notes.trim() || null,
      updated_at: new Date().toISOString()
    });
    setChildInfoSaving(false);
    if (!error) setChildInfoSaved(true);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const scheduleTimestamp = (date: string | null, time: string | null) => date ? new Date(`${date}T${time?.slice(0, 5) || "00:00"}:00`).getTime() : Number.POSITIVE_INFINITY;
  const upcomingFirst = (left: number, right: number) => {
    const now = todayStart.getTime();
    const leftPast = left < now;
    const rightPast = right < now;
    if (leftPast !== rightPast) return leftPast ? 1 : -1;
    return leftPast ? right - left : left - right;
  };
  const orderedTrainings = [...teamTrainings].sort((a, b) => upcomingFirst(scheduleTimestamp(a.training_date, a.start_time), scheduleTimestamp(b.training_date, b.start_time)));
  const orderedMatches = [...teamMatches].sort((a, b) => upcomingFirst(scheduleTimestamp(a.match_date, a.start_time), scheduleTimestamp(b.match_date, b.start_time)));
  const trainingWeekGroups = orderedTrainings.reduce((groups, training) => {
    const date = new Date(`${training.training_date}T12:00:00`);
    const dayFromMonday = (date.getDay() + 6) % 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - dayFromMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const existing = groups.find(group => group.key === key);
    if (existing) existing.trainings.push(training);
    else groups.push({ key, monday, sunday, trainings: [training] });
    return groups;
  }, [] as { key: string; monday: Date; sunday: Date; trainings: TeamTraining[] }[]);
  const planningItems = [
    ...teamTrainings.map(item => ({ kind: "training" as const, item, timestamp: scheduleTimestamp(item.training_date, item.start_time) })),
    ...teamMatches.map(item => ({ kind: "match" as const, item, timestamp: scheduleTimestamp(item.match_date, item.start_time) }))
  ].sort((a, b) => upcomingFirst(a.timestamp, b.timestamp));

  const clipGroups = clips.reduce((groups, clip) => {
    const match = clip.videos?.match_videos?.[0]?.matches ?? null;
    const key = match?.id ?? `video:${clip.videos?.id ?? clip.id}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.clips.push(clip);
    } else {
      groups.push({
        key,
        match,
        videoTitle: clip.videos?.title || t("team.untitledVideo"),
        clips: [clip]
      });
    }
    return groups;
  }, [] as {
    key: string;
    match: NonNullable<PlayerClip["videos"]>["match_videos"][number]["matches"];
    videoTitle: string;
    clips: PlayerClip[];
  }[]);

  const matchesPlayed = clipGroups.filter((group) => group.match).length;

  function segmentsFor(clip: PlayerClip): ClipSegmentPlayback[] {
    if (clip.render_status === "ready" && clip.rendered_segments?.length) {
      return clip.rendered_segments.map((segment) => ({
        id: segment.id,
        name: segment.name,
        color: segment.color,
        start_time: segment.play_start ?? 0,
        end_time: segment.duration,
        url: segment.url,
        drawings: (segment.mobile_compatible ? [] : segment.drawings ?? []).map((drawing) => ({
          id: drawing.id,
          url: drawing.url,
          at_time: (segment.drawing_time_base === "clip" ? (segment.play_start ?? 0) : 0) + drawing.at_seconds,
          duration_seconds: drawing.duration_seconds
        }))
      }));
    }

    return [...clip.clip_segments]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .filter((segment) => !!segment.tags)
      .map((segment) => ({ id: segment.id, name: segment.tags!.name, color: segment.tags!.color, start_time: segment.tags!.start_time, end_time: segment.tags!.end_time, url: segment.videos?.video_url }));
  }

  async function shareClip(clip: PlayerClip) {
    setShareError("");
    const { data, error } = await supabase.from("share_links").insert({ clip_id: clip.id }).select().single();
    if (error || !data) {
      setShareError(error?.message || t("share.createFailed"));
      return;
    }
    setShareDialog({ clipName: clip.name, shareUrl: buildPublicShareUrl(data.token) });
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
        <Link href="/dashboard/teams" title={t("team.back")} aria-label={t("team.back")} className="grid h-14 w-14 place-items-center rounded-xl border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover"><MenuIcon src="/branding/Menu/back.svg" /></Link>
        <div className="ml-2 flex min-w-0 flex-1 items-start gap-4">
          <div className="group/photo relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-accent bg-avatar sm:h-36 sm:w-36">
            {clubPlayerContact?.photo_url ? <Image src={clubPlayerContact.photo_url} alt={player ? getPlayerDisplayName(player) : "Speler"} fill sizes="(min-width: 640px) 144px, 112px" className="object-cover" unoptimized /> : <div className="grid h-full w-full place-items-center text-2xl font-bold text-accent">{player?.initials || "–"}</div>}
            {canEditChildInfo && <><input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => event.target.files?.[0] && void uploadPlayerPhoto(event.target.files[0])} /><button type="button" disabled={photoBusy} onClick={() => photoInputRef.current?.click()} title="Spelersfoto uploaden" className="absolute inset-0 grid place-items-center bg-black/55 text-2xl font-bold text-white opacity-0 transition group-hover/photo:opacity-100">+</button></>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h1 className="truncate text-xl font-bold text-textBright">{player ? getPlayerDisplayName(player) : t("team.player")}</h1>{currentlyInjured && <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-300">Geblesseerd</span>}{player?.is_goalkeeper && <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">Doelman</span>}</div>
            <p className="text-sm text-textMuted">{player?.teams?.name || t("team.team")}{player?.position ? ` · ${player.position}` : ""}</p>
            {!!extraGroups.length && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase text-textMuted">Extra groepen</span>{extraGroups.map(group => <span key={group.id} className="rounded-full border border-dashed border-accent/50 bg-accentDim px-2.5 py-1 text-xs font-semibold text-accent">{group.icon ?? "＋"} {group.name}</span>)}</div>}
            <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <ProfileFact label="Naam" value={clubPlayerContact?.last_name || player?.last_name} />
              <ProfileFact label="Voornaam" value={clubPlayerContact?.first_name || player?.first_name} />
              <ProfileFact label="Geboortedatum" value={(clubPlayerContact?.date_of_birth || player?.date_of_birth) ? new Date(`${clubPlayerContact?.date_of_birth || player?.date_of_birth}T12:00:00`).toLocaleDateString("nl-BE") : null} />
              {canEditChildInfo && <ProfileFact label="Rijksregisternummer" value={clubPlayerContact?.national_registry_number} />}
              <ProfileFact label="Geboorteplaats" value={clubPlayerContact?.birth_place} />
              <ProfileFact label="Adres" value={clubPlayerContact?.address ? `${clubPlayerContact.address}, ${clubPlayerContact.postal_code ?? ""} ${clubPlayerContact.city ?? ""}`.trim() : null} wide />
            </dl>
            {photoError && <p className="mt-2 text-xs text-red-300">{photoError}</p>}
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} disabled={!player} title={t("team.editPlayer")} aria-label={t("team.editPlayer")} className="ml-auto grid h-14 w-14 flex-shrink-0 place-items-center rounded-xl border border-borderButton bg-button transition hover:border-accent hover:bg-cardHover disabled:opacity-40"><MenuIcon src="/branding/Menu/edit.svg" /></button>
      </header>
      <nav aria-label="Spelersprofiel" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5">
        {["Contact", "Planning", "Trainingen", "Wedstrijden", "Evaluaties", "Medisch", "Clips", "Vragenlijsten"].map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab.toLowerCase())} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab.toLowerCase() ? "bg-accent text-page" : "text-textSecondary hover:bg-cardHover hover:text-textPrimary"}`}>{tab}</button>)}
      </nav>
      {inviteError && <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{inviteError}</p>}
      {inviteLink && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setInviteLink("")}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-cardAlt p-5" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-textBright">{t("guardianInvite.modalTitle")}</h2>
            <p className="mt-1 text-sm text-textMuted">{t("guardianInvite.modalBody", { name: player ? getPlayerDisplayName(player) : "" })}</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-borderButton bg-input p-2">
              <span className="min-w-0 flex-1 truncate px-2 font-mono text-xs text-textPrimary">{inviteLink}</span>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(inviteLink); setInviteCopied(true); window.setTimeout(() => setInviteCopied(false), 2200); }} className="flex-shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-page hover:opacity-90">{inviteCopied ? t("guardianInvite.copied") : t("guardianInvite.copyButton")}</button>
            </div>
            <button type="button" onClick={() => setInviteLink("")} className="mt-4 w-full rounded-lg border border-borderButton bg-button py-2 text-sm text-textPrimary">{t("common.close")}</button>
          </div>
        </div>
      )}

      {activeTab === "contact" && <>
      {player && (
        <section className="mb-8 rounded-xl border border-border bg-cardDeep p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">{t("guardianInvite.contacts")}</h2>
          {inviteError && <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{inviteError}</p>}
          <div className="mt-3 space-y-2">
            {contactDrafts.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input type="text" value={row.lastName} onChange={(event) => updateContactDraft(index, "lastName", event.target.value)} placeholder="Naam" className="w-36 flex-shrink-0 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <input type="text" value={row.firstName} onChange={(event) => updateContactDraft(index, "firstName", event.target.value)} placeholder="Voornaam" className="w-36 flex-shrink-0 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <input type="email" value={row.email} onChange={(event) => updateContactDraft(index, "email", event.target.value)} placeholder="E-mailadres" className="min-w-52 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <input type="tel" value={row.phone} onChange={(event) => updateContactDraft(index, "phone", event.target.value)} placeholder={t("guardianInvite.contactPhonePlaceholder")} className="w-40 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <button type="button" disabled={invitePending || (!row.email.trim() && !row.phone.trim())} onClick={() => void createGuardianInvite(index)} className="flex-shrink-0 rounded-lg border border-borderButton px-3 py-2 text-xs font-semibold text-accent transition hover:border-accent disabled:opacity-40">
                  {invitePending ? t("guardianInvite.generating") : t("guardianInvite.generateLink")}
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setContactDrafts((current) => [...current, { lastName: "", firstName: "", email: "", phone: "" }])} aria-label={t("guardianInvite.addContact")} title={t("guardianInvite.addContact")} className="grid h-8 w-8 place-items-center rounded-full border border-borderButton text-accent transition hover:border-accent">+</button>
          </div>

          {guardiansError && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{guardiansError}</p>}
          {!guardians.length && !invites.length && <p className="mt-3 text-sm text-textMuted">{t("guardianInvite.noneLinkedYet")}</p>}
          {!!guardians.length && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">{t("guardianInvite.linkedGuardians")}</p>
              {guardians.map((guardian) => (
                <div key={guardian.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-borderSubtle px-3 py-2 text-sm ${guardian.revoked_at ? "opacity-50" : ""}`}>
                  <div>
                    <p className="font-semibold text-textPrimary">
                      {guardian.profiles?.full_name || guardian.profiles?.email || t("guardianInvite.unknownAccount")}
                      <span className="ml-2 rounded-full bg-accentDim px-2 py-0.5 text-[10px] font-normal text-accent">{accessScopeKeys[guardian.access_scope] ? t(accessScopeKeys[guardian.access_scope]) : guardian.access_scope}</span>
                    </p>
                    <p className="text-xs text-textMuted">
                      {guardian.profiles?.full_name ? guardian.profiles.email : ""}
                      {guardian.revoked_at
                        ? ` · ${t("guardianInvite.revokedOn", { date: new Date(guardian.revoked_at).toLocaleDateString("nl-BE") })}`
                        : ` · ${t("guardianInvite.since", { date: new Date(guardian.valid_from).toLocaleDateString("nl-BE") })}`}
                    </p>
                  </div>
                  {!guardian.revoked_at && (
                    <button type="button" disabled={guardiansBusy === guardian.id} onClick={() => void revokeGuardian(guardian.id)} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-40">
                      {t("guardianInvite.revoke")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!!invites.length && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Uitnodigingen</p>
              {invites.map((invite) => {
                const expired = !invite.used_at && new Date(invite.expires_at).getTime() <= Date.now();
                const status = invite.used_at ? "Aanvaard" : expired ? "Verlopen" : invite.sent_at ? "E-mail verzonden" : invite.delivery_error ? "Verzending mislukt" : "Link aangemaakt";
                const statusClass = invite.used_at ? "bg-accentDim text-accent" : expired || invite.delivery_error ? "bg-red-500/15 text-red-300" : invite.sent_at ? "bg-blue-500/15 text-blue-300" : "bg-card text-textMuted";
                const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(invite.sent_at || invite.created_at).getTime()) / 86400000));
                return <div key={invite.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${expired ? "border-red-500/40" : "border-borderSubtle"}`}>
                  <span className="text-textSecondary">
                    <span aria-hidden="true" className={`mr-2 inline-grid h-7 w-7 place-items-center rounded-full ${statusClass}`}>✉</span>
                    <span className="mr-2 font-semibold text-textPrimary">{invite.contact_label || invite.contact_email || "Contactpersoon"}{invite.contact_label && invite.contact_email ? ` · ${invite.contact_email}` : ""}</span>
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{status}</span>
                    <span className="text-xs">{invite.sent_at ? `Verstuurd op ${new Date(invite.sent_at).toLocaleDateString("nl-BE")} · ${daysAgo === 0 ? "vandaag" : `${daysAgo} dag${daysAgo === 1 ? "" : "en"} geleden`}` : `Aangemaakt op ${new Date(invite.created_at).toLocaleDateString("nl-BE")}`} · vervalt {new Date(invite.expires_at).toLocaleDateString("nl-BE")}</span>
                    {invite.delivery_error && <span className="mt-1 block text-xs text-red-300">{invite.delivery_error}</span>}
                  </span>
                  <div className="flex gap-2">
                    {!invite.used_at && <button type="button" disabled={guardiansBusy === invite.id} onClick={() => void cancelInvite(invite.id)} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-40">
                      {t("guardianInvite.cancel")}
                    </button>}
                  </div>
                </div>;
              })}
            </div>
          )}
        </section>
      )}

      {player && clubPlayerContact && (
        <section className="mb-8 rounded-xl border border-border bg-cardDeep p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">{t("guardianInvite.childInfo")}</h2>
          {canEditChildInfo ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="text" value={childInfoDraft.address} onChange={(event) => setChildInfoDraft((current) => ({ ...current, address: event.target.value }))} placeholder={t("guardianInvite.address")} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary sm:col-span-2" />
              <input type="text" value={childInfoDraft.postalCode} onChange={(event) => setChildInfoDraft((current) => ({ ...current, postalCode: event.target.value }))} placeholder={t("guardianInvite.postalCode")} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
              <input type="text" value={childInfoDraft.city} onChange={(event) => setChildInfoDraft((current) => ({ ...current, city: event.target.value }))} placeholder={t("guardianInvite.city")} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
              <input type="email" value={childInfoDraft.email} onChange={(event) => setChildInfoDraft((current) => ({ ...current, email: event.target.value }))} placeholder={t("guardianInvite.childEmail")} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
              <input type="tel" value={childInfoDraft.phone} onChange={(event) => setChildInfoDraft((current) => ({ ...current, phone: event.target.value }))} placeholder={t("guardianInvite.childPhone")} className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
              <input type="text" value={childInfoDraft.nationalRegistryNumber} onChange={(event) => setChildInfoDraft((current) => ({ ...current, nationalRegistryNumber: event.target.value }))} placeholder="Rijksregisternummer" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
              <input type="text" value={childInfoDraft.birthPlace} onChange={(event) => setChildInfoDraft((current) => ({ ...current, birthPlace: event.target.value }))} placeholder="Geboorteplaats" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
              <div className="flex items-center gap-3 sm:col-span-2">
                <button type="button" disabled={childInfoSaving} onClick={() => void saveChildInfo()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page hover:opacity-90 disabled:opacity-50">
                  {childInfoSaving ? t("guardianInvite.saving") : t("guardianInvite.save")}
                </button>
                {childInfoSaved && <span className="text-sm text-textMuted">{t("guardianInvite.saved")}</span>}
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("guardianInvite.address")}</p><p className="mt-1 text-sm text-textPrimary">{clubPlayerContact.address ? `${clubPlayerContact.address}, ${clubPlayerContact.postal_code ?? ""} ${clubPlayerContact.city ?? ""}` : t("guardianInvite.noAddressYet")}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("guardianInvite.childEmail")}</p><p className="mt-1 break-all text-sm text-textPrimary">{clubPlayerContact.email || "–"}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("guardianInvite.childPhone")}</p><p className="mt-1 text-sm text-textPrimary">{clubPlayerContact.phone || "–"}</p></div>
            </div>
          )}
        </section>
      )}

      {player && guardianDetailId && (
        <section className="mb-8 rounded-xl border border-accent/30 bg-cardDeep p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Jouw contact- en adresgegevens voor deze speler</h2>
          <p className="mt-1 text-xs text-textMuted">Deze gegevens horen bij jouw huishouden. Een tweede contactpersoon kan een ander adres invullen.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={guardianDetailDraft.address} onChange={event => setGuardianDetailDraft(current => ({ ...current, address: event.target.value }))} placeholder="Straat en huisnummer" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary sm:col-span-2" />
            <input value={guardianDetailDraft.postalCode} onChange={event => setGuardianDetailDraft(current => ({ ...current, postalCode: event.target.value }))} placeholder="Postcode" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
            <input value={guardianDetailDraft.city} onChange={event => setGuardianDetailDraft(current => ({ ...current, city: event.target.value }))} placeholder="Gemeente" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
            <input type="tel" value={guardianDetailDraft.phone} onChange={event => setGuardianDetailDraft(current => ({ ...current, phone: event.target.value }))} placeholder="Telefoonnummer" className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary sm:col-span-2" />
            <textarea value={guardianDetailDraft.notes} onChange={event => setGuardianDetailDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Praktische informatie (optioneel)" className="min-h-20 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary sm:col-span-2" />
            <div className="flex items-center gap-3 sm:col-span-2"><button type="button" disabled={childInfoSaving} onClick={() => void saveGuardianDetails()} className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page disabled:opacity-50">{childInfoSaving ? "Opslaan…" : "Gegevens opslaan"}</button>{childInfoSaved && <span className="text-sm text-accent">Opgeslagen</span>}</div>
          </div>
        </section>
      )}

      {player && (
        <section className="mb-8 grid gap-3 rounded-xl border border-border bg-cardDeep p-4 sm:grid-cols-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("team.dateOfBirth")}</p><p className="mt-1 text-sm text-textPrimary">{player.date_of_birth ? new Date(`${player.date_of_birth}T00:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("auth.email")}</p><p className="mt-1 break-all text-sm text-textPrimary">{player.email || "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("team.phoneNumbers")}</p><p className="mt-1 text-sm text-textPrimary">{player.phone_numbers?.join(", ") || "–"}</p></div>
        </section>
      )}
      </>}

      {activeTab === "planning" && (
        <section className="rounded-xl border border-border bg-cardDeep p-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Planning van {player?.teams?.name || "de ploeg"}</h2>
            <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{planningItems.length}</span>
          </div>
          {loading ? <p className="text-sm text-textMuted">Planning laden…</p> : planningItems.length ? (
            <div className="space-y-3">
              {planningItems.map(entry => entry.kind === "training" ? (
                <Link key={`training:${entry.item.id}`} href={`/dashboard/training/${entry.item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borderSubtle bg-card p-4 transition hover:border-accent hover:bg-cardHover">
                  <div><p className="font-semibold text-textBright">Training · {entry.item.player_groups?.name ?? entry.item.club_teams?.name ?? player?.teams?.name}</p><p className="mt-1 text-sm text-textMuted">{new Date(`${entry.item.training_date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB")} · {entry.item.start_time.slice(0, 5)}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${entry.item.player_group_id ? "border border-dashed border-accent bg-accentDim text-accent" : "bg-accentDim text-accent"}`}>{entry.item.player_group_id ? "Extra groep" : "Teamtraining"}</span>
                </Link>
              ) : (
                <Link key={`match:${entry.item.id}`} href={`/dashboard/games/${entry.item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borderSubtle bg-card p-4 transition hover:border-accent hover:bg-cardHover">
                  <div><p className="font-semibold text-textBright">{currentTeamMatchNames(entry.item)}</p><p className="mt-1 text-sm text-textMuted">{entry.item.match_date ? new Date(`${entry.item.match_date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : "Datum nog niet bepaald"}{entry.item.start_time ? ` · ${entry.item.start_time.slice(0, 5)}` : ""}</p></div>
                  <span className="rounded-full bg-accentDim px-2.5 py-1 text-xs font-semibold text-accent">Wedstrijd</span>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-textMuted">Voor deze ploeg is nog geen planning gevonden.</p>}
        </section>
      )}

      {activeTab === "trainingen" && (
        <section className="rounded-xl border border-border bg-cardDeep p-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Trainingen van {player?.teams?.name || "de ploeg"}</h2>
            <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{teamTrainings.length}</span>
          </div>
          {attendanceError && <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{attendanceError}</p>}
          {loading ? <p className="text-sm text-textMuted">Trainingen laden…</p> : orderedTrainings.length ? (
            <div className="space-y-4">
              {trainingWeekGroups.map((group) => {
                const weekIsPast = group.sunday.getTime() < todayStart.getTime();
                return (
                  <section key={group.key} className="overflow-hidden rounded-xl border border-borderSubtle bg-card">
                    <div className="flex items-center justify-between border-b border-borderSubtle bg-cardDeep px-4 py-2">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-textSecondary">
                        {group.monday.toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { day: "2-digit", month: "long" })} – {group.sunday.toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                      </h3>
                      {weekIsPast && <span className="text-xs text-textMuted">Afgelopen</span>}
                    </div>
                    <div className="divide-y divide-borderSubtle">
                      {group.trainings.map((training) => (
                        <div key={training.id} className="grid items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(280px,1.25fr)_minmax(210px,1fr)_minmax(210px,1fr)_auto]">
                          <Link href={`/dashboard/training/${training.id}`} className="font-semibold text-textBright transition hover:text-accent">
                            {new Date(`${training.training_date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB", { weekday: "long", day: "2-digit", month: "long" })} · {training.start_time.slice(0, 5)}{training.player_groups && <span className="ml-2 text-xs font-normal text-accent">{training.player_groups.icon ?? "＋"} {training.player_groups.name}</span>}
                          </Link>
                          <p className="min-w-0 truncate text-sm text-textPrimary"><span className="mr-2 text-xs font-semibold uppercase text-textMuted">Veld</span>{optionNames[training.field_option_id ?? ""] || "Nog niet bepaald"}</p>
                          <p className="min-w-0 truncate text-sm text-textPrimary"><span className="mr-2 text-xs font-semibold uppercase text-textMuted">KK</span>{optionNames[training.locker_room_option_id ?? ""] || "Nog niet bepaald"}</p>
                          <select
                            aria-label={`Aanwezigheid op ${training.training_date}`}
                            value={training.attendance_status}
                            disabled={!training.can_edit_attendance || attendanceBusy === training.id}
                            onChange={(event) => updateTrainingAttendance(training.id, event.target.value as TeamTraining["attendance_status"])}
                            title={!training.can_edit_attendance ? "Aanwezigheid kan niet meer aangepast worden of je hebt geen bewerkrechten." : "Aanwezigheid van deze speler aanpassen"}
                            className="justify-self-end rounded-lg border border-border bg-cardDeep px-2.5 py-1.5 text-sm text-textPrimary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <option value="unknown">Onbekend</option>
                            <option value="present">Aanwezig</option>
                            <option value="absent">Afwezig</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : <p className="text-sm text-textMuted">Voor deze ploeg zijn nog geen trainingen ingepland.</p>}
        </section>
      )}

      {activeTab === "wedstrijden" && (
        <section className="rounded-xl border border-border bg-cardDeep p-4">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Wedstrijden van {player?.teams?.name || "de ploeg"}</h2>
            <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{teamMatches.length}</span>
          </div>
          {loading ? <p className="text-sm text-textMuted">Wedstrijden laden…</p> : teamMatches.length ? (
            <div className="space-y-3">
              {orderedMatches.map((match) => (
                <Link key={match.id} href={`/dashboard/games/${match.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borderSubtle bg-card p-4 transition hover:border-accent hover:bg-cardHover">
                  <div>
                    <p className="font-semibold text-textBright">{currentTeamMatchNames(match)}</p>
                    <p className="mt-1 text-sm text-textMuted">{match.match_date ? new Date(`${match.match_date}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : "Datum nog niet bepaald"}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {match.score_a !== null && match.score_b !== null && <strong className="text-lg text-textBright">{match.score_a}–{match.score_b}</strong>}
                    <span className="rounded-full bg-accentDim px-2.5 py-1 text-xs font-semibold capitalize text-accent">{match.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-textMuted">Voor deze ploeg zijn nog geen wedstrijden gevonden.</p>}
        </section>
      )}

      {activeTab === "evaluaties" && <section className="rounded-xl border border-border bg-cardDeep p-4"><div className="mb-4 flex items-center gap-2"><h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">Evaluatiehistoriek</h2><span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{groupEvaluations.length}</span></div>{groupEvaluations.length ? <div className="space-y-3">{groupEvaluations.map(evaluation => <div key={evaluation.id} className="grid gap-3 rounded-xl border border-borderSubtle bg-card p-4 sm:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_70px]"><div><strong className="text-textBright">{evaluation.player_groups?.icon ?? "＋"} {evaluation.player_groups?.name}</strong><p className="text-xs text-textMuted">{evaluation.profiles?.full_name ? `Keepertrainer ${evaluation.profiles.full_name} · ` : ""}{new Date(evaluation.evaluated_at).toLocaleDateString("nl-BE")}</p></div><div><p className="text-sm font-semibold text-textPrimary">{evaluation.player_group_evaluation_criteria?.name}</p>{evaluation.note && <p className="mt-1 text-xs text-textMuted">{evaluation.note}</p>}</div><span className="grid h-10 w-10 place-items-center rounded-full bg-accentDim text-sm font-black text-accent">{evaluation.score}/5</span></div>)}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Nog geen evaluaties vanuit Extra groepen.</p>}</section>}

      {activeTab === "medisch" && <PlayerInjuries playerId={playerId} onStatus={setCurrentlyInjured} />}

      {activeTab === "clips" && <>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">{t("playerPage.sharedClipsMatches")}</h2>
        <span className="rounded-full bg-accentDim px-2 py-0.5 text-xs text-accent">{clips.length}</span>
      </div>

      {player && (
        <section className="mb-6 grid gap-3 rounded-xl border border-border bg-cardDeep p-4 sm:grid-cols-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("playerPage.matchesPlayed")}</p><p className="mt-1 text-2xl font-bold text-textBright">{matchesPlayed}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("playerPage.goals")}</p><p className="mt-1 text-2xl font-bold text-textBright">{stats.goals}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("playerPage.assists")}</p><p className="mt-1 text-2xl font-bold text-textBright">{stats.assists}</p></div>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-textMuted">{t("team.loadingClips")}</p>
      ) : clips.length ? (
        <div className="space-y-5">
          {clipGroups.map((group) => (
            <section key={group.key} className="overflow-hidden rounded-xl border border-border bg-cardDeep">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borderSubtle px-4 py-3">
                <div>
                  <h3 className="font-semibold text-textBright">
                    {group.match ? `${group.match.team_a_name} – ${group.match.team_b_name}` : group.videoTitle}
                  </h3>
                  <p className="mt-0.5 text-xs text-textMuted">
                    {group.match?.match_date
                      ? new Date(`${group.match.match_date}T00:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB")
                      : "Oudere clip zonder wedstrijdkoppeling"}
                    {group.match?.start_time ? ` · ${group.match.start_time.slice(0, 5)}` : ""}
                    {group.match && group.match.score_a !== null && group.match.score_b !== null ? ` · ${group.match.score_a}–${group.match.score_b}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-accentDim px-2.5 py-1 text-xs font-semibold text-accent">{group.clips.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.clips.map((clip) => <ClipCard key={clip.id} name={clip.name} videoTitle={clip.videos?.title || t("team.untitledVideo")} segmentCount={clip.clip_segments.length} onClick={() => setSelectedClip(clip)} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-cardDeep p-5 text-sm text-textMuted">{t("team.noTaggedClips")}</div>
      )}
      </>}

      {!['contact', 'planning', 'trainingen', 'wedstrijden', 'evaluaties', 'medisch', 'clips'].includes(activeTab) && <section className="rounded-xl border border-dashed border-border bg-cardDeep p-8 text-center"><h2 className="text-lg font-semibold capitalize text-textBright">{activeTab}</h2><p className="mt-2 text-sm text-textMuted">Voor dit onderdeel zijn nog geen gegevens toegevoegd.</p></section>}

      {selectedClip && selectedClip.videos && (
        <ClipPreviewModal clipName={selectedClip.name} videoUrl={selectedClip.videos.video_url} segments={segmentsFor(selectedClip)} onClose={() => setSelectedClip(null)} onShare={() => void shareClip(selectedClip)} />
      )}
      {shareError && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{shareError}</p>}
      {shareDialog && <ShareClipDialog clipName={shareDialog.clipName} shareUrl={shareDialog.shareUrl} onClose={() => setShareDialog(null)} />}
      {editing && player && <EditPlayerModal player={player} onClose={() => setEditing(false)} onSaved={() => void loadPlayerAndClips()} />}
    </div>
  );
}

function ProfileFact({ label, value, wide = false }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-[10px] font-bold uppercase tracking-wide text-textMuted">{label}</dt><dd className="mt-0.5 truncate text-textPrimary" title={value || undefined}>{value || "—"}</dd></div>;
}
