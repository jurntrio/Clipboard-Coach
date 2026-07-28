"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setClubModuleBundle } from "./actions";
import { CLUB_MODULE_BUNDLES, type ClubModuleBundleKey } from "@/lib/club-modules";

export function AdminClubModuleToggles({
  clubId,
  clubName,
  entitlements
}: {
  clubId: string;
  clubName: string;
  entitlements: { module_key: string; enabled: boolean }[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [pendingChange, setPendingChange] = useState<{ key: ClubModuleBundleKey; label: string; enabled: boolean } | null>(null);
  const [enabledByBundle, setEnabledByBundle] = useState<Record<ClubModuleBundleKey, boolean>>(() =>
    Object.fromEntries(CLUB_MODULE_BUNDLES.map((bundle) => [
      bundle.key,
      bundle.modules.every((moduleKey) => entitlements.find((item) => item.module_key === moduleKey)?.enabled !== false)
    ])) as Record<ClubModuleBundleKey, boolean>
  );

  function confirmChange() {
    if (!pendingChange) return;
    const change = pendingChange;
    setError("");
    startTransition(async () => {
      try {
        await setClubModuleBundle(clubId, change.key, change.enabled);
        setEnabledByBundle((current) => ({ ...current, [change.key]: change.enabled }));
        setPendingChange(null);
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "De module kon niet worden aangepast.");
        setPendingChange(null);
      }
    });
  }

  return <>
    <div className="border-t border-borderSubtle px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {CLUB_MODULE_BUNDLES.map((bundle) => <label key={bundle.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-textPrimary">
          <input
            type="checkbox"
            checked={enabledByBundle[bundle.key]}
            disabled={busy}
            onChange={(event) => setPendingChange({ key: bundle.key, label: bundle.label, enabled: event.target.checked })}
            className="h-4 w-4 accent-accent disabled:opacity-50"
          />
          <span className="font-semibold">{bundle.label}</span>
        </label>)}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
    <ConfirmDialog
      open={!!pendingChange}
      title={`${pendingChange?.label ?? "Module"} ${pendingChange?.enabled ? "inschakelen" : "uitschakelen"}?`}
      message={`${pendingChange?.label ?? "Deze module"} voor ${clubName} ${pendingChange?.enabled ? "inschakelen" : "uitschakelen"}? Dit wijzigt welke functies de clubleden kunnen zien en gebruiken.`}
      confirmLabel={pendingChange?.enabled ? "Inschakelen" : "Uitschakelen"}
      busy={busy}
      onCancel={() => setPendingChange(null)}
      onConfirm={confirmChange}
    />
  </>;
}
