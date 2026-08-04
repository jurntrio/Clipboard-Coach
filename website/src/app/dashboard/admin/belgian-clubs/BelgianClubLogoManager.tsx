"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeBelgianClubLargeLogo, setBelgianClubLargeLogo } from "./actions";

type Row = { stamnummer: number; naam: string; smallLogoUrl: string | null; largeLogoUrl: string | null };

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 10 * 1024 * 1024;

export function BelgianClubLogoManager({ rows, readOnly }: { rows: Row[]; readOnly?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlyMissingLarge, setOnlyMissingLarge] = useState(false);
  const [busyStamnummer, setBusyStamnummer] = useState<number | null>(null);
  const [error, setError] = useState("");
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    return rows.filter((row) => {
      if (onlyMissingLarge && row.largeLogoUrl) return false;
      if (!needle) return true;
      return row.naam.toLocaleLowerCase("nl-BE").includes(needle) || String(row.stamnummer).includes(needle);
    });
  }, [rows, query, onlyMissingLarge]);

  const missingLargeCount = rows.filter((row) => !row.largeLogoUrl).length;

  async function upload(stamnummer: number, file: File) {
    setError("");
    if (!ACCEPTED_TYPES.includes(file.type)) return setError("Kies een PNG-, JPEG-, WebP- of SVG-afbeelding.");
    if (file.size > MAX_BYTES) return setError("Het large logo mag maximaal 10 MB groot zijn.");
    setBusyStamnummer(stamnummer);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const key = `belgian-clubs/large/${stamnummer}.${extension}`;
      const prepare = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, contentType: file.type })
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Upload kon niet worden voorbereid.");
      const put = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(`Upload mislukt (HTTP ${put.status}).`);
      await setBelgianClubLargeLogo(stamnummer, key);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Large logo kon niet worden geüpload.");
    } finally {
      setBusyStamnummer(null);
      const input = inputRefs.current[stamnummer];
      if (input) input.value = "";
    }
  }

  async function remove(stamnummer: number) {
    setError("");
    setBusyStamnummer(stamnummer);
    try {
      await removeBelgianClubLargeLogo(stamnummer);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Large logo kon niet worden verwijderd.");
    } finally {
      setBusyStamnummer(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Zoek op naam of stamnummer…"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-textPrimary"
        />
        <label className="flex items-center gap-2 text-sm text-textSecondary">
          <input type="checkbox" checked={onlyMissingLarge} onChange={(event) => setOnlyMissingLarge(event.target.checked)} />
          Toon enkel clubs zonder large logo ({missingLargeCount})
        </label>
        <span className="text-xs text-textMuted">{filtered.length} van {rows.length} clubs</span>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-cardDeep text-xs uppercase text-textMuted">
            <tr>
              <th className="px-4 py-3 text-left">Stamnummer</th>
              <th className="px-4 py-3 text-left">Naam</th>
              <th className="px-4 py-3 text-center">Small</th>
              <th className="px-4 py-3 text-center">Large</th>
              {!readOnly && <th className="px-4 py-3 text-right">Actie</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.stamnummer} className="border-t border-borderSubtle">
                <td className="px-4 py-2 text-textSecondary">{row.stamnummer}</td>
                <td className="px-4 py-2 text-textPrimary">{row.naam}</td>
                <td className="px-4 py-2 text-center">
                  <LogoCell url={row.smallLogoUrl} />
                </td>
                <td className="px-4 py-2 text-center">
                  <LogoCell url={row.largeLogoUrl} />
                </td>
                {!readOnly && (
                  <td className="px-4 py-2 text-right">
                    <input
                      ref={(element) => { inputRefs.current[row.stamnummer] = element; }}
                      type="file"
                      accept={ACCEPTED_TYPES.join(",")}
                      className="hidden"
                      onChange={(event) => event.target.files?.[0] && void upload(row.stamnummer, event.target.files[0])}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyStamnummer === row.stamnummer}
                        onClick={() => inputRefs.current[row.stamnummer]?.click()}
                        className="rounded-lg border border-borderButton px-3 py-1.5 text-xs font-semibold text-textPrimary disabled:opacity-50"
                      >
                        {busyStamnummer === row.stamnummer ? "Bezig…" : row.largeLogoUrl ? "Vervangen" : "Uploaden"}
                      </button>
                      {row.largeLogoUrl && (
                        <button
                          type="button"
                          disabled={busyStamnummer === row.stamnummer}
                          onClick={() => void remove(row.stamnummer)}
                          className="rounded-lg px-3 py-1.5 text-xs text-red-300 disabled:opacity-50"
                        >
                          Verwijderen
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={readOnly ? 4 : 5} className="px-4 py-6 text-center text-textMuted">Geen clubs gevonden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogoCell({ url }: { url: string | null }) {
  if (!url) return <span className="text-red-300">✗</span>;
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-accent">✓</span>
      <Image src={url} alt="" width={28} height={28} unoptimized className="h-7 w-7 object-contain" />
    </div>
  );
}
