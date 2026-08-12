"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Match, Player } from "@/types/database";

type Option = { id: string; option_type: "field" | "locker_room" | "visitor_locker_room" | "referee" | "meeting_place" | "non_selection_reason"; label: string };
type Selection = { player_id: string; selected: boolean; jersey_number: number | null; non_selection_reason_id: string | null; note: string | null; individual_attention_point: string | null };
type PlayerDraft = { playerId: string; selected: boolean; jerseyNumber: string; reasonId: string; attentionPoint: string };
type ExtraPlayer = Player & { team_name?: string };
type GuestDraft = { firstName: string; lastName: string; jerseyNumber: string; note: string };
type SelectionSend = { id: string; status: "sending" | "sent" | "partial" | "failed"; sent_recipient_count: number; failed_recipient_count: number; intended_recipient_count: number; notify_not_selected: boolean; created_at: string; completed_at: string | null; profiles?: { full_name: string | null } | null };
type SelectionCommunication = { canSend: boolean; selectedRecipients: number; notSelectedRecipients: number; selectedPlayersWithoutEmail: number; changedSinceSend: boolean; latest: SelectionSend | null; history: SelectionSend[] };

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";

export function MatchPreparationDialog({ match, onClose, onSaved, embedded = false }: { match: Match; onClose: () => void; onSaved: () => Promise<void>; embedded?: boolean }) {
  const { t } = useI18n();
  const [loadedMatch, setLoadedMatch] = useState<Match | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [extraPlayers, setExtraPlayers] = useState<ExtraPlayer[]>([]);
  const [extraPlayerId, setExtraPlayerId] = useState("");
  const [guestPlayers, setGuestPlayers] = useState<GuestDraft[]>([]);
  const [drafts, setDrafts] = useState<PlayerDraft[]>([]);
  const [generalOpen, setGeneralOpen] = useState(false);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [meetingTimeEnabled, setMeetingTimeEnabled] = useState(false);
  const [isHomeMatch, setIsHomeMatch] = useState(true);
  const [meetingTime, setMeetingTime] = useState("");
  const [departureTimeEnabled, setDepartureTimeEnabled] = useState(false);
  const [departureTime, setDepartureTime] = useState("");
  const [fieldOptionId, setFieldOptionId] = useState("");
  const [lockerRoomOptionId, setLockerRoomOptionId] = useState("");
  const [visitorLockerRoomOptionId, setVisitorLockerRoomOptionId] = useState("");
  const [refereeOptionId, setRefereeOptionId] = useState("");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [meetingPlaceOptionId, setMeetingPlaceOptionId] = useState("");
  const [meetingPlaceCustom, setMeetingPlaceCustom] = useState("");
  const [meetingPlaceEnabled, setMeetingPlaceEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [canPlan, setCanPlan] = useState(false);
  const [canSelect, setCanSelect] = useState(false);
  const [canViewSelection, setCanViewSelection] = useState(false);
  const [canUseTags, setCanUseTags] = useState(false);
  const [matchFormat, setMatchFormat] = useState("");
  const [periodCount, setPeriodCount] = useState("");
  const [periodMinutes, setPeriodMinutes] = useState("");
  const [minimumPlayers, setMinimumPlayers] = useState("");
  const [transportMode, setTransportMode] = useState<"club" | "own">("own");
  const [communication, setCommunication] = useState<SelectionCommunication | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [notifyNotSelected, setNotifyNotSelected] = useState(false);
  const [individualNotSelectedIds, setIndividualNotSelectedIds] = useState<string[]>([]);
  const [includeSelectedAttention, setIncludeSelectedAttention] = useState(true);
  const [includeNotSelectedAttention, setIncludeNotSelectedAttention] = useState(true);
  const [sending, setSending] = useState(false);
  const sendKeyRef = useRef("");

  async function loadCommunication() {
    const response = await fetch(`/api/matches/${match.id}/selection-send`, { cache: "no-store" });
    if (!response.ok) return;
    setCommunication(await response.json());
  }

  useEffect(() => {
    void fetch(`/api/matches/${match.id}/preparation`, { cache: "no-store" }).then(async response => {
      const body = await response.json();
      if (!response.ok) { setNotice(body.error || t("matchPrep.loadFailed")); setBusy(false); return; }
      const current = body.match as Match & Record<string, any>;
      setCanPlan(body.capabilities?.canPlan === true);
      setCanSelect(body.capabilities?.canSelect === true);
      setCanViewSelection(body.capabilities?.canViewSelection === true || body.capabilities?.canSelect === true);
      setCanUseTags(body.capabilities?.canTags === true || body.capabilities?.canCreateTagLink === true);
      const availableOptions = (body.options ?? []) as Option[];
      const defaultMeetingPlace = availableOptions.find(option =>
        option.option_type === "meeting_place" && option.label.trim().toLocaleLowerCase("nl") === "kleedkamer"
      );
      const selections = body.selections as Selection[];
      const selectionByPlayer = new Map(selections.map(item => [item.player_id, item]));
      const availableExtras = (body.extraPlayers as ExtraPlayer[] ?? []).filter(player => player.role === "player");
      const savedExtraIds = new Set(selections.filter(item => item.selected).map(item => item.player_id));
      const roster = [
        ...(body.players as Player[]).filter(player => player.role === "player"),
        ...availableExtras.filter(player => savedExtraIds.has(player.id) || (current.player_ids ?? []).includes(player.id))
      ];
      setLoadedMatch(current);
      setOptions(availableOptions);
      setPlayers(roster);
      setExtraPlayers(availableExtras);
      setGuestPlayers((body.guestPlayers ?? []).map((guest: any) => ({
        firstName: guest.first_name ?? "", lastName: guest.last_name ?? "",
        jerseyNumber: guest.jersey_number?.toString() ?? "", note: guest.note ?? ""
      })));
      setDrafts(roster.map(player => {
        const saved = selectionByPlayer.get(player.id);
        return {
          playerId: player.id,
          selected: saved?.selected ?? (current.player_ids ?? []).includes(player.id),
          jerseyNumber: saved?.jersey_number?.toString() ?? player.jersey_number?.toString() ?? "",
          reasonId: saved?.non_selection_reason_id ?? "",
          attentionPoint: saved?.individual_attention_point ?? saved?.note ?? ""
        };
      }));
      setMeetingTimeEnabled(current.meeting_time_enabled === true || !current.meeting_time);
      setIsHomeMatch(current.is_home_match !== false);
      setMeetingTime(current.meeting_time?.slice(0, 5) ?? "");
      setDepartureTimeEnabled(current.departure_time_enabled === true);
      setDepartureTime(current.departure_time?.slice(0, 5) ?? "");
      setFieldOptionId(current.field_option_id ?? "");
      setLockerRoomOptionId(current.locker_room_option_id ?? "");
      setVisitorLockerRoomOptionId(current.visitor_locker_room_option_id ?? "");
      setRefereeOptionId(current.referee_option_id ?? availableOptions.find(option => option.option_type === "referee" && option.label === "Aangeduid door KBVB")?.id ?? "");
      setTagNames(current.live_tag_names ?? []);
      setMeetingPlaceOptionId(current.meeting_place_option_id ?? defaultMeetingPlace?.id ?? "");
      setMeetingPlaceCustom(current.meeting_place_custom ?? "");
      setMeetingPlaceEnabled(!!current.meeting_place_option_id || !!current.meeting_place_custom || !!defaultMeetingPlace);
      setMatchFormat(current.match_format ?? "");
      setPeriodCount(current.match_period_count?.toString() ?? "");
      setPeriodMinutes(current.match_period_minutes?.toString() ?? "");
      setMinimumPlayers(current.match_minimum_players?.toString() ?? "");
      const age = Number(String(body.ageCategory ?? "").match(/U(\d+)/i)?.[1] ?? 99);
      setTransportMode(current.transport_mode === "club" || (!current.transport_mode && current.is_home_match === false && age <= 13) ? "club" : "own");
      setBusy(false);
      void loadCommunication();
    });
  }, [match.id, t]);

  const byType = (type: Option["option_type"]) => options.filter(option => option.option_type === type);

  function updatePlayer(playerId: string, update: Partial<PlayerDraft>) {
    setDrafts(current => current.map(item => item.playerId === playerId ? { ...item, ...update } : item));
  }

  function addExtraPlayer() {
    const player = extraPlayers.find(item => item.id === extraPlayerId);
    if (!player || players.some(item => item.id === player.id)) return;
    setPlayers(current => [...current, player]);
    setDrafts(current => [...current, {
      playerId: player.id, selected: true, jerseyNumber: player.jersey_number?.toString() ?? "", reasonId: "", attentionPoint: ""
    }]);
    setExtraPlayerId("");
  }

  async function save(closeAfter = true) {
    setBusy(true); setNotice("");
    const response = await fetch(`/api/matches/${match.id}/preparation`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isHomeMatch, meetingTimeEnabled, meetingTime,
        departureTimeEnabled: !isHomeMatch && departureTimeEnabled,
        departureTime: !isHomeMatch ? departureTime : "",
        fieldOptionId, lockerRoomOptionId, visitorLockerRoomOptionId, refereeOptionId,
        meetingPlaceEnabled, meetingPlaceOptionId, meetingPlaceCustom, tagNames,
        matchFormat,
        periodCount: periodCount === "" ? null : Number(periodCount),
        periodMinutes: periodMinutes === "" ? null : Number(periodMinutes),
        minimumPlayers: minimumPlayers === "" ? null : Number(minimumPlayers), transportMode,
        players: drafts.map(item => ({
          playerId: item.playerId, selected: item.selected,
          jerseyNumber: item.jerseyNumber === "" ? null : Number(item.jerseyNumber),
          reasonId: item.reasonId, attentionPoint: item.attentionPoint
        })),
        guestPlayers: guestPlayers.map(item => ({
          firstName: item.firstName, lastName: item.lastName,
          jerseyNumber: item.jerseyNumber === "" ? null : Number(item.jerseyNumber), note: item.note
        }))
      })
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(body.error || t("matchPrep.saveFailed")); return false; }
    if (closeAfter) { await onSaved(); onClose(); }
    return true;
  }

  async function prepareSelectionSend() {
    if (!await save(false)) return;
    await loadCommunication();
    setSendOpen(true);
  }

  async function sendSelection() {
    setSending(true); setNotice("");
    if (!sendKeyRef.current) sendKeyRef.current = crypto.randomUUID();
    const response = await fetch(`/api/matches/${match.id}/selection-send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: sendKeyRef.current, notifyNotSelected, individualNotSelectedIds, includeSelectedAttention, includeNotSelectedAttention })
    });
    const body = await response.json();
    setSending(false);
    if (!response.ok) { setNotice(body.error || "Selectie kon niet worden verstuurd."); await loadCommunication(); return; }
    sendKeyRef.current = "";
    setSendOpen(false);
    await loadCommunication();
    setNotice(body.send?.status === "sent" ? "Selectie verstuurd." : "Selectie gedeeltelijk verstuurd. Controleer de verzendstatus.");
  }

  const placeIsOther = meetingPlaceOptionId === "custom";
  const selectedDrafts = drafts.filter(item => item.selected);
  const validGuestPlayers = guestPlayers.filter(item => item.firstName.trim() || item.lastName.trim());
  const selectedCount = selectedDrafts.length + validGuestPlayers.length;
  const selectedPlayerIds = new Set(selectedDrafts.map(item => item.playerId));
  const selectedKeepers = players.filter(player => selectedPlayerIds.has(player.id) && player.is_goalkeeper).length;
  const selectedFieldPlayers = selectedDrafts.length - selectedKeepers + validGuestPlayers.length;
  const duplicateJerseyNumbers = Array.from(new Set(selectedDrafts
    .map(item => item.jerseyNumber.trim()).filter(Boolean)
    .filter((number, index, numbers) => numbers.indexOf(number) !== index)));
  return <div className={embedded ? "w-full" : "fixed inset-0 z-50 grid place-items-center bg-black/75 p-3"} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : true}>
    <div className={embedded ? "w-full rounded-2xl border border-border bg-cardAlt" : "max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-cardAlt shadow-2xl"}>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-cardAlt p-4">
        <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-bold text-textBright">{t("matchPrep.title")}</h2><p className="truncate text-sm text-textMuted">{match.team_a_name} – {match.team_b_name}</p></div>
        {!embedded && <button type="button" onClick={onClose} className="rounded-lg border border-borderButton px-3 py-2 text-textPrimary">{t("common.close")}</button>}
      </header>
      {busy && !loadedMatch ? <p className="p-6 text-textMuted">{t("common.loading")}</p> : <div className="space-y-3 p-4">
        {communication && <section className={`rounded-xl border p-3 text-sm ${!communication.latest ? "border-borderSubtle bg-cardDeep text-textMuted" : communication.changedSinceSend ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : communication.latest.status === "sent" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
          {!communication.latest ? <strong>Selectie nog niet verstuurd</strong> : <><strong>{communication.changedSinceSend ? "Gewijzigd sinds verzending" : communication.latest.status === "sent" ? "Selectie verstuurd" : communication.latest.status === "partial" ? "Selectie gedeeltelijk verstuurd" : "Selectieverzending mislukt"}</strong><span className="ml-2 text-xs opacity-80">{new Date(communication.latest.completed_at ?? communication.latest.created_at).toLocaleString("nl-BE")} door {communication.latest.profiles?.full_name || "staff"}</span></>}
        </section>}
        {canPlan && <section className="rounded-xl border border-border bg-card">
          <button type="button" onClick={() => setGeneralOpen(open => !open)} className="flex w-full items-center justify-between p-4 text-left font-bold text-textBright">
            {t("matchPrep.general")}<span className={`text-accent transition ${generalOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {generalOpen && <div className="grid gap-3 border-t border-borderSubtle p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-textPrimary"><input type="checkbox" checked={meetingTimeEnabled} onChange={event => setMeetingTimeEnabled(event.target.checked)} className="accent-accent" />{t("matchPrep.meetingTime")}</label>
              {meetingTimeEnabled && <input type="time" value={meetingTime} onChange={event => setMeetingTime(event.target.value)} className={inputClass} />}
              <p className="text-xs text-textMuted">Dit is het tijdstip waarop iedereen aanwezig moet zijn.</p>
            </div>
            <div className="rounded-lg border border-borderSubtle bg-cardDeep p-3 text-sm text-textSecondary">
              <strong className="block text-textBright">{match.team_a_name} – {match.team_b_name}</strong>
              <span>{match.match_date || "—"}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}</span>
            </div>
            <label className="text-sm text-textSecondary">Spelvorm<select value={matchFormat} onChange={event => setMatchFormat(event.target.value)} className={`mt-1 ${inputClass}`}><option value="">—</option><option value="5v5">5v5</option><option value="8v8">8v8</option><option value="11v11">11v11</option></select></label>
            <label className="text-sm text-textSecondary">Aantal periodes<input type="number" min="1" max="12" value={periodCount} onChange={event => setPeriodCount(event.target.value)} className={`mt-1 ${inputClass}`} /></label>
            <label className="text-sm text-textSecondary">Minuten per periode<input type="number" min="1" max="120" value={periodMinutes} onChange={event => setPeriodMinutes(event.target.value)} className={`mt-1 ${inputClass}`} /></label>
            <label className="text-sm text-textSecondary">Minimum spelers<input type="number" min="1" max="30" value={minimumPlayers} onChange={event => setMinimumPlayers(event.target.value)} className={`mt-1 ${inputClass}`} /><span className="mt-1 block text-[11px] text-textMuted">Alleen gebruikt om een tekort in de selectie te signaleren.</span></label>
            {isHomeMatch && <label className="text-sm text-textSecondary">{t("matchPrep.field")}<select value={fieldOptionId} onChange={event => setFieldOptionId(event.target.value)} className={`mt-1 ${inputClass}`}><option value="">—</option>{byType("field").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
            {isHomeMatch && <label className="text-sm text-textSecondary">{t("matchPrep.lockerRoom")}<select value={lockerRoomOptionId} onChange={event => setLockerRoomOptionId(event.target.value)} className={`mt-1 ${inputClass}`}><option value="">—</option>{byType("locker_room").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
            {isHomeMatch && <label className="text-sm text-textSecondary">Kleedkamer bezoekers<select value={visitorLockerRoomOptionId} onChange={event => setVisitorLockerRoomOptionId(event.target.value)} className={`mt-1 ${inputClass}`}><option value="">—</option>{byType("visitor_locker_room").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
            <label className="text-sm text-textSecondary">Scheidsrechter<select value={refereeOptionId} onChange={event => setRefereeOptionId(event.target.value)} className={`mt-1 ${inputClass}`}><option value="">Aangeduid door KBVB</option>{byType("referee").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={meetingPlaceEnabled} onChange={event => setMeetingPlaceEnabled(event.target.checked)} className="accent-accent" />{t("matchPrep.meetingPlace")}</label>
              {meetingPlaceEnabled && <><select value={meetingPlaceOptionId} onChange={event => setMeetingPlaceOptionId(event.target.value)} className={inputClass}><option value="">—</option>{byType("meeting_place").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}<option value="custom">{t("matchPrep.other")}</option></select>{placeIsOther && <input value={meetingPlaceCustom} onChange={event => setMeetingPlaceCustom(event.target.value)} placeholder={t("matchPrep.enterPlace")} className={`mt-2 ${inputClass}`} />}</>}
            </div>
            {!isHomeMatch && <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={departureTimeEnabled} onChange={event => setDepartureTimeEnabled(event.target.checked)} className="accent-accent" />{t("matchPrep.departureTime")}</label>
              {departureTimeEnabled && <input type="time" value={departureTime} onChange={event => setDepartureTime(event.target.value)} className={inputClass} />}
            </div>}
            {!isHomeMatch && <label className="text-sm text-textSecondary">Vervoer<select value={transportMode} onChange={event => setTransportMode(event.target.value as "club" | "own")} className={`mt-1 ${inputClass}`}><option value="club">Door de club</option><option value="own">Eigen vervoer</option></select><span className="mt-1 block text-[11px] text-textMuted">U13 en jonger staat standaard op ‘Door de club’; je kunt dit steeds vervangen.</span></label>}
          </div>}
        </section>}
        {canViewSelection && <section className="rounded-xl border border-border bg-card">
          <button type="button" onClick={() => setSelectionOpen(open => !open)} className="flex w-full items-center justify-between p-4 text-left font-bold text-textBright">
            <span>{t("matchPrep.selection")} <span className="font-normal text-textMuted">({selectedCount} geselecteerd · {selectedFieldPlayers} + {selectedKeepers} K)</span></span><span className={`text-accent transition ${selectionOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {selectionOpen && <div className="space-y-3 border-t border-borderSubtle p-4">
            <p className="rounded-lg border border-borderSubtle bg-cardDeep p-3 text-sm text-textMuted">De volledige selectie staat compact in één venster. Je kunt ook een speler uit een andere ploeg of een losse naam toevoegen.</p>
            {(drafts.length > 0 || validGuestPlayers.length > 0) && minimumPlayers !== "" && selectedCount < Number(minimumPlayers) && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Voor {matchFormat || "deze spelvorm"} zijn minstens {minimumPlayers} spelers nodig. Momenteel zijn {selectedCount} spelers geselecteerd.</p>}
            {duplicateJerseyNumbers.length > 0 && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Dubbel rugnummer bij de geselecteerde spelers: {duplicateJerseyNumbers.join(", ")}.</p>}
            {canSelect && extraPlayers.some(player => !players.some(current => current.id === player.id)) && <div>
              <h3 className="text-sm font-bold text-textBright">Extra speler uit spelerslijst</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <select value={extraPlayerId} onChange={event => setExtraPlayerId(event.target.value)} className={`${inputClass} min-w-60 flex-1`}>
                  <option value="">Kies een speler…</option>
                  {extraPlayers.filter(player => !players.some(current => current.id === player.id)).map(player =>
                    <option key={player.id} value={player.id}>{player.first_name} {player.last_name}{player.team_name ? ` · ${player.team_name}` : ""}</option>)}
                </select>
                <button type="button" disabled={!extraPlayerId} onClick={addExtraPlayer} className="rounded-lg border border-accent px-3 py-2 text-sm font-bold text-accent disabled:opacity-40">Toevoegen</button>
              </div>
            </div>}
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-textBright">Speler op naam</h3>
                <button type="button" onClick={() => setGuestPlayers(current => [...current, { firstName: "", lastName: "", jerseyNumber: "", note: "" }])}
                  className="rounded-lg border border-accent px-3 py-1.5 text-xs font-bold text-accent">Naam toevoegen</button>
              </div>
              <div className="mt-2 space-y-2">{guestPlayers.map((guest, index) => <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_80px_1fr_auto]">
                <input value={guest.firstName} onChange={event => setGuestPlayers(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, firstName: event.target.value } : item))} placeholder="Voornaam" className={inputClass} />
                <input value={guest.lastName} onChange={event => setGuestPlayers(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, lastName: event.target.value } : item))} placeholder="Naam" className={inputClass} />
                <input type="number" min="0" max="99" value={guest.jerseyNumber} onChange={event => setGuestPlayers(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, jerseyNumber: event.target.value } : item))} placeholder="#" className={inputClass} />
                <input value={guest.note} onChange={event => setGuestPlayers(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} placeholder="Notitie" className={inputClass} />
                <button type="button" onClick={() => setGuestPlayers(current => current.filter((_, itemIndex) => itemIndex !== index))} className="px-2 text-red-300">×</button>
              </div>)}</div>
            </div>
            {players.map(player => {
            const draft = drafts.find(item => item.playerId === player.id)!;
            return <div key={player.id} className="grid gap-2 rounded-lg border border-borderSubtle bg-cardDeep p-3 md:grid-cols-[70px_minmax(160px,1fr)_150px_minmax(180px,1fr)] md:items-center">
              <input disabled={!canSelect} type="number" min="0" max="99" value={draft.jerseyNumber} onChange={event => updatePlayer(player.id, { jerseyNumber: event.target.value })} placeholder="#" className={`${inputClass} disabled:opacity-60`} />
              <div><strong className="text-sm text-textBright">{player.first_name} {player.last_name}</strong><div className="mt-1 flex flex-wrap gap-3"><label className="flex items-center gap-1.5 text-xs text-textSecondary"><input disabled={!canSelect} type="radio" name={`selection-${player.id}`} checked={draft.selected} onChange={() => updatePlayer(player.id, { selected: true, reasonId: "" })} className="accent-accent" />{t("matchPrep.selected")}</label><label className="flex items-center gap-1.5 text-xs text-textSecondary"><input disabled={!canSelect} type="radio" name={`selection-${player.id}`} checked={!draft.selected} onChange={() => updatePlayer(player.id, { selected: false })} className="accent-accent" />{t("matchPrep.notSelected")}</label></div></div>
              {!draft.selected ? <select disabled={!canSelect} value={draft.reasonId} onChange={event => updatePlayer(player.id, { reasonId: event.target.value })} className={`${inputClass} disabled:opacity-60`}><option value="">{t("matchPrep.reason")}</option>{byType("non_selection_reason").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <span className="text-xs text-textMuted">{t("matchPrep.available")}</span>}
              <input disabled={!canSelect} value={draft.attentionPoint} onChange={event => updatePlayer(player.id, { attentionPoint: event.target.value })} placeholder={t("matchPrep.individualAttention")} className={`${inputClass} disabled:opacity-60`} />
            </div>;
          })}</div>}
        </section>}
        {canUseTags && loadedMatch?.status !== "finished" && <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-bold text-textBright">Tags en taglink</h2>
          <p className="mt-1 text-xs text-textMuted">Bepaal de tagknoppen voor deze wedstrijd en maak de externe link.</p>
          <div className="mt-3 flex flex-wrap gap-2">{tagNames.map(tag => <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accentDim px-3 py-1.5 text-sm text-accent">{tag}<button type="button" onClick={() => setTagNames(current => current.filter(item => item !== tag))}>×</button></span>)}</div>
          <div className="mt-3 flex gap-2"><input value={newTag} onChange={event => setNewTag(event.target.value)} placeholder="Nieuwe tag" className={inputClass} /><button type="button" onClick={() => { const tag = newTag.trim(); if (tag && !tagNames.includes(tag)) setTagNames(current => [...current, tag]); setNewTag(""); }} className="rounded-lg border border-accent px-4 py-2 font-bold text-accent">Toevoegen</button></div>
          <button type="button" onClick={async () => { const response = await fetch(`/api/matches/${match.id}/tag-link`, { method: "POST" }); const body = await response.json(); if (!response.ok || !body.token) return setNotice(body.error || "Taglink kon niet worden gemaakt."); await navigator.clipboard.writeText(`${window.location.origin}/tag/${body.token}`); setNotice("Taglink gekopieerd."); }} className="mt-3 rounded-lg bg-accent px-4 py-2 font-bold text-page">Taglink genereren en kopiëren</button>
        </section>}
        {notice && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{notice}</p>}
        <div className="flex flex-wrap justify-end gap-2">{!embedded && <button type="button" onClick={onClose} className="rounded-lg border border-borderButton px-4 py-2 text-textPrimary">{t("common.cancel")}</button>}{canSelect && <button type="button" disabled={busy} onClick={() => void prepareSelectionSend()} className="rounded-lg border border-accent px-4 py-2 font-bold text-accent disabled:opacity-50">{communication?.latest ? "Huidige selectie opnieuw verwittigen" : "Verwittig huidige selectie"}</button>}{(canPlan || canSelect || canUseTags) && <button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50">{t("common.save")}</button>}</div>
      </div>}
    </div>
    {sendOpen && communication && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-3"><section role="dialog" aria-modal="true" aria-label="Selectie versturen" className="w-full max-w-xl rounded-2xl border border-border bg-cardAlt p-5 shadow-2xl">
      <h2 className="text-xl font-bold text-textBright">Selectie versturen</h2>
      <p className="mt-1 text-sm text-textMuted">Controleer welke spelers en contactpersonen een persoonlijk bericht ontvangen.</p>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-borderSubtle bg-cardDeep p-3">
          <p className="font-semibold text-textPrimary">Geselecteerde spelers en contactpersonen</p>
          <p className="text-xs text-textMuted">{communication.selectedRecipients} e-mailontvangers{communication.selectedPlayersWithoutEmail ? ` · ${communication.selectedPlayersWithoutEmail} speler(s) zonder bereikbaar e-mailadres` : ""}</p>
          <label className="mt-2 flex items-center gap-2 text-sm text-textSecondary"><input type="checkbox" checked={includeSelectedAttention} onChange={event => setIncludeSelectedAttention(event.target.checked)} className="accent-accent" />Individuele aandachtspunten meesturen</label>
        </div>
        <div className="rounded-lg border border-borderSubtle bg-cardDeep p-3">
          <label className="flex items-center gap-2 font-semibold text-textPrimary"><input type="checkbox" checked={notifyNotSelected} onChange={event => setNotifyNotSelected(event.target.checked)} className="accent-accent" />Niet-geselecteerde spelers en hun contactpersonen verwittigen</label>
          <p className="mt-1 text-xs text-textMuted">{communication.notSelectedRecipients} mogelijke e-mailontvangers</p>
          <label className={`mt-2 flex items-center gap-2 text-sm ${notifyNotSelected ? "text-textSecondary" : "text-textMuted"}`}><input type="checkbox" disabled={!notifyNotSelected} checked={includeNotSelectedAttention} onChange={event => setIncludeNotSelectedAttention(event.target.checked)} className="accent-accent" />Hun individuele aandachtspunten meesturen</label>
          {notifyNotSelected && <div className="mt-3 border-t border-borderSubtle pt-3"><p className="text-xs font-bold text-textSecondary">Of beperk dit tot individuele niet-geselecteerde spelers:</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{drafts.filter(item => !item.selected).map(item => { const player = players.find(candidate => candidate.id === item.playerId); return player ? <label key={item.playerId} className="flex items-center gap-2 text-xs text-textSecondary"><input type="checkbox" checked={individualNotSelectedIds.includes(item.playerId)} onChange={event => setIndividualNotSelectedIds(current => event.target.checked ? [...current, item.playerId] : current.filter(id => id !== item.playerId))} className="accent-accent" />{player.first_name} {player.last_name}</label> : null; })}</div><p className="mt-2 text-[11px] text-textMuted">Niets aangevinkt = alle niet-geselecteerde spelers verwittigen.</p></div>}
        </div>
      </div>
      {!!communication.history.length && <details className="mt-4 rounded-lg border border-borderSubtle bg-cardDeep p-3"><summary className="cursor-pointer text-sm font-semibold text-textPrimary">Verzendhistoriek</summary><div className="mt-2 space-y-2">{communication.history.map(item => <div key={item.id} className="flex items-center justify-between gap-3 text-xs text-textMuted"><span>{new Date(item.completed_at ?? item.created_at).toLocaleString("nl-BE")} · {item.profiles?.full_name || "staff"}</span><span>{item.sent_recipient_count}/{item.intended_recipient_count} verstuurd · {item.status}</span></div>)}</div></details>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={sending} onClick={() => setSendOpen(false)} className="rounded-lg border border-borderButton px-4 py-2 text-textPrimary">Annuleren</button><button type="button" disabled={sending || communication.selectedRecipients + (notifyNotSelected ? communication.notSelectedRecipients : 0) === 0} onClick={() => void sendSelection()} className="rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50">{sending ? "Versturen…" : "Selectie versturen"}</button></div>
    </section></div>}
  </div>;
}
