"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ExitCard() {
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
      title="Exit"
      className="flex items-center justify-center p-6 bg-card rounded-xl border border-border hover:bg-cardHover hover:border-accent transition"
    >
      <Image src="/branding/exit.png" alt="Exit" width={96} height={96} />
    </button>
  );
}
