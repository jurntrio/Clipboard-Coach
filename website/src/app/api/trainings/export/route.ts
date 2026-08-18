import { NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "training";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Je sessie is verlopen." }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("trainer_trainings")
    .select("id, club_id, title, age_category, themes, content, publication_state, created_at, updated_at, clubs(name)")
    .eq("owner_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const trainings = data ?? [];
  if (!trainings.length) return NextResponse.json({ error: "Je hebt nog geen trainingen om te downloaden." }, { status: 404 });

  const files: Record<string, Uint8Array> = {};
  const csvRows = [["Naam", "Club", "Leeftijd", "Thema's", "Status", "Gewijzigd"]];
  for (const training of trainings) {
    const club = training.clubs as unknown as { name: string } | null;
    const fileName = `trainingen/${safeFileName(training.title)}-${training.id.slice(0, 8)}.json`;
    files[fileName] = strToU8(JSON.stringify({
      exportVersion: 1,
      id: training.id,
      title: training.title,
      club: club?.name ?? null,
      ageCategory: training.age_category,
      themes: training.themes,
      publicationState: training.publication_state,
      createdAt: training.created_at,
      updatedAt: training.updated_at,
      content: training.content
    }, null, 2));
    csvRows.push([
      training.title, club?.name ?? "", training.age_category,
      (training.themes ?? []).join("; "), training.publication_state, training.updated_at
    ]);
  }
  files["overzicht.csv"] = strToU8(csvRows.map(row => row.map(csvCell).join(",")).join("\r\n"));
  files["LEESMIJ.txt"] = strToU8(
    `SVS trainingsexport\n\nAantal trainingen: ${trainings.length}\nExportdatum: ${new Date().toISOString()}\n\nElke training staat als volledig JSON-bestand in de map trainingen. overzicht.csv bevat een snel leesbare inhoudstafel.\n`
  );
  const archive = zipSync(files, { level: 6 });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(archive, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="svs-mijn-trainingen-${date}.zip"`,
      "Cache-Control": "private, no-store"
    }
  });
}
