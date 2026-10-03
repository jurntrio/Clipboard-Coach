const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, deps) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: key => deps[key], Set, Date });
  return module.exports;
}
const options = load('../src/lib/club-access-options.ts', {});
function fixture(bundle, rpcError = null, reference = false) {
  const calls = [];
  const rows = {
    profiles: bundle.profile, person_accounts: bundle.clubPerson ? { person_id: 'person' } : null,
    club_people: bundle.clubPerson, club_role_assignments: bundle.roles,
    club_trainers: { id: 'trainer' }, club_role_permission_defaults: bundle.configuredDefaults,
    player_group_staff: bundle.playerAssignments
  };
  const admin = {
    async rpc(name, args) { calls.push(name); assert.deepEqual(JSON.parse(JSON.stringify(args)), { p_club_id: 'club', p_user_id: 'user' }); return { data: bundle, error: rpcError }; },
    from(table) {
      calls.push(table);
      const query = { select() { return query; }, eq() { return query; }, is() { return query; },
        maybeSingle() { return query; }, lte() { return query; }, or() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: rows[table] }).then(resolve, reject); } };
      return query;
    }
  };
  const api = load(reference ? 'fixtures/club-access-before.ts' : '../src/lib/auth/club-access.ts', {
    react: { cache: f => f }, '@/lib/auth/admin': { isAdminEmail: email => email === 'admin@example.test' },
    '@/lib/auth/profile': { getAccountProfile: async () => bundle.profile },
    '@/lib/supabase/admin': { createAdminClient: () => admin }, '@/lib/club-access-options': options
  });
  return { calls, get: (email = null) => api.getClubAccess('club', { id: 'user', email }) };
}
const role = (role_type, extra = {}) => ({ id: role_type, role_type, club_team_id: null,
  team_scope: 'assigned', valid_from: '2020-01-01', valid_until: null, club_role_permission_overrides: [], ...extra });
const base = roles => ({ profile: { account_role: 'trainer' }, clubPerson: { id: 'person' },
  roles, configuredDefaults: [], playerAssignments: [] });
function normalized(value) {
  return JSON.parse(JSON.stringify({ ...value, permissions: [...value.permissions].sort(), teamIds: value.teamIds && [...value.teamIds].sort(),
    goalkeeperPlayerIds: value.goalkeeperPlayerIds && [...value.goalkeeperPlayerIds].sort() }));
}

test('RPC and undeployed fallback equal the pre-change algorithm for all role families', async () => {
  const families = ['club_admin', 'club_admin_viewer', 'technical_director', 'head_youth_development',
    'youth_coordinator', 'trainer', 'assistant_trainer', 'video_analyst', 'communications',
    'commercial_manager', 'sponsor_viewer', 'scout', 'goalkeeper_coach', 'volunteer'];
  const cases = families.map(name => base([role(name), role(name, { id: name + '-team', club_team_id: 'team' })]));
  cases.push(base([]), { ...base([role('trainer')]), clubPerson: null },
    { ...base([]), profile: { account_role: 'platform_admin' } },
    base([role('trainer', { team_scope: 'all' }), role('video_analyst')]),
    base([role('trainer', { club_role_permission_overrides: [{ permission_key: 'games.tag', enabled: false },
      { permission_key: 'teams.manage_all', enabled: true }, { permission_key: 'games.scouting.manage', enabled: true }] })]),
    { ...base([role('trainer')]), configuredDefaults: [{ function_role: 'trainer', permission_key: 'games.view', enabled: true },
      { function_role: 'trainer', permission_key: 'video.view', enabled: false }] },
    { ...base([role('goalkeeper_coach')]), playerAssignments: [{ player_groups: { player_group_players: [
      { player_id: 'current', valid_until: null }, { player_id: 'ended', valid_until: '2026-01-01' }] } }] });
  for (const bundle of cases) {
    const expected = normalized(await fixture(bundle, null, true).get());
    const rpc = fixture(bundle);
    assert.deepEqual(normalized(await rpc.get()), expected);
    assert.deepEqual(rpc.calls, ['club_access_bundle']);
    for (const code of ['42883', 'PGRST202']) {
      assert.deepEqual(normalized(await fixture(bundle, { code }).get()), expected);
    }
  }
});
test('explicit expected permissions, configured denials, keeper scope and email admin remain intact', async () => {
  const access = await fixture({ ...base([role('trainer')]), configuredDefaults: [
    { function_role: 'trainer', permission_key: 'games.view', enabled: true },
    { function_role: 'trainer', permission_key: 'video.view', enabled: false }] }).get();
  assert.deepEqual([...access.permissions], ['games.view']);
  const denied = await fixture(base([])).get();
  assert.equal(denied.exists, false);
  assert.equal(denied.permissions.size, 0);
  const adminFixture = fixture(base([]));
  const admin = await adminFixture.get('admin@example.test');
  assert.equal(admin.role, 'platform_admin');
  assert.equal(admin.teamIds, null);
  assert.deepEqual(adminFixture.calls, []);
  const keeper = await fixture({ ...base([role('goalkeeper_coach')]), playerAssignments: [
    { player_groups: { player_group_players: [{ player_id: 'active', valid_until: null },
      { player_id: 'expired', valid_until: '2026-01-01' }] } }] }).get();
  assert.deepEqual([...keeper.goalkeeperPlayerIds], ['active']);
});
test('other RPC failures and malformed bundles never silently grant access or fallback', async () => {
  const f = fixture(base([role('trainer')]), { code: '42501' });
  await assert.rejects(f.get(), /Club access bundle failed/);
  assert.deepEqual(f.calls, ['club_access_bundle']);
  await assert.rejects(fixture({ ...base([]), roles: null }).get(), /Invalid club access bundle/);
});
