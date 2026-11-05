const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const source = fs.readFileSync(process.env.CLIP_BUILDER_SOURCE ?? path.join(__dirname, "../src/components/clips/ClipBuilder.tsx"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const moduleUnderTest = { exports: {} };
vm.runInNewContext(code, { module: moduleUnderTest, exports: moduleUnderTest.exports, require: name => {
  if (["react", "react-dom", "react/jsx-runtime"].includes(name)) return require(name);
  if (name === "@/lib/supabase/client") return { createClient: () => ({}) };
  if (name === "@/lib/tags") return { isPeriodMarker: name => ["start", "end"].includes(name.toLowerCase()) };
  if (name === "@/i18n/client") return { useI18n: () => ({ t: key => key }) };
  if (name === "@/lib/clip-images") return { emptyClipImages: () => ({ opening: null, tags: {} }) };
  return {};
} });

function buttonDisabled(overrides = {}) {
  const props = { videoId: "first", teamId: "team", selectedTagIds: ["tag"],
    tags: [{ id: "tag", name: "Opbouw", video_id: "first" }], players: [],
    localVideo: true, localVideoIds: ["first", "second"], localFile: null,
    localFilesByVideoId: { first: {} }, localSourcesReady: false, onClipCreated() {}, ...overrides };
  const html = renderToStaticMarkup(React.createElement(moduleUnderTest.exports.ClipBuilder, props));
  return /<button[^>]* disabled=""/.test(html);
}

test("unrelated missing local videos do not block a clip from a connected video", () => {
  assert.equal(buttonDisabled(), false);
});
test("a selected tag from a missing local video blocks clip creation", () => {
  assert.equal(buttonDisabled({ tags: [{ id: "tag", name: "Opbouw", video_id: "second" }] }), true);
});
test("remote tags remain usable when unrelated local videos are disconnected", () => {
  assert.equal(buttonDisabled({ tags: [{ id: "tag", name: "Opbouw", video_id: "remote" }], localFilesByVideoId: {} }), false);
});
test("empty and period-marker selections cannot create clips", () => {
  assert.equal(buttonDisabled({ selectedTagIds: [] }), true);
  assert.equal(buttonDisabled({ tags: [{ id: "tag", name: "Start", video_id: "first" }] }), true);
});
test("single-video viewers can use their reconnected file", () => {
  assert.equal(buttonDisabled({ localFile: {}, localFilesByVideoId: undefined, localSourcesReady: undefined }), false);
});
