const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const compiled = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/lib/recording-camera-blocks.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const loaded = { exports: {} };
vm.runInNewContext(compiled, { exports: loaded.exports, module: loaded });
const { normalizeRecordingCameraBlocks } = loaded.exports;

test('R2 recordings hide source management while local and external sources retain it', () => {
  const { isR2Recording } = loaded.exports;
  assert.equal(isR2Recording({ video_key: 'recordings360/club/match/123/C1.mp4', video_url: '/api/recordings360/video/job' }), true);
  assert.equal(isR2Recording({ video_key: 'legacy', video_url: '/api/recordings360/video/job' }), true);
  assert.equal(isR2Recording({ video_key: 'external/123/ch1', video_url: 'https://camera.example/video.mp4' }), false);
  assert.equal(isR2Recording({ video_key: 'local/file', video_url: 'local://file' }), false);
});

test('all six legacy R2 cameras become selectable in one block without mutating stored data', () => {
  const blocks = Array.from({ length: 6 }, (_, i) => ({ sequence_order: i, is_primary: i === 0,
    videos: { video_key: `recordings360/club/match/123/C${i + 1}.mp4` } }));
  const result = normalizeRecordingCameraBlocks(blocks);
  assert.equal(result.length, 6);
  assert.ok(result.every(block => block.sequence_order === 0));
  assert.equal(result.filter(block => block.is_primary).length, 1);
  assert.equal(blocks[5].sequence_order, 5);
});

test('external and copied cameras stay together, distinct recordings and local videos stay separate', () => {
  const blocks = [
    { sequence_order: 0, is_primary: true, videos: { video_key: 'external/123/ch1' } },
    { sequence_order: 2, is_primary: false, videos: { video_key: 'recordings360/club/match/123/C2.mp4' } },
    { sequence_order: 3, is_primary: true, videos: { video_key: 'external/456/ch1' } },
    { sequence_order: 4, is_primary: true, videos: { video_key: 'local/file' } }
  ];
  const result = normalizeRecordingCameraBlocks(blocks);
  assert.equal(result[1].sequence_order, 0);
  assert.equal(result[2].sequence_order, 3);
  assert.equal(result[3], blocks[3]);
  assert.deepEqual(normalizeRecordingCameraBlocks(result), result);
});

