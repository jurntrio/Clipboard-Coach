const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function createClip(failure) {
  const state = [], updates = [], requests = [];
  let slot = 0, refreshed = 0, completed = 0;
  const tag = { id: 'tag', video_id: 'video', name: 'Actie', start_time: 1, end_time: 5 };
  const client = {
    auth: { getUser: async () => {
      if (failure === 'auth') throw new Error('Verbinding verloren');
      return { data: { user: { id: 'coach' } } };
    } },
    from(table) {
      const query = {
        insert() { return query; }, select() { return query; },
        update(value) { updates.push({ table, value }); return query; },
        eq() { return query; },
        single: async () => ({ data: { id: 'clip' }, error: null }),
        then(resolve, reject) {
          return Promise.resolve(table === 'clip_segments'
            ? { data: [{ id: 'segment', sequence_order: 0 }], error: failure === 'segments' ? { message: 'Fragmenten mislukt' } : null }
            : { data: null, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const jsx = (type, props) => ({ type, props });
  const deps = {
    react: { useEffect() {}, useState(initial) {
      const index = slot++;
      state[index] = index === 0 ? ['tag'] : index === 8 || index === 10 ? true : typeof initial === 'function' ? initial() : initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-dom': { createPortal: element => element },
    '@/lib/supabase/client': { createClient: () => client },
    '@/lib/utils': { formatTime: String, getPlayerDisplayName: () => '' },
    '@/lib/tags': { isPeriodMarker: () => false },
    '@/i18n/client': { useI18n: () => ({ t: key => key }) },
    '@/lib/clip-images': { emptyClipImages: () => ({ opening: null, tags: {} }), parseClipImages: value => value }
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/components/clips/ClipBuilder.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Error, document: { body: {}, querySelector: () => null },
    require: name => deps[name] || {},
    fetch: async (url, options) => {
      requests.push({ url, method: options.method });
      if (failure === 'network') throw new Error('Netwerkfout');
      return { ok: failure !== 'worker', json: async () => ({ error: 'Worker niet beschikbaar' }) };
    }
  });
  const tree = module.exports.ClipBuilder({ videoId: 'video', teamId: 'team', selectedTagIds: ['tag'],
    tags: [tag], players: [], localVideo: false, localFile: null,
    onClipsChanged: () => refreshed++, onClipCreated: () => completed++ });
  function buttons(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(buttons);
    return [...(node.type === 'button' ? [node] : []), ...buttons(node.props?.children)];
  }
  buttons(tree).at(-1).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  return { state, updates, requests, refreshed, completed };
}

test('worker and network failures preserve the saved clip, show the error and refresh the list', async () => {
  for (const failure of ['worker', 'network', 'segments']) {
    const result = await createClip(failure);
    assert.equal(result.state[4], false);
    assert.ok(result.state[7]);
    assert.equal(result.completed, 0);
    assert.equal(result.refreshed, 1);
    assert.ok(result.updates.some(update => update.value.render_status === 'failed'));
    assert.ok(result.requests.every(request => request.method !== 'DELETE'));
  }
});

test('unexpected authentication failures restore the create button and show an error', async () => {
  const result = await createClip('auth');
  assert.equal(result.state[4], false);
  assert.equal(result.state[7], 'Verbinding verloren');
  assert.equal(result.refreshed, 0);
});

test('successful creation closes the dialog and refreshes the saved clips', async () => {
  const result = await createClip();
  assert.equal(result.state[4], false);
  assert.equal(result.state[8], false);
  assert.equal(result.state[7], '');
  assert.equal(result.completed, 1);
  assert.equal(result.refreshed, 1);
});
