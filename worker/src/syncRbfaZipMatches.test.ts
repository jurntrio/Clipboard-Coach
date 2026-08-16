import assert from "node:assert/strict";
import test from "node:test";

test("parses all three RBFA official columns", async () => {
  Object.assign(process.env, {
    WORKER_SHARED_SECRET: "test", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "test",
    R2_SECRET_ACCESS_KEY: "test", R2_BUCKET_NAME: "test", R2_PUBLIC_URL: "https://example.test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test"
  });
  const { parseRbfaCsv } = await import("./syncRbfaZipMatches");
  const [row] = parseRbfaCsv('DIV;DATE;REFEREE;ASSISTANT-REFEREE1;ASSISTANT-REFEREE2\nA;15/08/2026;Main;Line 1;Line 2');
  assert.equal(row.REFEREE, "Main");
  assert.equal(row["ASSISTANT-REFEREE1"], "Line 1");
  assert.equal(row["ASSISTANT-REFEREE2"], "Line 2");
});
