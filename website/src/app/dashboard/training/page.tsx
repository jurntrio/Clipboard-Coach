import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubAccess } from "@/lib/auth/club-access";

export default async function TrainingPage() {
  const context = await getClubContext();
  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const access = clubId && context.user ? await getClubAccess(clubId, context.user) : null;
  const [{ data: sessions }, { data: options }, { data: intradeskEntitlement }] = await Promise.all([
    clubId
      ? admin.from("team_training_sessions").select("id, club_team_id, training_date, start_time, field_option_id, locker_room_option_id, club_teams(name)")
          .eq("club_id", clubId).order("training_date").order("start_time")
      : Promise.resolve({ data: [] }),
    clubId
      ? admin.from("club_match_options").select("id, label").eq("club_id", clubId).eq("active", true)
      : Promise.resolve({ data: [] }),
    clubId
      ? admin.from("club_module_entitlements").select("club_id").eq("club_id", clubId).eq("module_key", "intradesk").eq("enabled", true).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  const visible = (sessions ?? []).filter(session => access?.teamIds === null || access?.teamIds.has(session.club_team_id));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = visible.filter(item => item.training_date >= today);
  const past = visible.filter(item => item.training_date < today).reverse().slice(0, 20);
  const optionNames = new Map((options ?? []).map(option => [option.id, option.label]));

  return <div className="mx-auto max-w-6xl p-4 sm:p-8">
    <SectionHeader title="Trainingen" subtitle="Bekijk de planning, locatie, staff en aanwezigheden van elke ploeg." artworkSrc="/branding/training.png" showHome={false} />
    <div className="mb-5 flex flex-wrap gap-3">
      <Link href="/dashboard/training/new" className="rounded-lg bg-accent px-5 py-3 text-sm font-black text-page hover:brightness-110">Nieuw trainingsplan</Link>
      {intradeskEntitlement && <Link href="/dashboard/intradesk" className="rounded-lg border border-borderButton px-5 py-3 text-sm font-bold text-textPrimary hover:border-accent">Open Intradesk</Link>}
    </div>
    <TrainingSection title="Komende trainingen" sessions={upcoming} optionNames={optionNames} empty="Er zijn nog geen komende trainingen gepland." />
    <div className="mt-6"><TrainingSection title="Voorbije trainingen" sessions={past} optionNames={optionNames} empty="Nog geen voorbije trainingen." /></div>
  </div>;
}

function TrainingSection({ title, sessions, optionNames, empty }: {
  title: string; sessions: any[]; optionNames: Map<string, string>; empty: string;
}) {
  return <section className="rounded-2xl border border-border bg-card p-5">
    <h2 className="text-xl font-bold text-textBright">{title}</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-2">{sessions.map(session => {
      const team = session.club_teams as { name: string } | null;
      return <Link key={session.id} href={`/dashboard/training/${session.id}`} className="flex items-center gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4 transition hover:border-accent">
        <Image src="/branding/training.png" alt="" width={52} height={52} className="h-12 w-12 object-contain" />
        <span className="min-w-0 flex-1"><strong className="block text-textBright">{team?.name ?? "Teamtraining"}</strong>
          <span className="block text-sm text-textMuted">{new Date(`${session.training_date}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })} · {session.start_time.slice(0, 5)}</span>
          <span className="block truncate text-xs text-textSecondary">{optionNames.get(session.field_option_id) ?? "Veld nog niet bepaald"}{optionNames.get(session.locker_room_option_id) ? ` · ${optionNames.get(session.locker_room_option_id)}` : ""}</span>
        </span><span className="text-accent">▶</span>
      </Link>;
    })}</div>
    {!sessions.length && <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">{empty}</p>}
  </section>;
}
