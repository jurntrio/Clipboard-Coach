// Node 24 strips TypeScript, but older tests omit extensions in relative imports.
// Resolve those imports for tests without changing production module resolution.
const { registerHooks } = require('node:module');
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        return nextResolve(specifier + '.ts', context);
      }
      throw error;
    }
  }
});
