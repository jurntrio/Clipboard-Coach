"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/client";

export function ActiveDrawingOverlay({ drawing, alt }: { drawing: { url: string } | null; alt?: string }) {
  const { t } = useI18n();
  if (!drawing) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 bg-black">
      <Image src={drawing.url} alt={alt ?? t("video.savedDrawing")} fill unoptimized className="object-contain" />
    </div>
  );
}
