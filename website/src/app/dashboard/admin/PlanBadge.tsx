import { isAdminEmail } from "@/lib/auth/admin";
import { getServerI18n } from "@/i18n/server";

export function PlanBadge({ email, plan, accountRole = "coach" }: { email: string; plan: "free" | "pro"; accountRole?: "platform_admin" | "admin_viewer" | "club_admin" | "club_admin_viewer" | "coach" | "assistant_coach" | "team_manager" | "analyst" | "player_parent" }) {
  const { t } = getServerI18n();
  if (isAdminEmail(email)) {
    return <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 text-xs font-semibold">Admin</span>;
  }
  if (accountRole === "admin_viewer") {
    return <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 text-xs font-semibold">Admin (viewer)</span>;
  }
  if (accountRole === "club_admin") {
    return <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-semibold">Club Admin</span>;
  }
  if (accountRole === "club_admin_viewer") {
    return <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-200 text-xs font-semibold">Club Admin (viewer)</span>;
  }
  if (accountRole === "analyst") {
    return <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-xs font-semibold">Analyst</span>;
  }
  if (accountRole === "player_parent") {
    return <span className="px-2 py-0.5 rounded bg-green-500/15 text-green-300 text-xs font-semibold">Player/Parent</span>;
  }

  if (plan === "pro") {
    return <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-semibold">Pro</span>;
  }

  return <span className="text-textMuted text-xs">{t("admin.free")}</span>;
}
