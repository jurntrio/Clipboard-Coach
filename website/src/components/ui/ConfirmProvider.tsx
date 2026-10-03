"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useI18n } from "@/i18n/client";
import { ConfirmDialog } from "./ConfirmDialog";

type ConfirmOptions = { message: string; title?: string; confirmLabel?: string; destructive?: boolean };
type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

// Outside the provider this falls back to the browser dialog, so callers never break.
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(
  async ({ message }) => window.confirm(message)
);

// Promise-based replacement for window.confirm() that shows the SVS-styled
// ConfirmDialog: `if (!(await askConfirm({ message }))) return;`
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const askConfirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);
  function close(confirmed: boolean) {
    pending?.resolve(confirmed);
    setPending(null);
  }
  return (
    <ConfirmContext.Provider value={askConfirm}>
      {children}
      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? t("confirm.title")}
        message={pending?.message ?? ""}
        confirmLabel={pending?.confirmLabel ?? t("confirm.ok")}
        destructive={pending?.destructive ?? true}
        onCancel={() => close(false)}
        onConfirm={() => close(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
