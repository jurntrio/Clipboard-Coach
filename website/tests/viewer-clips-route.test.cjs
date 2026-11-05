const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ authenticated = true, permissions = true, teamAllowed = true, videoVisible = true, failClips = false, failProfiles = false } = {}) {
  const reads = [];
  function client(kind) {
    return { from(table) {
      const read = { kind, table }; reads.push(read);
      const query = {
        select(columns) { read.columns = columns; return query; },
        eq(column, value) { read.eq = [column, value]; return query; },
        in(column, values) { read.scope = [column, values]; return query; },
        order() { return query; }, maybeSingle() { return query; },
        then(resolve, reject) {
          if (table === "profiles" && failProfiles === "network") return Promise.reject(new Error("network")).then(resolve, reject);
          const rows = {
            matches: { club_id: "club", club_team_id: "team", match_videos: [{ video_id: "linked-video" }] },
            videos: videoVisible ? { id: "standalone-video" } : null,
            clips: [{ id: "clip", coach_id: "original-maker" }],
            profiles: [{ id: "original-maker", full_name: "Jan Peeters" }]
          };
          return Promise.resolve({ data: rows[table], error: (failClips && table === "clips") || (failProfiles && table === "profiles") ? { message: "failed" } : null }).then(resolve, reject);
        }
      }; return query;
    }};
  }
  const supabase = { ...client("user"), auth: { getUser: async () => ({ data: { user: authenticated ? { id: "viewer" } : null } }) } };
  const deps = {
    "next/server": { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), { status: options?.status ?? 200 }) } },
    "@/lib/supabase/server": { createClient: () => supabase },
    "@/lib/supabase/admin": { createAdminClient: () => client("admin") },
    "@/lib/auth/club-access": { getClubAccess: async () => ({}), canAccessTeam: () => teamAllowed, hasClubPermission: () => permissions },
    "@/lib/viewer-clips": { toViewerClip: (clip, names) => ({ id: clip.id, creatorName: names.get(clip.coach_id) }) }
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(require("node:path").join(__dirname, "../src/app/api/viewer-clips/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: key => deps[key], Response, URL });
  return { reads, get: query => module.exports.GET({ url: "https://example.test/api/viewer-clips?" + query }) };
}
test("requires authentication and a single explicit viewer scope", async () => {
  const unauth = fixture({ authenticated: false });
  assert.equal((await unauth.get("matchId=match")).status, 401);
  assert.equal(unauth.reads.length, 0);
  for (const query of ["", "matchId=match&videoId=video"]) {
    const f = fixture(); assert.equal((await f.get(query)).status, 400); assert.equal(f.reads.length, 0);
  }
});
test("match permissions and team scope are checked before loading clips or maker names", async () => {
  for (const options of [{ permissions: false }, { teamAllowed: false }]) {
    const f = fixture(options); assert.equal((await f.get("matchId=match")).status, 403);
    assert.equal(f.reads.some(read => ["clips", "profiles"].includes(read.table)), false);
  }
});
test("match clips are restricted to linked videos and expose only maker names", async () => {
  const f = fixture(); const response = await f.get("matchId=match");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { clips: [{ id: "clip", creatorName: "Jan Peeters" }] });
  const clips = f.reads.find(read => read.table === "clips");
  assert.equal(clips.kind, "admin"); assert.equal(JSON.stringify(clips.scope), JSON.stringify(["video_id", ["linked-video"]]));
  const profiles = f.reads.find(read => read.table === "profiles");
  assert.equal(profiles.columns, "id, full_name");
  assert.equal(JSON.stringify(profiles.scope), JSON.stringify(["id", ["original-maker"]]));
});
test("standalone videos retain row-level visibility for both video and clip reads", async () => {
  const f = fixture(); assert.equal((await f.get("videoId=video")).status, 200);
  assert.equal(f.reads.find(read => read.table === "clips").kind, "user");
  const hidden = fixture({ videoVisible: false }); assert.equal((await hidden.get("videoId=video")).status, 404);
  assert.equal(hidden.reads.some(read => read.table === "clips"), false);
});
test("clip load failures return an error rather than an empty success", async () => {
  const f = fixture({ failClips: true }); assert.equal((await f.get("matchId=match")).status, 500);
  assert.equal(f.reads.some(read => read.table === "profiles"), false);
});

test("saved clips remain visible when maker names cannot be loaded", async () => {
  for (const failProfiles of [true, "network"]) {
    for (const scope of ["matchId=match", "videoId=video"]) {
      const response = await fixture({ failProfiles }).get(scope);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { clips: [{ id: "clip" }] });
    }
  }
});
