"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";

export function ExitCard() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      title={t("common.exit")}
      className="flex items-center justify-center p-6 bg-card rounded-xl border border-border hover:bg-cardHover hover:border-accent transition"
    >
      <Image src="/branding/exit.png" alt={t("common.exit")} width={96} height={96} />
    </button>
  );
}
