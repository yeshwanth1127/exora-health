import { registerHooks } from "node:module";

// Node SSR checks exercise markup and application bindings. Vite resolves the
// real CSS in the production build; these tests only need stable module names.
registerHooks({
  load(url, context, nextLoad) {
    if (new URL(url).pathname.endsWith(".css")) return {
      format: "module", shortCircuit: true,
      source: 'export default new Proxy({}, { get: (_, key) => String(key) });',
    };
    return nextLoad(url, context);
  },
});
