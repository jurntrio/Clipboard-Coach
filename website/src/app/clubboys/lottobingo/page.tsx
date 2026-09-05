import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LottoBingo } from "@/components/lotto-bingo/LottoBingo";
import "@/components/lotto-bingo/lotto-bingo.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Lotto Bingo | Supportersclub De Clubboys",
  description: "Volg de Lotto Bingo van Supportersclub De Clubboys: prijzenpot, trekkingen en het actuele klassement.",
  openGraph: { title: "Lotto Bingo · De Clubboys", description: "Wie speelt als eerste zijn 10 nummers weg? Bekijk de actuele stand.", images: ["/clubboys/logo.png"] },
  icons: { icon: "/clubboys/logo.png", apple: "/clubboys/logo.png" }
};

export default async function LottoBingoPage() {
  const { data, error } = await createClient().rpc("lotto_bingo_snapshot");
  return <LottoBingo initialData={error ? null : data} />;
}
