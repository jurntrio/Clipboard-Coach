const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

test("automatic retention deletes ordinary old clips and leaves archived goal files intact", async () => {
  const clips = [
    { id: "old-goal", archived_goal: true, created_at: "2020-01-01", rendered_segments: [{ key: "goal.mp4" }] },
    { id: "old-normal", archived_goal: false, created_at: "2020-01-01", rendered_segments: [{ key: "normal.mp4" }] },
    { id: "recent", archived_goal: false, created_at: "2099-01-01", rendered_segments: [{ key: "recent.mp4" }] }
  ];
  const removedObjects = [];
  const supabase = { from() {
    let selected = clips, deleting = false;
    const query = { select() { return query; }, eq(key, value) { selected = selected.filter(row => row[key] === value); return query; },
      lt(key, value) { selected = selected.filter(row => row[key] < value); return query; }, order() { return query; }, limit(n) { selected = selected.slice(0, n); return query; },
      delete() { deleting = true; return query; }, then(resolve, reject) {
        if (deleting) for (const row of selected) clips.splice(clips.indexOf(row), 1);
        return Promise.resolve({ data: deleting ? null : selected, error: null }).then(resolve, reject);
      } };
    return query;
  } };
  const source = fs.readFileSync(path.join(__dirname, "../../worker/src/cleanupExpiredClips.ts"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, Set, require: name => name === "./supabase" ? { supabase } : { deleteObject: async key => removedObjects.push(key) } });
  const result = await module.exports.cleanupExpiredClips();
  assert.equal(result.deletedClips, 1);
  assert.deepEqual(clips.map(clip => clip.id), ["old-goal", "recent"]);
  assert.ok(removedObjects.includes("normal.mp4"));
  assert.ok(!removedObjects.includes("goal.mp4"));
});
