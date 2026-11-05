const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ allowed = true, linked = true, missing = false, sources } = {}) {
  const reads = [], signed = [];
  const video = { id: 'camera', video_url: '/api/recordings360/video/86b28450-32fd-4635-8f36-9fc3cadabd0a' };
  const rows = {
    clip_segments: sources ?? [{ videos: video }, { videos: video }],
    recording_copy_jobs: missing ? null : { object_key: 'private-recording.mp4', recording_copy_plans: { match_id: 'match' } },
    matches: { club_id: 'club', club_team_id: 'team', match_videos: linked ? [{ video_id: 'camera' }] : [] }
  };
  const admin = { from(table) {
    const read = { table, filters: [] }; reads.push(read);
    const query = { select() { return query; }, eq(...args) { read.filters.push(args); return query; },
      maybeSingle() { return query; }, then(resolve, reject) { return Promise.resolve({ data: rows[table], error: null }).then(resolve, reject); } };
    return query;
  } };
  const deps = {
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/auth/club-access': { getClubAccess: async () => ({}), canAccessTeam: () => allowed, hasClubPermission: () => allowed },
    '@/lib/recordings360-download': { getRecordingDownloadUrl: async key => { signed.push(key); return 'https://storage.test/signed-camera'; } }
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/clip-recording-sources.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Error, require: key => deps[key] });
  return { reads, signed, resolve: () => module.exports.clipRecordingSources('clip', { id: 'maker' }) };
}

test('R2 camera routes become temporary source URLs once per selected video', async () => {
  const f = fixture();
  assert.equal(JSON.stringify(await f.resolve()), JSON.stringify({ camera: 'https://storage.test/signed-camera' }));
  assert.deepEqual(f.signed, ['private-recording.mp4']);
  assert.ok(f.reads.find(read => read.table === 'recording_copy_jobs').filters.some(([key, value]) => key === 'status' && value === 'done'));
});

test('inaccessible, unrelated and unfinished recordings never receive signed URLs', async () => {
  for (const options of [{ allowed: false }, { linked: false }, { missing: true }]) {
    const f = fixture(options);
    await assert.rejects(f.resolve());
    assert.equal(f.signed.length, 0);
  }
});

test('public and local sources keep the existing render paths', async () => {
  const f = fixture({ sources: [{ videos: { id: 'remote', video_url: 'https://video.test/file.mp4' } }, { videos: { id: 'local', video_url: 'local://file.mp4' } }] });
  assert.equal(JSON.stringify(await f.resolve()), '{}');
  assert.equal(f.reads.length, 1);
});
