"use client";

"use client";

import type { TagDrawing } from "@/types/database";
import { useI18n } from "@/i18n/client";

export function ActiveDrawingOverlay({ drawing }: { drawing: TagDrawing | null }) {
  const { t } = useI18n();
  if (!drawing) return null;
  return <img src={drawing.url} alt={t("video.savedDrawing")} className="pointer-events-none absolute inset-0 z-20 h-full w-full bg-black object-contain" />;
}
