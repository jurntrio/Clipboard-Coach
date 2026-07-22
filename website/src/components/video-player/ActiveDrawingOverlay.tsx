"use client";

import type { TagDrawing } from "@/types/database";

export function ActiveDrawingOverlay({ drawing }: { drawing: TagDrawing | null }) {
  if (!drawing) return null;
  return <img src={drawing.url} alt="Saved coaching drawing" className="pointer-events-none absolute inset-0 z-20 h-full w-full bg-black object-contain" />;
}
