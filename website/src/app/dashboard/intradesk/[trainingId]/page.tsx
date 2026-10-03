import { pageTitle } from "@/lib/page-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { TrainingReadOnlyView } from "@/components/training/TrainingReadOnlyView";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getClubContext } from "@/lib/auth/active-club";

export default async function IntradeskTrainingPage({ params }: { params: { trainingId: string } }) {
  const { user } = await getClubContext();
  if (!user) notFound();
  const admin = createAdminClient();
  const { data: training } = await admin.from("club_trainings").select("*")
    .eq("id", params.trainingId).eq("status", "published").maybeSingle();
  if (!training) notFound();
  const access = await getClubAccess(training.club_id, user);
  if (!hasClubPermission(access, "training.view")) notFound();

  const { data: versions } = await admin.from("club_training_versions")
    .select("version_number, change_note, created_by, created_at, content")
    .eq("training_id", training.id).order("version_number", { ascending: false });
  const current = versions?.[0];
  const content = (current?.content ?? {}) as {
    team?: string; date?: string; playerCount?: number; keeperCount?: number;
    trainers?: string[]; themes?: string[]; material?: string; blocks?: Record<string, any>[];
  };
  const { data: builderEntitlement } = access.role === "platform_admin"
    ? { data: { club_id: training.club_id } }
    : await admin.from("club_module_entitlements").select("club_id").eq("club_id", training.club_id).eq("module_key", "training_builder").eq("enabled", true).maybeSingle();
  const canEdit = hasClubPermission(access, "training.manage") && !!builderEntitlement;

  return <div className="mx-auto max-w-5xl p-4 sm:p-8">
    <SectionHeader title={training.title} subtitle={`${training.age_category} · versie ${training.current_version}`} artworkSrc="/branding/intradesk.png" backHref="/dashboard/intradesk" showHome={false} />

    <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Fact label="Categorie" value={training.age_category} />
      <Fact label="Ploeg" value={content.team || "Niet opgegeven"} />
      <Fact label="Spelers" value={`${content.playerCount ?? 0} + ${content.keeperCount ?? 0} K`} />
      <Fact label="Duur" value={`${(content.blocks ?? []).filter(block => block.active !== false).reduce((sum, block) => sum + (block.minutes ?? 0), 0)} minuten`} />
      <Fact label="Thema's" value={(content.themes ?? []).join(", ") || "Niet opgegeven"} />
      <Fact label="Trainers" value={(content.trainers ?? []).join(", ") || "Niet opgegeven"} />
      <Fact label="Materiaal" value={content.material || "Niet opgegeven"} wide />
    </section>

    <section className="mt-5 rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-xl font-black text-textBright">Training</h2>
      <TrainingReadOnlyView blocks={content.blocks} />
    </section>

    <section className="mt-5 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-black text-textBright">Versiegeschiedenis</h2>
      <div className="mt-3 space-y-2">
        {(versions ?? []).map(version => <div key={version.version_number} className="rounded-lg border border-borderSubtle px-4 py-3">
          <p className="font-semibold text-textPrimary">Versie {version.version_number}</p>
          <p className="text-xs text-textMuted">{version.change_note || "Geen wijzigingsnotitie"} · {new Date(version.created_at).toLocaleString("nl-BE")}</p>
        </div>)}
      </div>
    </section>

    {canEdit && <div className="mt-5 flex flex-wrap gap-3">
      <Link href={`/dashboard/training/new?edit=${training.id}`} className="inline-flex rounded-lg border border-accent px-4 py-2 text-sm font-black text-accent">
        Edit
      </Link>
      <Link href={`/dashboard/training/new?source=${training.id}`} className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-black text-page">
        Aanpassen als nieuwe versie
      </Link>
    </div>}
  </div>;
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}>
    <p className="text-xs font-bold uppercase tracking-wide text-textMuted">{label}</p>
    <p className="mt-1 text-sm text-textPrimary">{value}</p>
  </div>;
}

export const generateMetadata = pageTitle("page.training");
