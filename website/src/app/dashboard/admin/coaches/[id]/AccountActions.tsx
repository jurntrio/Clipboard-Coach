"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { banCoach, deleteCoach, setCoachPlan, unbanCoach } from "../../actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useI18n } from "@/i18n/client";

export function AccountActions({
  coachId,
  email,
  banned,
  plan,
  accountRole
}: {
  coachId: string;
  email: string;
  banned: boolean;
  plan: "free" | "pro";
  accountRole: "coach" | "club_admin" | "analyst";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"ban" | "delete" | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  function handlePlanToggle() {
    setError(null);
    const nextPlan = plan === "pro" ? "free" : "pro";

    startTransition(async () => {
      try {
        await setCoachPlan(coachId, nextPlan);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("admin.genericError"));
      }
    });
  }

  function handleBanToggle() {
    setError(null);
    setConfirmAction("ban");
  }

  function confirmBanToggle() {
    const action = banned ? unbanCoach : banCoach;
    startTransition(async () => {
      try {
        await action(coachId);
        setConfirmAction(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("admin.genericError"));
      }
    });
  }

  function handleDelete() {
    setError(null);
    setConfirmAction("delete");
  }

  function confirmDelete() {
    startTransition(async () => {
      try {
        await deleteCoach(coachId);
        router.push("/dashboard/admin");
      } catch (e) {
        setError(e instanceof Error ? e.message : t("admin.genericError"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={handlePlanToggle}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-borderButton text-textPrimary hover:bg-cardHover disabled:opacity-50"
        >
          {plan === "pro" ? t("admin.toFree") : t("admin.markPro")}
        </button>
        <button
          onClick={handleBanToggle}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-borderButton text-textPrimary hover:bg-cardHover disabled:opacity-50"
        >
          {banned ? t("admin.unblockAccount") : t("admin.blockAccount")}
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
        >
          {t("admin.deleteAccount")}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <ConfirmDialog open={confirmAction === "ban"} title={banned ? t("admin.unblockTitle") : t("admin.blockTitle")} message={banned ? t("admin.unblockMessage", { email }) : t("admin.blockMessage", { email })} confirmLabel={banned ? t("admin.unblock") : t("admin.block")} destructive={!banned} busy={isPending} onCancel={() => setConfirmAction(null)} onConfirm={confirmBanToggle} />
      <ConfirmDialog open={confirmAction === "delete"} title={t("admin.deleteTitle")} message={t("admin.deleteMessage", { email })} confirmLabel={t("admin.deleteAccount")} busy={isPending} onCancel={() => setConfirmAction(null)} onConfirm={confirmDelete} />
    </div>
  );
}
