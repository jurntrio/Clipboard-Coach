"use client";

import Image from "next/image";
import { useState } from "react";
import { colors, path, playerFamilies } from "@/components/training/constants";
import type { PaletteAsset } from "@/components/training/types";

export function PlayerGroup({ family, onPick, activeAsset }: {
  family: typeof playerFamilies[number]; onPick: (asset: PaletteAsset) => void; activeAsset?: PaletteAsset | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [customNumber, setCustomNumber] = useState("");
  const [addedNumber, setAddedNumber] = useState<number | null>(null);
  const standardNumbers = expanded ? Array.from({ length: 20 }, (_, i) => i + 1) : [1, 2];
  const numbers = addedNumber && !standardNumbers.includes(addedNumber) ? [...standardNumbers, addedNumber] : standardNumbers;
  const previewNumber = /^\d{1,3}$/.test(customNumber) && Number(customNumber) >= 1 ? customNumber : addedNumber ? String(addedNumber) : "?";
  const previewAsset: PaletteAsset = {
    src: path(`${family.file}-groen.png`),
    label: `${family.label} Groen ${previewNumber}`,
    playerNumber: previewNumber,
    playerNumberColor: "white"
  };

  function addCustomNumber() {
    const parsed = Number(customNumber);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 999) return;
    setAddedNumber(parsed);
    setCustomNumber("");
  }

  return (
    <section className="rounded-lg border border-[#dbe2de] bg-white p-2">
      <div className="relative mb-2 flex min-h-[34px] items-center">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-[#243029]">{family.label}</h3>
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          <label className="flex items-center gap-1 whitespace-nowrap text-[9px] font-bold text-[#66706b]">
            Vrij nr.
            <input type="number" min="1" max="999" inputMode="numeric" value={customNumber}
              onChange={event => setCustomNumber(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addCustomNumber(); } }}
              placeholder="21–99"
              aria-label={`Ander nummer voor ${family.label}`}
              className="w-16 rounded border border-[#cbd5cf] px-2 py-1 text-[10px] font-semibold text-[#243029] outline-none focus:border-[#169447]" />
          </label>
          <button type="button" disabled={previewNumber === "?"}
            onClick={() => { addCustomNumber(); if (previewNumber !== "?") onPick(previewAsset); }}
            aria-label={`${family.label} met nummer ${previewNumber} selecteren`}
            title="Live voorbeeld · klik om te selecteren"
            className="h-8 w-8 shrink-0 rounded border border-[#cbd5cf] bg-white p-0.5 hover:border-[#169447] disabled:cursor-not-allowed disabled:opacity-40">
            <span className="relative block h-full w-full">
              <Image src={previewAsset.src} alt="" fill sizes="32px" className="object-contain" />
              <span className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-sans font-black leading-none ${previewNumber.length >= 3 ? "text-[6px]" : previewNumber.length === 2 ? "text-[8px]" : "text-[9px]"} text-white`}>{previewNumber}</span>
            </span>
          </button>
        </div>
        <button type="button" onClick={() => setExpanded(v => !v)} className="ml-auto rounded border border-[#cbd5cf] px-2 py-1 text-[10px] font-bold text-[#36423b]">
          {expanded ? "1–2 ▴" : "3–20 ▾"}
        </button>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {colors.map(color => (
          <div key={color.file} className="col-span-2 grid grid-cols-2 content-start gap-1">
            <span className="col-span-2 truncate text-center text-[7px] font-bold uppercase text-[#7a857f]">{color.label}</span>
            {numbers.map(number => {
              const asset: PaletteAsset = {
                src: path(`${family.file}-${color.slug}.png`),
                label: `${family.label} ${color.label} ${number}`,
                playerNumber: String(number),
                playerNumberColor: color.file === "Wit" ? "black" : "white"
              };
              return <AssetButton key={number} asset={asset} onPick={onPick}
                active={activeAsset?.src === asset.src && activeAsset.playerNumber === asset.playerNumber} player />;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

export function AssetButton({ asset, onPick, active = false, player = false }: {
  asset: PaletteAsset; onPick: (asset: PaletteAsset) => void; active?: boolean; player?: boolean;
}) {
  return (
    <button type="button" title={`${asset.label} · klik of sleep naar het veld`} onClick={() => onPick(asset)} draggable
      onDragStart={event => {
        onPick(asset);
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-cbcs-training-asset", JSON.stringify(asset));
      }}
      className={`${player ? "aspect-square p-0.5" : "h-10 p-1"} group min-w-0 rounded border border-[#dbe2de] border-l-4 ${active ? "border-l-[#169447] bg-[#eef8f1] shadow-sm" : "border-l-transparent bg-white"} hover:border-[#169447] hover:bg-[#eef8f1]`}>
      <span className="relative mx-auto block h-full max-h-[34px] w-full transition-transform group-hover:scale-110">
        <Image src={asset.src} alt="" fill sizes="44px" className="object-contain" />
        {asset.playerNumber !== undefined && <span aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-sans font-black leading-none ${asset.playerNumber.length >= 3 ? "text-[7px]" : asset.playerNumber.length === 2 ? "text-[9px]" : "text-[10px]"} ${asset.playerNumberColor === "black" ? "text-black" : "text-white"}`}>
          {asset.playerNumber}
        </span>}
      </span>
    </button>
  );
}
