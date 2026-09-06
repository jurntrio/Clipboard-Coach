// Run from website with: node --env-file=.env.local scripts/configure-kmt-clip-intros.mjs
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const r2 = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const clubId = "70163c13-1a1e-402f-87bb-4f70617f00de";
const { data: teams, error } = await db.from("club_teams").select("id,name,age_category").eq("club_id", clubId);
if (error) throw error;
const selected = teams.filter(team => ["KMT A", "KMT B"].includes(team.name) && (!team.age_category || team.age_category === "Senioren"));
if (!selected.some(team => team.name === "KMT A") || !selected.some(team => team.name === "KMT B")) throw new Error("KMT A/B niet gevonden.");
const settings = { allowed: true };
for (const team of selected) {
  const object = { Bucket: process.env.R2_BUCKET_NAME, Key: `clip-intros/permissions/${team.id}.json` };
  try {
    await r2.send(new GetObjectCommand(object));
    console.log(`${team.name} (${team.id}): bestaande instelling behouden`);
    continue;
  } catch (error) { if (error.name !== "NoSuchKey") throw error; }
  await r2.send(new PutObjectCommand({ ...object, Body: JSON.stringify(settings), ContentType: "application/json", CacheControl: "no-store" }));
  const readback = await r2.send(new GetObjectCommand(object));
  const actual = JSON.parse(await readback.Body.transformToString());
  if (actual.allowed !== true) throw new Error("Controle mislukt.");
  console.log(`${team.name} (${team.id}): clipbeelden toegestaan, geverifieerd`);
}
console.log(`${teams.length - selected.length} andere ploegen behouden de standaard uit (zonder eigen instelling).`);
