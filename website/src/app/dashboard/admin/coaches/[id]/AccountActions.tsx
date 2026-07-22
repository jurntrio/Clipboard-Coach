"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { banCoach, deleteCoach, setCoachPlan, unbanCoach } from "../../actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function AccountActions({
  coachId,
  email,
  banned,
  plan
}: {
  coachId: string;
  email: string;
  banned: boolean;
  plan: "free" | "pro";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"ban" | "delete" | null>(null);
  const router = useRouter();

  function handlePlanToggle() {
    setError(null);
    const nextPlan = plan === "pro" ? "free" : "pro";

    startTransition(async () => {
      try {
        await setCoachPlan(coachId, nextPlan);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
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
        setError(e instanceof Error ? e.message : "Something went wrong");
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
        setError(e instanceof Error ? e.message : "Something went wrong");
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
          {plan === "pro" ? "Move to free plan" : "Mark as Pro"}
        </button>
        <button
          onClick={handleBanToggle}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-borderButton text-textPrimary hover:bg-cardHover disabled:opacity-50"
        >
          {banned ? "Unblock account" : "Block account"}
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
        >
          Delete account
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <ConfirmDialog open={confirmAction === "ban"} title={banned ? "Unblock account?" : "Block account?"} message={banned ? `Allow ${email} to sign in again?` : `${email} will no longer be able to sign in until the account is unblocked.`} confirmLabel={banned ? "Unblock" : "Block"} destructive={!banned} busy={isPending} onCancel={() => setConfirmAction(null)} onConfirm={confirmBanToggle} />
      <ConfirmDialog open={confirmAction === "delete"} title="Permanently delete account?" message={`This immediately deletes ${email}, including all teams, players, videos and clips. This cannot be undone.`} confirmLabel="Delete account" busy={isPending} onCancel={() => setConfirmAction(null)} onConfirm={confirmDelete} />
    </div>
  );
}
