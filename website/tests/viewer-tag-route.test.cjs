const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ authenticated = true, canView = true, teamAllowed = true, linked = true, statsFail = false, tagFail = false, readOnly = false } = {}) {
  const writes = [];
  const rows = {
    matches: { id: "match", coach_id: "other", club_id: "club", club_team_id: "team", team_a_id: "squad", match_date: "2026-09-27" },
    match_videos: linked ? { video_id: "video", videos: { duration: 100, active_player_ids: [] } } : null,
    standard_tags: { start_offset_seconds: -10, end_offset_seconds: 3 },
    players: [{ id: "player" }]
  };
  const admin = { from(table) {
    let action, payload;
    const query = {
      select() { return query; }, eq() { return query; }, in() { return query; }, ilike() { return query; }, limit() { return query; },
      maybeSingle() { return query; }, single() { return query; },
      insert(value) { action = "insert"; payload = value; return query; }, delete() { action = "delete"; return query; },
      then(resolve, reject) {
        if (action) writes.push({ table, action, payload });
        return Promise.resolve({ data: action === "insert" && table === "tags" ? { id: "tag", ...payload } : rows[table],
          error: (table === "tags" && action === "insert" && tagFail) || (table === "player_stat_events" && statsFail) ? { message: "Storage failed" } : null }).then(resolve, reject);
      }
    };
    return query;
  } };
  const deps = {
    "next/server": { NextResponse: { json: (data, options) => new Response(JSON.stringify(data), { status: options?.status ?? 200 }) } },
    "@/lib/supabase/server": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: "viewer" } : null } }) } }) },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/auth/club-access": { getClubAccess: async () => ({ readOnly, role: "trainer" }), canAccessTeam: () => teamAllowed,
      hasClubPermission: (_a, key) => ["games.view", "video.view"].includes(key) && canView },
    "@/lib/utils": { getTagColor: () => "#68d51b" }
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/app/api/matches/[id]/tags/route.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: key => { if (!deps[key]) throw Error(key); return deps[key]; }, Response, Date, console });
  return { writes,
    post: body => module.exports.POST({ json: async () => ({ videoId: "video", name: "Kans", occurredAtSeconds: 20, ...body }) }, { params: { id: "match" } }),
    remove: () => module.exports.DELETE({ json: async () => ({ tagId: "tag" }) }, { params: { id: "match" } }) };
}

test("all viewers including read-only accounts can create profiled tags and goals with persisted authorship", async () => {
  for (const readOnly of [false, true]) {
    for (const body of [{}, { name: "Start", startTime: 20, endTime: 20 }, { name: "Goal", eventType: "goal_against" }]) {
      const f = fixture({ readOnly });
      const response = await f.post(body);
      assert.equal(response.status, 201);
      const { tag } = await response.json();
      assert.equal(tag.event_metadata.created_by, "viewer");
      assert.equal(tag.start_time, body.name === "Start" ? 20 : 10);
      assert.equal(tag.end_time, body.name === "Start" ? 20 : 23);
      assert.equal((await f.remove()).status, 403);
    }
  }
});
test("unauthenticated, unauthorized and foreign video requests cannot insert", async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ canView: false }, 403], [{ teamAllowed: false }, 403], [{ linked: false }, 404]]) {
    const f = fixture(options); assert.equal((await f.post({})).status, status); assert.equal(f.writes.length, 0);
  }
});
test("goal type and scorer/assist validation reject invalid goals before writing", async () => {
  for (const body of [{ name: "Goal", eventType: "bad" }, { eventType: "goal_for" },
    { name: "Goal", eventType: "goal_for", scorerId: "foreign" }, { name: "Goal", eventType: "goal_for", scorerId: "player", assistId: "player" }]) {
    const f = fixture(); assert.equal((await f.post(body)).status, 400); assert.equal(f.writes.length, 0);
  }
});
test("a plain Goal stores a tag without a side, scorer or statistics", async () => {
  const f = fixture(); assert.equal((await f.post({ name: "Goal" })).status,201);
  assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].payload.event_type,null);
});
test("goal statistics keep the requesting viewer as actor and failed statistics undo the tag", async () => {
  const body = { name: "Goal", eventType: "goal_for", scorerId: "player" };
  const f = fixture(); assert.equal((await f.post(body)).status, 201);
  assert.equal(f.writes[1].payload[0].coach_id, "viewer");
  assert.equal(f.writes[1].payload[0].tag_id, "tag");
  const failed = fixture({ statsFail: true }); assert.equal((await failed.post(body)).status, 500);
  assert.equal(failed.writes[2].action, "delete");
  const noTag = fixture({ tagFail: true }); assert.equal((await noTag.post(body)).status, 500);
  assert.equal(noTag.writes.length, 1);
});
