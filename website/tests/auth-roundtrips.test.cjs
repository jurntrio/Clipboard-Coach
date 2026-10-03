const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps, extra = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/' + file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: key => deps[key], process: { env: {} }, ...extra });
  return module.exports;
}
test('middleware uses verified claims and preserves request/response cookie refresh', async () => {
  for (const sub of ['user', undefined]) {
    const requestCookies = [], responseCookies = [];
    let authCalls = 0;
    const api = load('supabase/middleware.ts', {
      '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: { getClaims: async () => {
        authCalls++;
        options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true } }]);
        return { data: { claims: { sub } } };
      } } }) },
      'next/server': { NextResponse: { next: () => ({ cookies: { set: (...args) => responseCookies.push(args) } }),
        redirect: url => ({ redirect: url.pathname }) } }
    });
    const request = { nextUrl: { pathname: '/dashboard', clone: () => ({ pathname: '/dashboard' }) },
      cookies: { getAll: () => [], set: (...args) => requestCookies.push(args) } };
    const result = await api.updateSession(request);
    assert.equal(authCalls, 1);
    assert.equal(requestCookies[0][1], 'refreshed');
    assert.equal(responseCookies[0][2].httpOnly, true);
    assert.equal(result.redirect, sub ? undefined : '/login');
    request.nextUrl.pathname = '/tag/public';
    await api.updateSession(request);
    assert.equal(authCalls, 1);
  }
});
test('club context keeps claim identity and metadata; configured email allowlist uses fresh Auth identity', async () => {
  for (const allowlist of ['', 'admin@example.test']) {
    let getUserCalls = 0;
    const claims = { sub: 'user', email: 'old@example.test', user_metadata: { name: 'Name' }, app_metadata: { provider: 'email' } };
    const client = { auth: { getClaims: async () => ({ data: { claims }, error: null }),
      getUser: async () => { getUserCalls++; return { data: { user: { id: 'user', email: 'fresh@example.test' } } }; } } };
    const admin = { from: () => {
      const query = { select() { return query; }, eq() { return query; }, is() { return query; },
        order() { return query; }, maybeSingle() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: null }).then(resolve, reject); } };
      return query;
    } };
    const api = load('auth/active-club.ts', {
      'next/headers': { cookies: () => ({ get: () => undefined }) }, react: { cache: f => f },
      'next/cache': { unstable_cache: f => f }, '@/lib/auth/admin': { isAdminEmail: () => false },
      '@/lib/auth/profile': { getAccountProfile: async () => ({ account_role: 'trainer' }) },
      '@/lib/supabase/admin': { createAdminClient: () => admin }, '@/lib/supabase/server': { createClient: () => client }
    }, { process: { env: { ADMIN_EMAILS: allowlist } } });
    const result = await api.getClubContext();
    assert.equal(result.user.id, 'user');
    assert.equal(result.user.email, allowlist ? 'fresh@example.test' : 'old@example.test');
    assert.equal(getUserCalls, allowlist ? 1 : 0);
    if (!allowlist) {
      assert.equal(result.user.user_metadata.name, 'Name');
      assert.equal(result.user.app_metadata.provider, 'email');
    }
    client.auth.getClaims = async () => ({ data: null, error: { message: 'Invalid JWT' } });
    assert.equal((await api.getClubContext()).user, null);
  }
});
