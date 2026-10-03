const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");

function load(file, deps, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: key => { if (!(key in deps)) throw Error(key); return deps[key]; }, Response, ...globals });
  return module.exports;
}

function preparation({ authenticated = true, permitted = true, fail = false } = {}) {
  const writes = [];
  const admin = { from(table) {
    let update;
    const q = {
      select() { return q; }, eq() { return q; }, maybeSingle() { return q; },
      update(value) { update = value; return q; },
      then(resolve) {
        if (update) writes.push({ table, update });
        return Promise.resolve({ data: { id: "match", club_id: "club", club_team_id: "team" }, error: update && fail ? {} : null }).then(resolve);
      }
    };
    return q;
  } };
  const route = load("app/api/matches/[id]/preparation/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), { status: options?.status || 200 }) } },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/supabase/server": { createClient: () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? {} : null } }) } }) },
    "@/lib/auth/club-access": { getClubAccess: async () => ({}), canAccessTeam: () => true, hasClubPermission: (_a, p) => p !== "games.tag" || permitted },
    "@/lib/match-defaults": {},
    "@/lib/tag-names": { uniqueTagNames: values => [...new Set(values.map(v => v.trim()).filter(Boolean))] }
  });
  return { writes, patch: body => route.PATCH({ json: async () => body }, { params: { id: "match" } }) };
}

test("tag autosave updates only tag fields, including deletion of the last tag", async () => {
  const f = preparation();
  assert.equal((await f.patch({ tagNames: [" Goal ", "Goal"], customTagNames: ["Goal"], meetingTime: "12:00" })).status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes[0])), { table: "matches", update: { live_tag_names: ["Goal"], custom_live_tag_names: ["Goal"] } });
  assert.equal((await f.patch({ tagNames: [], customTagNames: [] })).status, 200);
  assert.equal(f.writes[1].update.live_tag_names.length, 0);
});
test("tag autosave checks auth, permission, limits and storage failure", async () => {
  for (const [options, expected] of [[{ authenticated: false }, 401], [{ permitted: false }, 403], [{ fail: true }, 500]]) {
    const f = preparation(options);
    assert.equal((await f.patch({ tagNames: ["Goal"], customTagNames: [] })).status, expected);
    if (expected !== 500) assert.equal(f.writes.length, 0);
  }
  const f = preparation();
  for (const body of [null, { tagNames: [12], customTagNames: [] }, { tagNames: ["a".repeat(61)], customTagNames: [] }, { tagNames: Array(31).fill("a"), customTagNames: [] }]) {
    assert.equal((await f.patch(body)).status, 400);
  }
  assert.equal(f.writes.length, 0);
});

test("wake lock reacquires when returning, avoids duplicate requests, and releases on unmount", async () => {
  const listeners = new Map();
  const document = { visibilityState: "visible", addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const window = { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  let cleanup, requests = 0, releases = 0;
  const locks = [];
  const hook = load("hooks/useScreenWakeLock.ts", { react: { useState: () => [false, () => {}], useEffect: fn => { cleanup = fn(); } } }, {
    document, window, navigator: { wakeLock: { request: async () => { requests++; const lock = { released: false, release: async () => { releases++; }, addEventListener() {} }; locks.push(lock); return lock; } } }
  });
  hook.useScreenWakeLock(true);
  await new Promise(resolve => setImmediate(resolve));
  listeners.get("pointerdown")();
  assert.equal(requests, 1);
  locks[0].released = true;
  document.visibilityState = "hidden";
  listeners.get("visibilitychange")();
  assert.equal(requests, 1);
  document.visibilityState = "visible";
  listeners.get("visibilitychange")();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 2);
  cleanup();
  assert.equal(releases, 1);
  assert.equal(listeners.size, 0);
});

test("tag link metadata describes the match, time and tagging purpose", async () => {
  const match = { team_a_name: "SVS", team_b_name: "Visitors", match_date: "2026-10-03", start_time: "15:30:00", is_home_match: false };
  const layout = load("app/tag/[token]/layout.tsx", {
    "@/lib/live-tag-page": { loadLiveTagPage: async () => ({ match }) },
    "@/lib/match-display": { getMatchDisplay: m => ({ homeTeamName: m.team_b_name, awayTeamName: m.team_a_name }) }
  }, { Intl, Date });
  const metadata = await layout.generateMetadata({ params: { token: "example" } });
  assert.equal(metadata.openGraph.title, "Live taggen · Visitors – SVS");
  assert.match(metadata.description, /3\/10\/2026.*15:30/);
  assert.equal(metadata.openGraph.images[0].url, "/tag/example/preview");
  assert.equal(metadata.robots.index, false);
});

test("share preview keeps match information when club logos are absent", async () => {
  const route = load("app/tag/[token]/preview/route.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/og": { ImageResponse: class { constructor(element, options) { this.element = element; this.options = options; } } },
    "@/lib/live-tag-page": { loadLiveTagPage: async () => ({ match: { team_a_name: "SVS", team_b_name: "Visitors", match_date: "2026-10-03", start_time: "15:30", is_home_match: true } }) },
    "@/lib/match-display": { getMatchDisplay: m => ({ homeTeamName: m.team_a_name, awayTeamName: m.team_b_name }) },
    "@/lib/belgian-clubs/resolve-club-logo": { resolveClubLogoById: async () => ({ src: null }) }
  }, { Buffer, AbortSignal, fetch });
  const response = await route.GET({}, { params: { token: "example" } });
  const markup = require("react-dom/server").renderToStaticMarkup(response.element);
  assert.match(markup, /SVS – Visitors/);
  assert.match(markup, /LIVE TAGGEN/);
  assert.match(markup, /15:30/);
  assert.deepEqual(JSON.parse(JSON.stringify(response.options)), { width: 1200, height: 630 });
});

test("a live goal records the moment without requiring details or updating the score", async () => {
  const writes = [];
  const admin = { from(table) {
    const q = {
      select() { return q; }, eq() { return q; }, single() { return q; },
      upsert(payload, options) { writes.push({ table, payload, options }); return q; },
      then(resolve) { return Promise.resolve({ error: null, data: table === "match_tag_links"
        ? { id: "link", matches: { id: "match", match_date: null, status: "planned", live_tag_names: ["Goal"], player_ids: ["player"] } }
        : { id: "moment", occurred_at: "2026-10-03T14:00:00Z" } }).then(resolve); }
    }; return q;
  } };
  const route = load("app/api/live-tag/[token]/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), { status: options?.status || 200 }) } },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/utils": { getTagColor: () => "green" }
  }, { Date, Intl });
  const body = { tagName: "Goal", clientEventId: "e602d71b-0687-4863-890b-797fe5208c49", playerIds: ["player"], goal: { eventType: "goal_for", homeScore: 5, awayScore: 0, scorerId: "player" } };
  assert.equal((await route.POST({ json: async () => body }, { params: { token: "token" } })).status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].table, "live_match_tags");
  assert.equal(writes[0].payload.tag_name, "Goal");
  assert.equal(writes[0].payload.player_ids.length, 0);
  assert.equal(writes[0].payload.score_home, null);
  assert.equal(writes[0].payload.scorer_id, null);
  assert.equal(writes[0].options.onConflict, "link_id,client_event_id");
  delete body.goal;
  assert.equal((await route.POST({ json: async () => body }, { params: { token: "token" } })).status, 200);
});
