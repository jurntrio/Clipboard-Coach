"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Match, Player } from "@/types/database";

type Option = { id: string; option_type: "field" | "locker_room" | "meeting_place" | "non_selection_reason"; label: string };
type Selection = { player_id: string; selected: boolean; jersey_number: number | null; non_selection_reason_id: string | null; note: string | null };
type PlayerDraft = { playerId: string; selected: boolean; jerseyNumber: string; reasonId: string; note: string };
type ExtraPlayer = Player & { team_name?: string };
type GuestDraft = { firstName: string; lastName: string; jerseyNumber: string; note: string };

const inputClass = "w-full rounded-lg border border-border bg-input px-3 py-2 text-textPrimary";

export function MatchPreparationDialog({ match, onClose, onSaved }: { match: Match; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [loadedMatch, setLoadedMatch] = useState<Match | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [extraPlayers, setExtraPlayers] = useState<ExtraPlayer[]>([]);
  const [extraPlayerId, setExtraPlayerId] = useState("");
  const [guestPlayers, setGuestPlayers] = useState<GuestDraft[]>([]);
  const [drafts, setDrafts] = useState<PlayerDraft[]>([]);
  const [generalOpen, setGeneralOpen] = useState(true);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [meetingTimeEnabled, setMeetingTimeEnabled] = useState(false);
  const [isHomeMatch, setIsHomeMatch] = useState(true);
  const [meetingTime, setMeetingTime] = useState("");
  const [departureTimeEnabled, setDepartureTimeEnabled] = useState(false);
  const [departureTime, setDepartureTime] = useState("");
  const [fieldOptionId, setFieldOptionId] = useState("");
  const [lockerRoomOptionId, setLockerRoomOptionId] = useState("");
  const [meetingPlaceOptionId, setMeetingPlaceOptionId] = useState("");
  const [meetingPlaceCustom, setMeetingPlaceCustom] = useState("");
  const [meetingPlaceEnabled, setMeetingPlaceEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetch(`/api/matches/${match.id}/preparation`, { cache: "no-store" }).then(async response => {
      const body = await response.json();
      if (!response.ok) { setNotice(body.error || t("matchPrep.loadFailed")); setBusy(false); return; }
      const current = body.match as Match & Record<string, any>;
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
          note: saved?.note ?? ""
        };
      }));
      setMeetingTimeEnabled(current.meeting_time_enabled === true || !current.meeting_time);
      setIsHomeMatch(current.is_home_match !== false);
      setMeetingTime(current.meeting_time?.slice(0, 5) ?? "");
      setDepartureTimeEnabled(current.departure_time_enabled === true);
      setDepartureTime(current.departure_time?.slice(0, 5) ?? "");
      setFieldOptionId(current.field_option_id ?? "");
      setLockerRoomOptionId(current.locker_room_option_id ?? "");
      setMeetingPlaceOptionId(current.meeting_place_option_id ?? defaultMeetingPlace?.id ?? "");
      setMeetingPlaceCustom(current.meeting_place_custom ?? "");
      setMeetingPlaceEnabled(!!current.meeting_place_option_id || !!current.meeting_place_custom || !!defaultMeetingPlace);
      setBusy(false);
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
      playerId: player.id, selected: true, jerseyNumber: player.jersey_number?.toString() ?? "", reasonId: "", note: ""
    }]);
    setExtraPlayerId("");
  }

  async function save() {
    setBusy(true); setNotice("");
    const response = await fetch(`/api/matches/${match.id}/preparation`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isHomeMatch, meetingTimeEnabled, meetingTime,
        departureTimeEnabled: !isHomeMatch && departureTimeEnabled,
        departureTime: !isHomeMatch ? departureTime : "",
        fieldOptionId, lockerRoomOptionId, meetingPlaceEnabled, meetingPlaceOptionId, meetingPlaceCustom,
        players: drafts.map(item => ({
          playerId: item.playerId, selected: item.selected,
          jerseyNumber: item.jerseyNumber === "" ? null : Number(item.jerseyNumber),
          reasonId: item.reasonId, note: item.note
        })),
        guestPlayers: guestPlayers.map(item => ({
          firstName: item.firstName, lastName: item.lastName,
          jerseyNumber: item.jerseyNumber === "" ? null : Number(item.jerseyNumber), note: item.note
        }))
      })
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setNotice(body.error || t("matchPrep.saveFailed")); return; }
    await onSaved();
    onClose();
  }

  const placeIsOther = meetingPlaceOptionId === "custom";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-3" role="dialog" aria-modal="true">
    <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-cardAlt shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-cardAlt p-4">
        <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-bold text-textBright">{t("matchPrep.title")}</h2><p className="truncate text-sm text-textMuted">{match.team_a_name} – {match.team_b_name}</p></div>
        <button type="button" onClick={onClose} className="rounded-lg border border-borderButton px-3 py-2 text-textPrimary">{t("common.close")}</button>
      </header>
      {busy && !loadedMatch ? <p className="p-6 text-textMuted">{t("common.loading")}</p> : <div className="space-y-3 p-4">
        <section className="rounded-xl border border-border bg-card">
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
            {isHomeMatch && <label className="text-sm text-textSecondary">{t("matchPrep.field")}<select value={fieldOptionId} onChange={event => setFieldOptionId(event.target.value)} className={`mt-1 ${inputClass}`}><option value="">—</option>{byType("field").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
            {isHomeMatch && <label className="text-sm text-textSecondary">{t("matchPrep.lockerRoom")}<select value={lockerRoomOptionId} onChange={event => setLockerRoomOptionId(event.target.value)} className={`mt-1 ${inputClass}`}><option value="">—</option>{byType("locker_room").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={meetingPlaceEnabled} onChange={event => setMeetingPlaceEnabled(event.target.checked)} className="accent-accent" />{t("matchPrep.meetingPlace")}</label>
              {meetingPlaceEnabled && <><select value={meetingPlaceOptionId} onChange={event => setMeetingPlaceOptionId(event.target.value)} className={inputClass}><option value="">—</option>{byType("meeting_place").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}<option value="custom">{t("matchPrep.other")}</option></select>{placeIsOther && <input value={meetingPlaceCustom} onChange={event => setMeetingPlaceCustom(event.target.value)} placeholder={t("matchPrep.enterPlace")} className={`mt-2 ${inputClass}`} />}</>}
            </div>
            {!isHomeMatch && <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-textPrimary"><input type="checkbox" checked={departureTimeEnabled} onChange={event => setDepartureTimeEnabled(event.target.checked)} className="accent-accent" />{t("matchPrep.departureTime")}</label>
              {departureTimeEnabled && <input type="time" value={departureTime} onChange={event => setDepartureTime(event.target.value)} className={inputClass} />}
            </div>}
          </div>}
        </section>
        <section className="rounded-xl border border-border bg-card">
          <button type="button" onClick={() => setSelectionOpen(open => !open)} className="flex w-full items-center justify-between p-4 text-left font-bold text-textBright">
            <span>{t("matchPrep.selection")} <span className="font-normal text-textMuted">({drafts.filter(item => item.selected).length}/{drafts.length})</span></span><span className={`text-accent transition ${selectionOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {selectionOpen && <div className="space-y-3 border-t border-borderSubtle p-4">
            <div className="rounded-lg border border-borderSubtle bg-cardDeep p-3">
              <h3 className="text-sm font-bold text-textBright">Extra speler uit spelerslijst</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <select value={extraPlayerId} onChange={event => setExtraPlayerId(event.target.value)} className={`${inputClass} min-w-60 flex-1`}>
                  <option value="">Kies een speler…</option>
                  {extraPlayers.filter(player => !players.some(current => current.id === player.id)).map(player =>
                    <option key={player.id} value={player.id}>{player.first_name} {player.last_name}{player.team_name ? ` · ${player.team_name}` : ""}</option>)}
                </select>
                <button type="button" disabled={!extraPlayerId} onClick={addExtraPlayer} className="rounded-lg border border-accent px-3 py-2 text-sm font-bold text-accent disabled:opacity-40">Toevoegen</button>
              </div>
            </div>
            <div className="rounded-lg border border-borderSubtle bg-cardDeep p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-textBright">Testspeler</h3>
                <button type="button" onClick={() => setGuestPlayers(current => [...current, { firstName: "", lastName: "", jerseyNumber: "", note: "" }])}
                  className="rounded-lg border border-accent px-3 py-1.5 text-xs font-bold text-accent">Testspeler toevoegen</button>
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
              <input type="number" min="0" max="99" value={draft.jerseyNumber} onChange={event => updatePlayer(player.id, { jerseyNumber: event.target.value })} placeholder="#" className={inputClass} />
              <div><strong className="text-sm text-textBright">{player.first_name} {player.last_name}</strong><div className="mt-1 flex flex-wrap gap-3"><label className="flex items-center gap-1.5 text-xs text-textSecondary"><input type="radio" name={`selection-${player.id}`} checked={draft.selected} onChange={() => updatePlayer(player.id, { selected: true, reasonId: "" })} className="accent-accent" />{t("matchPrep.selected")}</label><label className="flex items-center gap-1.5 text-xs text-textSecondary"><input type="radio" name={`selection-${player.id}`} checked={!draft.selected} onChange={() => updatePlayer(player.id, { selected: false })} className="accent-accent" />{t("matchPrep.notSelected")}</label></div></div>
              {!draft.selected ? <select value={draft.reasonId} onChange={event => updatePlayer(player.id, { reasonId: event.target.value })} className={inputClass}><option value="">{t("matchPrep.reason")}</option>{byType("non_selection_reason").map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <span className="text-xs text-textMuted">{t("matchPrep.available")}</span>}
              <input value={draft.note} onChange={event => updatePlayer(player.id, { note: event.target.value })} placeholder={t("matchPrep.note")} className={inputClass} />
            </div>;
          })}</div>}
        </section>
        {notice && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{notice}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-borderButton px-4 py-2 text-textPrimary">{t("common.cancel")}</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-accent px-4 py-2 font-bold text-page disabled:opacity-50">{t("common.save")}</button></div>
      </div>}
    </div>
  </div>;
}
