const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ authenticated = true, allowed = true, teamAllowed = true, matchExists = true } = {}) {
  const calls = [];
  const match = matchExists ? { id: 'match', club_id: 'club', club_team_id: 'club-team', team_a_id: 'team', match_videos: [] } : null;
  function client(scope) {
    return { auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'user' } : null } }) },
      from(table) {
        const filters = [];
        const query = { select() { return query; }, eq(k, v) { filters.push(['eq', k, v]); return query; },
          neq(k, v) { filters.push(['neq', k, v]); return query; }, order(k) { filters.push(['order', k]); return query; },
          in() { return query; }, maybeSingle() { return query; },
          then(resolve, reject) {
            calls.push({ scope, table, filters });
            const data = table === 'matches' ? match : table === 'players' ? [{ id: 'visible-player' }]
              : table === 'standard_tags' ? [{ id: 'personal-tag' }] : [];
            return Promise.resolve({ data }).then(resolve, reject);
          } };
        return query;
      } };
  }
  const deps = {
    'next/server': { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), options) } },
    '@/lib/supabase/server': { createClient: () => client('user') },
    '@/lib/supabase/admin': { createAdminClient: () => client('admin') },
    '@/lib/auth/club-access': { getClubAccess: async () => ({ role: 'trainer', readOnly: false }),
      hasClubPermission: () => allowed, canAccessTeam: () => teamAllowed },
    '@/lib/auth/match-video-sources': { canManageMatchVideoSources: () => false }
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/matches/[id]/viewer/route.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: key => deps[key], Response });
  return { calls, get: () => module.exports.GET({}, { params: { id: 'match' } }) };
}
test('viewer returns identity, RLS-visible roster and personal tags with unchanged filters', async () => {
  const f = fixture();
  const response = await f.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentUserId, 'user');
  assert.deepEqual(body.players, [{ id: 'visible-player' }]);
  assert.deepEqual(body.standardTags, [{ id: 'personal-tag' }]);
  assert.deepEqual(f.calls.find(c => c.table === 'players'), { scope: 'user', table: 'players',
    filters: [['eq', 'team_id', 'team'], ['neq', 'role', 'staff'], ['order', 'last_name']] });
  assert.deepEqual(f.calls.find(c => c.table === 'standard_tags'), { scope: 'user', table: 'standard_tags',
    filters: [['eq', 'coach_id', 'user'], ['order', 'created_at']] });
});
test('401, 403 and 404 never fetch or expose roster or personal tags', async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ allowed: false }, 403],
    [{ teamAllowed: false }, 403], [{ matchExists: false }, 404]]) {
    const f = fixture(options);
    const response = await f.get();
    assert.equal(response.status, status);
    assert.equal(f.calls.some(c => ['players', 'standard_tags'].includes(c.table)), false);
    assert.equal((await response.json()).currentUserId, undefined);
  }
});
