"use client";

import { useEffect, useState } from "react";
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

type PlayerWithTeam = Player & { teams: { name: string; club_team_id: string | null } | null };
type Guardian = { id: string; profile_id: string; access_scope: string; valid_from: string; valid_until: string | null; revoked_at: string | null; created_at: string; profiles: { email: string; full_name: string | null } | null };
type PendingInvite = { id: string; token: string; contact_label: string | null; contact_phone: string | null; created_at: string; expires_at: string };
type ClubPlayerContact = { id: string; club_id: string; address: string | null; postal_code: string | null; city: string | null; email: string | null; phone: string | null };
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
    sequence_order: number;
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
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [guardiansError, setGuardiansError] = useState("");
  const [guardiansBusy, setGuardiansBusy] = useState("");
  const [contactDrafts, setContactDrafts] = useState<{ label: string; phone: string }[]>([{ label: "", phone: "" }]);
  const [clubPlayerContact, setClubPlayerContact] = useState<ClubPlayerContact | null>(null);
  const [canEditChildInfo, setCanEditChildInfo] = useState(false);
  const [childInfoDraft, setChildInfoDraft] = useState({ address: "", postalCode: "", city: "", email: "", phone: "" });
  const [childInfoSaving, setChildInfoSaving] = useState(false);
  const [childInfoSaved, setChildInfoSaved] = useState(false);
  const supabase = createClient();

  function updateContactDraft(index: number, field: "label" | "phone", value: string) {
    setContactDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  async function createGuardianInvite(index: number) {
    const draft = contactDrafts[index];
    setInvitePending(true);
    setInviteError("");
    const response = await fetch(`/api/players/${playerId}/invite`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactLabel: draft.label.trim(), contactPhone: draft.phone.trim() })
    });
    const body = await response.json().catch(() => null) as { token?: string; error?: string } | null;
    setInvitePending(false);
    if (!response.ok || !body?.token) { setInviteError(body?.error || "De uitnodigingslink kon niet aangemaakt worden."); return; }
    setInviteLink(`${window.location.origin}/join/${body.token}`);
    setContactDrafts((current) => current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : [{ label: "", phone: "" }]);
    await loadGuardians();
  }

  async function loadChildInfo(currentPlayer: PlayerWithTeam) {
    if (!currentPlayer.membership_id) { setClubPlayerContact(null); return; }
    const { data: membership } = await supabase.from("player_team_memberships").select("club_player_id").eq("id", currentPlayer.membership_id).maybeSingle();
    if (!membership?.club_player_id) { setClubPlayerContact(null); return; }
    const { data: clubPlayer } = await supabase.from("club_players").select("id, club_id, address, postal_code, city, email, phone").eq("id", membership.club_player_id).maybeSingle();
    if (!clubPlayer) { setClubPlayerContact(null); return; }
    setClubPlayerContact(clubPlayer);
    setChildInfoDraft({ address: clubPlayer.address ?? "", postalCode: clubPlayer.postal_code ?? "", city: clubPlayer.city ?? "", email: clubPlayer.email ?? "", phone: clubPlayer.phone ?? "" });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: membershipRow } = await supabase.from("club_memberships").select("role").eq("club_id", clubPlayer.club_id).eq("profile_id", user.id).eq("status", "active").maybeSingle();
    setCanEditChildInfo(membershipRow?.role === "club_admin");
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
    }).eq("id", clubPlayerContact.id);
    setChildInfoSaving(false);
    if (!error) { setChildInfoSaved(true); await loadChildInfo(player as PlayerWithTeam); }
  }

  async function loadGuardians() {
    const response = await fetch(`/api/players/${playerId}/guardians`);
    const body = await response.json().catch(() => null) as { guardians?: Guardian[]; pendingInvites?: PendingInvite[] } | null;
    if (response.ok && body) { setGuardians(body.guardians ?? []); setPendingInvites(body.pendingInvites ?? []); }
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
    const [playerResult, clipResult, statsResult] = await Promise.all([
      supabase.from("players").select("*, teams(name, club_team_id)").eq("id", playerId).single(),
      supabase.from("clips").select(`
        id, name, created_at, team_id, audience_type, audience_player_ids, render_status, rendered_segments,
        videos(id, title, video_url, match_videos(match_id, matches(id, team_a_name, team_b_name, match_date, start_time, score_a, score_b))),
        clip_segments(sequence_order, tags(id, name, start_time, end_time, color, player_ids))
      `).order("created_at", { ascending: false }),
      supabase.from("player_career_stats").select("goals, assists").eq("player_id", playerId).maybeSingle()
    ]);

    const loadedPlayer = (playerResult.data as unknown as PlayerWithTeam | null) ?? null;
    setPlayer(loadedPlayer);
    setStats({ goals: statsResult.data?.goals ?? 0, assists: statsResult.data?.assists ?? 0 });
    const allClips = (clipResult.data as unknown as PlayerClip[] | null) ?? [];
    if (loadedPlayer) void loadChildInfo(loadedPlayer);
    setClips(allClips.filter((clip) => {
      if (!loadedPlayer) return false;
      if (clip.audience_player_ids.includes(playerId) || clip.clip_segments.some((segment) => segment.tags?.player_ids.includes(playerId))) return true;
      return clip.team_id === loadedPlayer.team_id && clip.audience_type === "full_team";
    }));
    setLoading(false);
  }

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
      .map((segment) => segment.tags)
      .filter((tag): tag is NonNullable<typeof tag> => !!tag)
      .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color, start_time: tag.start_time, end_time: tag.end_time }));
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
      <header className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Link href="/dashboard/teams" title={t("team.back")} className="grid h-14 w-14 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/back.png" alt={t("team.back")} width={38} height={38} /></Link>
        <Link href="/dashboard" title={t("nav.home")} className="grid h-14 w-14 place-items-center rounded-lg border border-borderButton bg-button hover:border-accent"><Image src="/branding/home.png" alt={t("nav.home")} width={34} height={34} /></Link>
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-3">
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full border-2 border-accent bg-avatar font-bold text-accent">{player?.initials || "–"}</div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-textBright">{player ? getPlayerDisplayName(player) : t("team.player")}</h1>
            <p className="text-sm text-textMuted">{player?.teams?.name || t("team.team")}{player?.position ? ` · ${player.position}` : ""}</p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} disabled={!player} title={t("team.editPlayer")} aria-label={t("team.editPlayer")} className="ml-auto grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg border border-borderButton bg-button transition hover:border-accent disabled:opacity-40"><Image src="/branding/edit.png" alt={t("common.edit")} width={34} height={34} /></button>
      </header>
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

      {player && (
        <section className="mb-8 rounded-xl border border-border bg-cardDeep p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-textSecondary">{t("guardianInvite.contacts")}</h2>
          {inviteError && <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{inviteError}</p>}
          <div className="mt-3 space-y-2">
            {contactDrafts.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input type="text" value={row.label} onChange={(event) => updateContactDraft(index, "label", event.target.value)} placeholder={t("guardianInvite.contactNamePlaceholder")} className="w-32 flex-shrink-0 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <input type="tel" value={row.phone} onChange={(event) => updateContactDraft(index, "phone", event.target.value)} placeholder={t("guardianInvite.contactPhonePlaceholder")} className="w-40 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
                <button type="button" disabled={invitePending || !row.phone.trim()} onClick={() => void createGuardianInvite(index)} className="flex-shrink-0 rounded-lg border border-borderButton px-3 py-2 text-xs font-semibold text-accent transition hover:border-accent disabled:opacity-40">
                  {invitePending ? t("guardianInvite.generating") : t("guardianInvite.generateLink")}
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setContactDrafts((current) => [...current, { label: "", phone: "" }])} aria-label={t("guardianInvite.addContact")} title={t("guardianInvite.addContact")} className="grid h-8 w-8 place-items-center rounded-full border border-borderButton text-accent transition hover:border-accent">+</button>
          </div>

          {guardiansError && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">{guardiansError}</p>}
          {!guardians.length && !pendingInvites.length && <p className="mt-3 text-sm text-textMuted">{t("guardianInvite.noneLinkedYet")}</p>}
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
          {!!pendingInvites.length && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">{t("guardianInvite.pendingInvites")}</p>
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-borderSubtle px-3 py-2 text-sm">
                  <span className="text-textSecondary">
                    {invite.contact_label && <span className="mr-2 font-semibold text-textPrimary">{invite.contact_label}{invite.contact_phone ? ` (${invite.contact_phone})` : ""}</span>}
                    {t("guardianInvite.createdOn", { date: new Date(invite.created_at).toLocaleDateString("nl-BE"), expiry: new Date(invite.expires_at).toLocaleDateString("nl-BE") })}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/join/${invite.token}`)} className="rounded-lg border border-borderButton px-3 py-1.5 text-xs text-textPrimary">
                      {t("guardianInvite.copyLink")}
                    </button>
                    <button type="button" disabled={guardiansBusy === invite.id} onClick={() => void cancelInvite(invite.id)} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-40">
                      {t("guardianInvite.cancel")}
                    </button>
                  </div>
                </div>
              ))}
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

      {player && (
        <section className="mb-8 grid gap-3 rounded-xl border border-border bg-cardDeep p-4 sm:grid-cols-3">
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("team.dateOfBirth")}</p><p className="mt-1 text-sm text-textPrimary">{player.date_of_birth ? new Date(`${player.date_of_birth}T00:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("auth.email")}</p><p className="mt-1 break-all text-sm text-textPrimary">{player.email || "–"}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("team.phoneNumbers")}</p><p className="mt-1 text-sm text-textPrimary">{player.phone_numbers?.join(", ") || "–"}</p></div>
        </section>
      )}

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

      {selectedClip && selectedClip.videos && (
        <ClipPreviewModal clipName={selectedClip.name} videoUrl={selectedClip.videos.video_url} segments={segmentsFor(selectedClip)} onClose={() => setSelectedClip(null)} onShare={() => void shareClip(selectedClip)} />
      )}
      {shareError && <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{shareError}</p>}
      {shareDialog && <ShareClipDialog clipName={shareDialog.clipName} shareUrl={shareDialog.shareUrl} onClose={() => setShareDialog(null)} />}
      {editing && player && <EditPlayerModal player={player} onClose={() => setEditing(false)} onSaved={() => void loadPlayerAndClips()} />}
    </div>
  );
}
