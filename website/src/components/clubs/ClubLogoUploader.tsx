"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function ClubLogoUploader({ clubId, clubName, logoUrl, readOnly = false, compact = false, onChanged }: {
  clubId: string; clubName: string; logoUrl: string | null; readOnly?: boolean;
  compact?: boolean;
  onChanged?: (logoUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentLogo, setCurrentLogo] = useState(logoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentLogo(logoUrl);
    setError("");
  }, [clubId, logoUrl]);

  async function saveLogo(nextLogo: string | null) {
    const response = await fetch("/api/club/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId, logoUrl: nextLogo })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Clublogo kon niet worden bewaard.");
    setCurrentLogo(nextLogo);
    onChanged?.(nextLogo);
  }

  async function upload(file: File) {
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Kies een PNG-, JPEG- of WebP-afbeelding.");
    if (file.size > 5 * 1024 * 1024) return setError("Het clublogo mag maximaal 5 MB groot zijn.");
    setBusy(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const key = `clubs/${clubId}/logo-${crypto.randomUUID()}.${extension}`;
      const prepare = await fetch("/api/videos/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, contentType: file.type })
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Upload kon niet worden voorbereid.");
      const put = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(`Upload mislukt (HTTP ${put.status}).`);
      await saveLogo(prepared.publicUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Clublogo kon niet worden geüpload.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (compact) return <div>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} />
    <button type="button" disabled={readOnly || busy} onClick={() => inputRef.current?.click()}
      title={readOnly ? clubName : "Verander het logo"}
      className="group/logo relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-1 disabled:cursor-default">
      {currentLogo ? <Image src={currentLogo} alt={`Logo ${clubName}`} width={64} height={64} className="h-full w-full object-contain" unoptimized /> : <span className="text-center text-[10px] font-bold uppercase text-[#7a857f]">Geen logo</span>}
      {!readOnly && <span className="absolute inset-x-0 bottom-0 translate-y-full bg-black/80 px-1 py-1 text-[9px] font-semibold text-white transition-transform group-hover/logo:translate-y-0">Verander het logo</span>}
    </button>
    {error && <p className="mt-1 max-w-40 text-xs text-red-300">{error}</p>}
  </div>;

  return <div className="flex flex-wrap items-center gap-3">
    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1">
      {currentLogo ? <Image src={currentLogo} alt={`Logo ${clubName}`} width={64} height={64} className="h-full w-full object-contain" unoptimized /> : <span className="text-center text-[10px] font-bold uppercase text-[#7a857f]">Geen logo</span>}
    </div>
    <div>
      {!readOnly && <div className="flex flex-wrap gap-2">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => event.target.files?.[0] && void upload(event.target.files[0])} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary disabled:opacity-50">{busy ? "Uploaden…" : currentLogo ? "Logo vervangen" : "Logo uploaden"}</button>
        {currentLogo && <button type="button" disabled={busy} onClick={() => void saveLogo(null).catch(reason => setError(reason.message))} className="rounded-lg px-3 py-2 text-sm text-red-300">Verwijderen</button>}
      </div>}
      <p className="mt-1 text-xs text-textMuted">PNG, JPEG of WebP · maximaal 5 MB</p>
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  </div>;
}
