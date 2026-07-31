"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { setClubModuleEntitlement } from "./actions";
import { CLUB_MODULES, type ClubModuleKey } from "@/lib/club-modules";
import { ClubInvitationCreator } from "../club/ClubInvitationCreator";

type PendingChange = {
  key: ClubModuleKey;
  label: string;
  enabled: boolean;
};

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
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [enabledByKey, setEnabledByKey] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CLUB_MODULES.map((item) => [
      item.key, entitlements.find((entitlement) => entitlement.module_key === item.key)?.enabled !== false
    ]))
  );

  function confirmChange() {
    if (!pendingChange) return;
    const change = pendingChange;
    setError("");
    startTransition(async () => {
      try {
        await setClubModuleEntitlement(clubId, change.key, change.enabled);
        setEnabledByKey((current) => ({
          ...current,
          [change.key]: change.enabled,
        }));
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
      <div className="space-y-2">
        {CLUB_MODULES.filter((module) => ["matches", "video_viewer", "teams", "clips", "training", "intradesk", "media"].includes(module.key)).map((module) => {
          return <div key={module.key} className="rounded-lg border border-border bg-card">
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm text-textPrimary">
              <input type="checkbox" checked={enabledByKey[module.key]} disabled={busy}
                onChange={(event) => setPendingChange({ key: module.key, label: module.label, enabled: event.target.checked })}
                className="h-4 w-4 accent-accent disabled:opacity-50" />
              <span className="font-semibold">{module.label}</span>
            </label>
          </div>;
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <div className="mt-3"><ClubInvitationCreator clubId={clubId} readOnly={false} compact /></div>
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
