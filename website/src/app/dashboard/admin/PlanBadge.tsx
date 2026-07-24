import { isAdminEmail } from "@/lib/auth/admin";
import { getServerI18n } from "@/i18n/server";

export function PlanBadge({ email, plan, accountRole = "coach" }: { email: string; plan: "free" | "pro"; accountRole?: "coach" | "club_admin" | "analyst" }) {
  const { t } = getServerI18n();
  if (isAdminEmail(email)) {
    return <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 text-xs font-semibold">Admin</span>;
  }
  if (accountRole === "club_admin") {
    return <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-semibold">Club Admin</span>;
  }
  if (accountRole === "analyst") {
    return <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-xs font-semibold">Analyst</span>;
  }

  if (plan === "pro") {
    return <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-semibold">Pro</span>;
  }

  return <span className="text-textMuted text-xs">{t("admin.free")}</span>;
}
