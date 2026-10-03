"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { changeClubNameMatch, confirmClubNameMatch } from "./actions";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type UnresolvedRow = { name: string; count: number; variants: string[] };
type Club = { id: string; stamnummer: number; naam: string };
type ExistingMapping = { name: string; belgianClubId: string; matchCount: number };

function ClubPicker({
  clubs,
  disabled,
  value,
  onChange,
}: {
  clubs: Club[];
  disabled?: boolean;
  value: string;
  onChange: (clubId: string) => void;
}) {
  const listId = useId();
  const selectedClub = clubs.find((club) => club.id === value);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("nl-BE");
  const matches = normalizedQuery
    ? clubs.filter((club) =>
        club.naam.toLocaleLowerCase("nl-BE").includes(normalizedQuery)
        || String(club.stamnummer).includes(normalizedQuery)
      )
    : clubs;

  return (
    <div className="relative w-full max-w-xs">
      <input
        type="search"
        list={listId}
        disabled={disabled}
        value={selectedClub ? `${selectedClub.naam} (${selectedClub.stamnummer})` : query}
        onChange={(event) => {
          const nextQuery = event.target.value;
          const exactClub = clubs.find((club) =>
            `${club.naam} (${club.stamnummer})`.toLocaleLowerCase("nl-BE") === nextQuery.toLocaleLowerCase("nl-BE")
          );
          setQuery(nextQuery);
          onChange(exactClub?.id ?? "");
        }}
        onBlur={() => {
          if (selectedClub) return;
          const exactClub = clubs.find((club) => String(club.stamnummer) === query.trim());
          if (exactClub) onChange(exactClub.id);
        }}
        onFocus={(event) => event.currentTarget.select()}
        placeholder="Zoek op clubnaam of stamnummer…"
        aria-label="Zoek club op naam of stamnummer"
        className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-textPrimary"
      />
      <datalist id={listId}>
        {matches.map((club) => (
          <option key={club.id} value={`${club.naam} (${club.stamnummer})`} />
        ))}
      </datalist>
    </div>
  );
}

export function ClubNameMatchReview({ rows, clubs, existingMappings, readOnly }: { rows: UnresolvedRow[]; clubs: Club[]; existingMappings: ExistingMapping[]; readOnly?: boolean }) {
  const askConfirm = useConfirm();
  const router = useRouter();
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [busyName, setBusyName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mappingSearch, setMappingSearch] = useState("");

  async function confirm(name: string) {
    const belgianClubId = selection[name];
    if (!belgianClubId) return setError("Kies eerst een club om te koppelen.");
    setError("");
    setBusyName(name);
    try {
      await confirmClubNameMatch(name, belgianClubId);
      window.dispatchEvent(new Event("dashboard-badges:refresh"));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Koppeling kon niet worden bewaard.");
    } finally {
      setBusyName(null);
    }
  }

  async function changeMapping(name: string, belgianClubId: string | null) {
    if (!belgianClubId && !(await askConfirm({ message: `Koppeling voor “${name}” verwijderen? De betrokken wedstrijden krijgen tijdelijk geen clublogo.` }))) return;
    setError(""); setBusyName(name);
    try {
      const result = await changeClubNameMatch(name, belgianClubId);
      window.dispatchEvent(new Event("dashboard-badges:refresh"));
      router.refresh();
      if (result.updated) window.alert(`${result.updated} wedstrijd(en) zijn bijgewerkt.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Koppeling kon niet worden gewijzigd.");
    } finally { setBusyName(null); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-textMuted">{rows.length} niet-gekoppelde naam/namen.</p>
      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-cardDeep text-xs uppercase text-textMuted">
            <tr>
              <th className="px-4 py-3 text-left">Naam op wedstrijden</th>
              <th className="px-4 py-3 text-right">Aantal</th>
              <th className="px-4 py-3 text-left">Koppel aan</th>
              {!readOnly && <th className="px-4 py-3 text-right">Actie</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t border-borderSubtle">
                <td className="px-4 py-2 text-textPrimary">
                  {row.name}
                  {row.variants.length > 1 && (
                    <div className="mt-0.5 text-xs text-textMuted">ook: {row.variants.slice(1).join(", ")}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-textSecondary">{row.count}</td>
                <td className="px-4 py-2">
                  <ClubPicker
                    clubs={clubs}
                    disabled={readOnly}
                    value={selection[row.name] ?? ""}
                    onChange={(clubId) => setSelection((prev) => ({ ...prev, [row.name]: clubId }))}
                  />
                </td>
                {!readOnly && (
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={busyName === row.name || !selection[row.name]}
                      onClick={() => void confirm(row.name)}
                      className="rounded-lg border border-borderButton px-3 py-1.5 text-xs font-semibold text-textPrimary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyName === row.name ? "Bezig…" : "Bevestigen"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={readOnly ? 3 : 4} className="px-4 py-6 text-center text-textMuted">
                  Geen niet-gekoppelde namen. Alles wat matcht is al gekoppeld.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-textPrimary">Bestaande koppelingen</h2><p className="text-sm text-textMuted">Wijzig een foutieve club of maak de koppeling los om ze opnieuw te beoordelen.</p></div>
          <input type="search" value={mappingSearch} onChange={event => setMappingSearch(event.target.value)} placeholder="Zoek naam of stamnummer…" className="w-full max-w-xs rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary" />
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm"><thead className="bg-cardDeep text-xs uppercase text-textMuted"><tr><th className="px-4 py-3 text-left">Naam op wedstrijden</th><th className="px-4 py-3 text-right">Wedstrijden</th><th className="px-4 py-3 text-left">Gekoppelde club</th>{!readOnly && <th className="px-4 py-3 text-right">Actie</th>}</tr></thead>
            <tbody>{existingMappings.filter(mapping => {
              const club = clubs.find(item => item.id === mapping.belgianClubId);
              const needle = mappingSearch.trim().toLocaleLowerCase("nl-BE");
              return !needle || mapping.name.toLocaleLowerCase("nl-BE").includes(needle) || club?.naam.toLocaleLowerCase("nl-BE").includes(needle) || String(club?.stamnummer ?? "").includes(needle);
            }).map(mapping => <tr key={mapping.name} className="border-t border-borderSubtle">
              <td className="px-4 py-2 text-textPrimary">{mapping.name}</td><td className="px-4 py-2 text-right text-textSecondary">{mapping.matchCount}</td>
              <td className="px-4 py-2"><ClubPicker clubs={clubs} disabled={readOnly || busyName === mapping.name} value={mapping.belgianClubId} onChange={clubId => { if (clubId && clubId !== mapping.belgianClubId) void changeMapping(mapping.name, clubId); }} /></td>
              {!readOnly && <td className="px-4 py-2 text-right"><button type="button" disabled={busyName === mapping.name} onClick={() => void changeMapping(mapping.name, null)} className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-50">{busyName === mapping.name ? "Bezig…" : "Loskoppelen"}</button></td>}
            </tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
