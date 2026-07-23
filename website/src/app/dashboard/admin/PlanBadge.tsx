import { isAdminEmail } from "@/lib/auth/admin";
import { getServerI18n } from "@/i18n/server";

export function PlanBadge({ email, plan }: { email: string; plan: "free" | "pro" }) {
  const { t } = getServerI18n();
  if (isAdminEmail(email)) {
    return <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 text-xs font-semibold">Admin</span>;
  }

  if (plan === "pro") {
    return <span className="px-2 py-0.5 rounded bg-accent/15 text-accent text-xs font-semibold">Pro</span>;
  }

  return <span className="text-textMuted text-xs">{t("admin.free")}</span>;
}
