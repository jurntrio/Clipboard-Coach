// One-time seed: uploads the Belgian club database builder's small logos to
// R2 and upserts public.belgian_clubs. Safe to re-run - it always
// re-uploads and upserts (idempotent), and only touches small_logo_path, so
// it never clobbers a large_logo_path set via the admin upload screen.
//
// Usage (run from website/, after migration 0134 has been applied):
//   node --env-file=.env.local scripts/backfill-belgian-clubs.mjs [sourceDir]
//
// sourceDir defaults to the belgische_clubdatabase_builder_v3_fixed output
// folder and must contain clubs.json plus the logo files it references.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DEFAULT_SOURCE_DIR = "C:\\Users\\jurnt\\Downloads\\belgische_clubdatabase_builder_v3_fixed\\output";
const SOURCE_DIR = process.argv[2] || DEFAULT_SOURCE_DIR;

const CONTENT_TYPES = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml"
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}. Run with: node --env-file=.env.local scripts/backfill-belgian-clubs.mjs`);
  return value;
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false }
});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY")
  }
});
const bucket = requireEnv("R2_BUCKET_NAME");

async function main() {
  const clubsJsonPath = path.join(SOURCE_DIR, "clubs.json");
  const clubs = JSON.parse(await readFile(clubsJsonPath, "utf8"));
  console.log(`Loaded ${clubs.length} clubs from ${clubsJsonPath}`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const club of clubs) {
    const stamnummer = Number(club.stamnummer);
    const naam = String(club.naam ?? "").trim();
    if (!Number.isFinite(stamnummer) || !naam || !club.logo) {
      console.warn(`Overgeslagen (onvolledige data): ${JSON.stringify(club)}`);
      skipped++;
      continue;
    }

    const logoPath = path.join(SOURCE_DIR, club.logo);
    let fileBuffer;
    try {
      fileBuffer = await readFile(logoPath);
    } catch {
      console.warn(`Geen logo-bestand voor stamnummer ${stamnummer}: ${logoPath}`);
      skipped++;
      continue;
    }

    const extension = path.extname(logoPath).slice(1).toLowerCase() || "webp";
    const key = `belgian-clubs/small/${stamnummer}.${extension}`;
    const contentType = CONTENT_TYPES[extension] || "application/octet-stream";

    try {
      await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fileBuffer, ContentType: contentType }));
      const { error } = await supabase
        .from("belgian_clubs")
        .upsert({ stamnummer, naam, small_logo_path: key }, { onConflict: "stamnummer" });
      if (error) throw error;
      uploaded++;
    } catch (reason) {
      console.error(`Mislukt voor stamnummer ${stamnummer}:`, reason instanceof Error ? reason.message : reason);
      failed++;
    }
  }

  console.log(`Klaar. Geupload: ${uploaded}, overgeslagen: ${skipped}, mislukt: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
