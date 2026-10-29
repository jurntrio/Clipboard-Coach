const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
function load(file, dependencies = {}, fetchOverride) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, console, Buffer, URL, setTimeout, fetch, Response, AbortSignal, Request, process: {env: {WORKER_URL: "https://worker.test", WORKER_SHARED_SECRET: "test"}}, fetch: fetchOverride ?? fetch, require: name => dependencies[name] ?? require(name) });
  return module.exports;
}
const ids = Array.from({length: 4}, (_, i) => String(i + 1).repeat(8) + "-1111-1111-1111-111111111111");
const images = load("../src/lib/clip-images.ts", { "./clip-intro": { parseClipIntro: value => value } });
const plan = load("../../worker/src/clipImagePlan.ts");
const segments = [{id: ids[0], tag_id: ids[2], sequence_order: 0}, {id: ids[1], tag_id: ids[2], sequence_order: 1}, {id: ids[3], tag_id: ids[3], sequence_order: 2}];

test("drawing choice applies to every camera of the selected tag, leaving other tags and default clips included", () => {
  const normal = images.makeClipImageManifest(images.emptyClipImages(), segments);
  assert.equal(normal.excludeDrawings, undefined);
  const excluded = images.makeClipImageManifest(images.emptyClipImages(), segments, undefined, [ids[2]]);
  assert.deepEqual(Array.from(excluded.excludeDrawings), [ids[0], ids[1]]);
  assert.equal(plan.parseImageManifest(excluded).excludeDrawings.length, 2);
  assert.throws(() => images.makeClipImageManifest(images.emptyClipImages(), segments, undefined, ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]));
});
test("drawing selection rejects malformed values and accepts an absent legacy selection", () => {
  assert.deepEqual(Array.from(images.parseExcludedDrawingTagIds(undefined)), []);
  assert.equal(images.parseExcludedDrawingTagIds([ids[0], ids[0]]).length, 1);
  for (const value of [null, true, "all", [42], ["not-an-id"], Array(201).fill(ids[0])]) assert.throws(() => images.parseExcludedDrawingTagIds(value));
  for (const value of [null, "all", [42], ["not-an-id"], Array(401).fill(ids[0])]) assert.throws(() => plan.parseImageManifest({version: 1, segments: {}, excludeDrawings: value}));
});

async function render(excluded, local = false) {
  const downloaded = [], rendered = [], writes = [];
  const rows = segments.slice(0, 2).map((segment, index) => ({...segment, video_id: "camera", render_status: "pending", render_attempts: 0, rendered_segment: local ? {key: "uploaded.mp4", play_start: 0, duration: 10} : null, tags: {video_id: "camera", name: "Tag", color: "red", start_time: 10, end_time: 20, drawings: [{key: "drawing.png", video_time: 15, duration_seconds: 5}], videos: {id: "camera", video_url: "https://video.test/source.mp4"}}}));
  const manifest = excluded ? {version: 1, segments: {}, excludeDrawings: [rows[0].id]} : null;
  const fakeFs = {mkdtemp: async () => "fake-work", mkdir: async () => {}, copyFile: async () => {}, stat: async () => ({size: 100}), rm: async () => {}};
  const supabase = {from(table) {
    let write;
    const q = {select() {return q;}, eq() {return q;}, order: async () => ({data: rows}), single: async () => ({data: {coach_id: "coach", rendered_clip: null}}), update(value) {write = value; writes.push(value); return q;}, then(resolve) { return Promise.resolve({error: null}).then(resolve); }};
    return q;
  }};
  const worker = load("../../worker/src/processRemoteClip.ts", {
    "node:fs/promises": fakeFs,
    "./supabase": {supabase},
    "./r2": {readJsonObject: async () => manifest, downloadToFile: async key => {downloaded.push(key);}, uploadFile: async () => "https://clip.test/result.mp4", deleteObject: async () => {}},
    "./clipImagePlan": plan,
    "./clipImagePipeline": {prependClipImages: async () => {}},
    "./remoteRangeProxy": {createRemoteRangeProxy: async () => ({inputUrl: "http://local/source", stats: {requestCount: 0, transferredBytes: 0}, close: async () => {}})},
    "./hlsPipeline": {buildMobileMp4WithDrawings: async (input, output, drawings) => {rendered.push(drawings);}, concatenateMp4Files: async () => {}, probeDurationSeconds: async () => 10}
  });
  await worker.processRemoteClip("clip");
  return {downloaded, rendered, writes, rows};
}
for (const local of [false, true]) test("actual clip renderer honors per-segment exclusion for " + (local ? "browser uploaded" : "remote") + " video", async () => {
  const result = await render(true, local);
  assert.deepEqual(result.rendered.map(drawings => drawings.length), [0, 1]);
  assert.equal(result.downloaded.filter(key => key === "drawing.png").length, 1);
  assert.equal(result.rows[0].tags.drawings.length, 1, "original tag drawing must remain saved");
  assert.equal(result.writes.at(-1).render_status, "ready");
});
test("existing clips without a selection retain all their drawings", async () => {
  const result = await render(false);
  assert.deepEqual(result.rendered.map(drawings => drawings.length), [1, 1]);
});


async function submitSelection(excluded, options = {}) {
  const manifests = [], calls = [];
  const client = {auth: {getUser: async () => ({data: {user: options.anonymous ? null : {id: "owner"}}})}, from(table) {
    const q = {select() {return q;}, eq() {return q;}, single: async () => ({data: {id: "clip", coach_id: options.foreign ? "other" : "owner", video_id: "video"}}), order: async () => ({data: segments.map(s => ({...s, render_started_at: options.started ? "now" : null}))})};
    return q;
  }};
  const route = load("../src/app/api/clips/[id]/process/route.ts", {
    "next/server": {NextResponse: {json: (data, init) => new Response(JSON.stringify(data), {status: init?.status ?? 200})}},
    "@/lib/supabase/server": {createClient: () => client},
    "@/lib/clip-images": images,
    "@/lib/clip-images-server": {clipImageSource: async () => {throw new Error("Drawing exclusion must not need intro-image permission");}, writeImageObject: async (key, json) => manifests.push(JSON.parse(json))}
  }, async (url, init) => {calls.push(url); return new Response(JSON.stringify(url.endsWith("/health") ? {clipImageIntros: 1, clipDrawingSelection: options.oldWorker ? undefined : 1} : {accepted: true}));});
  const result = await route.POST(new Request("http://app/api/clips/clip/process", {method: "POST", body: JSON.stringify({excludedDrawingTagIds: excluded})}), {params: {id: "clip"}});
  return {result, manifests, calls};
}
test("process endpoint saves exclusion for all cameras before triggering worker, without requiring intro permission", async () => {
  const result = await submitSelection([ids[2]]);
  assert.equal(result.result.status, 200);
  assert.deepEqual(result.manifests[0].excludeDrawings, [ids[0], ids[1]]);
  assert.ok(result.calls.at(-1).endsWith("/process-clip"));
});
test("process endpoint rejects missing access, unknown tags, a started job and an older worker before triggering rendering", async () => {
  for (const [excluded, options, status] of [[[ids[2]], {anonymous: true}, 401], [[ids[2]], {foreign: true}, 404], [["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"], {}, 400], [[ids[2]], {started: true}, 409], [[ids[2]], {oldWorker: true}, 503], [[true], {}, 400]]) {
    const result = await submitSelection(excluded, options);
    assert.equal(result.result.status, status);
    assert.equal(result.manifests.length, 0);
    assert.ok(!result.calls.some(url => url.endsWith("/process-clip")));
  }
});
