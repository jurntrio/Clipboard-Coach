"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { banCoach, deleteCoach, setCoachPlan, unbanCoach } from "../../actions";

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
    const action = banned ? unbanCoach : banCoach;
    const verb = banned ? "unblock" : "block";
    if (!confirm(`${verb === "block" ? "Block" : "Unblock"} ${email}? ${verb === "block" ? "They will no longer be able to sign in." : ""}`)) return;

    startTransition(async () => {
      try {
        await action(coachId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDelete() {
    setError(null);
    if (!confirm(`Permanently delete ${email} and all their teams, videos and clips? This cannot be undone.`)) return;
    if (!confirm("Are you really sure? This deletes the account immediately.")) return;

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
    </div>
  );
}
