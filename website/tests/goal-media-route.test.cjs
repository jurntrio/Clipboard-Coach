const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, deps) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (!(name in deps)) throw new Error(`Unexpected import: ${name}`);
    return deps[name];
  }, Response, console, Set });
  return module.exports;
}
const helpers = load("../src/lib/goal-media.ts", {});
function fixture({ authenticated = true, canEdit = true, canView = true, readOnly = false, teamAllowed = true, linkedVideo = true, existingGoal = null, failedRpc = false } = {}) {
  const writes = [];
  const rows = {
    matches: { id: "match", club_id: "club", club_team_id: "team", team_a_id: "own-team", is_home_match: false },
    tags: { id: "tag", video_id: "video", name: "Goal", event_type: "goal_for", start_time: 10, end_time: 25 },
    match_videos: linkedVideo ? { video_id: "video", videos: { duration: 100, video_url: "https://360.example/video.mp4" } } : null,
    match_dossiers: { goal_events: existingGoal ? [existingGoal] : [] },
    players: [{ id: "player" }]
  };
  const admin = {
    from(table) {
      const query = { select() { return query; }, eq() { return query; }, in() { return query; }, maybeSingle() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: rows[table], error: null }).then(resolve, reject); } };
      return query;
    },
    async rpc(name, payload) { writes.push({ name, payload }); return { data: { clipId: payload.p_create_clip ? "clip" : null, goal: payload.p_goal }, error: failedRpc ? { message: "TAG_ALREADY_LINKED" } : null }; }
  };
  const route = load("../src/app/api/matches/[id]/goal-media/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => new Response(JSON.stringify(data), { status: options?.status ?? 200 }) } },
    "@/lib/supabase/server": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: "user" } : null } }) } }) },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/auth/club-access": { getClubAccess: async () => ({ readOnly }), canAccessTeam: () => teamAllowed,
      hasClubPermission: (_access, permission) => permission === "games.view" || permission === "video.view" ? canView : canEdit },
    "@/lib/goal-media": helpers
  });
  return { writes, patch: body => route.PATCH({ json: async () => ({ tagId: "tag", scoreAfter: "0-1", ...body }) }, { params: { id: "match" } }), post: body => route.POST({ json: async () => ({ tagId: "tag", scoreAfter: "0-1", ...body }) }, { params: { id: "match" } }) };
}

test("video-first links an away goal without prematurely creating a clip", async () => {
  const f = fixture();
  assert.equal((await f.post({ minute: 12 })).status, 200);
  assert.equal(f.writes[0].payload.p_goal.team, "away");
  assert.equal(f.writes[0].payload.p_goal.id, "goal-1");
  assert.equal(f.writes[0].payload.p_create_clip, false);
});
test("report-first reuses the goal ID, scorer and existing report notes", async () => {
  const goal = helpers.makeReportGoal({ scoreAfter: "0-1", team: "away" });
  goal.id = "report-existing-id"; goal.description = "Bestaande toelichting";
  const f = fixture({ existingGoal: goal });
  assert.equal((await f.post({ goalId: goal.id, saveClip: true, startTime: 10, endTime: 25 })).status, 200);
  assert.equal(f.writes[0].payload.p_goal.id, goal.id);
  assert.equal(f.writes[0].payload.p_goal.description, goal.description);
  assert.equal(f.writes[0].payload.p_create_clip, true);
});
test("permission failures, foreign tags, invalid ranges and missing goals never write", async () => {
  for (const [options, body, status] of [
    [{ authenticated: false }, {}, 401], [{ canView: false }, {}, 403], [{ teamAllowed: false }, {}, 403],
    [{ linkedVideo: false }, {}, 400], [{}, { saveClip: true, startTime: -1, endTime: 25 }, 400],
    [{}, { saveClip: true, startTime: 10, endTime: 101 }, 400], [{}, { goalId: "missing" }, 400]
  ]) {
    const f = fixture(options); assert.equal((await f.post(body)).status, status); assert.equal(f.writes.length, 0);
  }
});
test("viewer-only and read-only accounts can create goal links but cannot edit links or export clips", async () => {
  for (const options of [{ canEdit: false }, { readOnly: true }]) {
    const f = fixture(options);
    assert.equal((await f.post({})).status, 200);
    assert.equal((await f.post({ saveClip: true, startTime: 10, endTime: 25 })).status, 403);
    assert.equal((await f.patch({ mediaId: "media", previousGoalId: "goal-1" })).status, 403);
    assert.equal(f.writes.length, 1);
  }
});
test("a duplicate tag conflict is visible and never reports successful storage", async () => {
  const f = fixture({ failedRpc: true });
  const response = await f.post({});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /al aan een ander doelpunt/);
});

test("report confirms an independent clip range without altering tag times", async () => {
 const f=fixture(); const response=await f.post({saveClip:true,startTime:9,endTime:30,scorerId:"player"}); assert.equal(response.status,200); assert.equal(f.writes[0].payload.p_start,9); assert.equal(f.writes[0].payload.p_end,30); assert.equal(f.writes[0].payload.p_goal.scorerPlayerId,"player");
});

test("editing explicitly carries the original link identity and keeps regular linking guarded", async () => { const f=fixture(); assert.equal((await f.patch({})).status,400); assert.equal(f.writes.length,0); assert.equal((await f.patch({mediaId:"media",previousGoalId:"goal-1"})).status,200); assert.equal(f.writes[0].payload.p_goal._relink_media_id,"media"); assert.equal(f.writes[0].payload.p_goal._previous_goal_id,"goal-1"); assert.equal(f.writes[0].payload.p_create_clip,false); });
test("editing updates score, side and minute, clears players and preserves report notes", async () => {
  const goal = helpers.makeReportGoal({scoreAfter:"0-1",team:"away",scorerId:"player"}); goal.description="Bestaande toelichting";
  const f=fixture({existingGoal:goal});
  assert.equal((await f.patch({mediaId:"media",previousGoalId:goal.id,goalId:goal.id,editGoal:true,scoreAfter:"1-1",team:"home",minute:42,scorerId:null,assistId:null})).status,200);
  const saved=f.writes[0].payload.p_goal;
  assert.equal(saved.id,goal.id); assert.equal(saved.scoreAfter,"1-1"); assert.equal(saved.team,"home"); assert.equal(saved.minute,42); assert.equal(saved.scorerPlayerId,""); assert.equal(saved.description,goal.description);
});
test("view-only users cannot change a report goal or tag times through linking", async () => {
  const f=fixture({canEdit:false});
  assert.equal((await f.post({editGoal:true})).status,403);
  assert.equal((await f.post({updateTagTimes:true,startTime:10,endTime:20})).status,403);
  assert.equal(f.writes.length,0);
});
