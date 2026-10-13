// Read-only source inventory. Requires TypeScript in the chosen staff-web node_modules.
// Usage: node collect.cjs <staff-web> <HMS_NEW backend directory> <output directory>
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const [staffArg, backendArg, outputArg] = process.argv.slice(2);
if (!staffArg || !backendArg || !outputArg) throw new Error('Expected staff-web, backend, and output paths');
const staff = path.resolve(staffArg), backend = path.resolve(backendArg), output = path.resolve(outputArg);
const ts = createRequire(path.join(staff, 'package.json'))('typescript');
const files = root => fs.readdirSync(root, { withFileTypes: true }).flatMap(e => {
  const p = path.join(root, e.name);
  return e.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
});
const uiCalls = [], backendRoutes = [], hashes = [];
const prefixes = { wa: '/api/v1/admin/whatsapp', prefix: '/api/v1/admin', ROOT: '/api/v1/web/booking' };
function expression(node, sf) { return node ? node.getText(sf) : ''; }
function render(node, sf) {
  if (!node) return '';
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isIdentifier(node)) return prefixes[node.text] ?? `{${node.text}}`;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map(s =>
    (ts.isIdentifier(s.expression) && prefixes[s.expression.text] ? prefixes[s.expression.text] : `{${expression(s.expression, sf)}}`) + s.literal.text).join('');
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return render(node.left, sf) + render(node.right, sf);
  return `{${expression(node, sf)}}`;
}
function methodOf(node, sf) {
  if (node && ts.isStringLiteralLike(node)) return node.text;
  if (!node || !ts.isObjectLiteralExpression(node)) return node ? 'DYNAMIC' : 'GET';
  const method = node.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(sf) === 'method');
  return method ? (ts.isStringLiteralLike(method.initializer) ? method.initializer.text : expression(method.initializer, sf)) : 'GET';
}
function scan(file, root, kind) {
  const content = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  hashes.push({ tree: kind, file: path.relative(root, file), sha256: crypto.createHash('sha256').update(content).digest('hex') });
  function visit(n) {
    if (ts.isCallExpression(n)) {
      const callee = expression(n.expression, sf);
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      if (kind === 'staff' && ['api', 'useResource', 'fetch', 'request', 'recordingBlob', 'uploadTo', 'assetUrl'].includes(callee)) {
        let method = callee === 'useResource' || callee === 'assetUrl' ? 'GET' : callee === 'recordingBlob' || callee === 'uploadTo' ? 'POST' : methodOf(n.arguments[1], sf);
        if (callee === 'request' && file.endsWith('/talk.tsx')) method = n.arguments[1] ? 'POST' : 'GET';
        const pattern = callee === 'assetUrl' ? '/api/v1/admin/whatsapp/assets/' + render(n.arguments[0], sf) : render(n.arguments[0], sf);
        uiCalls.push({ file: path.relative(root, file), line, callee, method, pathPattern: pattern, pathExpression: expression(n.arguments[0], sf) });
      }
      if (kind === 'backend' && /^app\.(get|post|put|patch|delete)$/.test(callee)) {
        const pattern = render(n.arguments[0], sf);
        const paths = pattern.includes('{action}') ? ['start', 'complete', 'skip'].map(a => pattern.replace('{action}', a)) : [pattern];
        for (const route of paths) backendRoutes.push({ file: path.relative(root, file), line, method: callee.split('.')[1].toUpperCase(), path: route, conditional: route === '/dev/login' ? 'devLogin enabled only' : null });
      }
    }
    if (kind === 'staff' && ts.isJsxAttribute(n) && n.name.getText(sf) === 'href' && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression) {
      const pattern = render(n.initializer.expression, sf);
      if (pattern.startsWith('/api/')) uiCalls.push({ file: path.relative(root, file), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, callee: 'href', method: 'GET', pathPattern: pattern, pathExpression: expression(n.initializer.expression, sf) });
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
}
files(path.join(staff, 'src')).forEach(f => scan(f, staff, 'staff'));
[path.join(backend, 'apps/api/src/server.ts'), ...files(path.join(backend, 'apps/api/src/http/routes'))].forEach(f => scan(f, backend, 'backend'));
const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const snapshot = {
  capturedAt: new Date().toISOString(),
  staff: { path: staff, head: git(staff, ['rev-parse', 'HEAD']), branch: git(staff, ['branch', '--show-current']), status: git(staff, ['status', '--porcelain']) },
  backend: { path: backend, head: git(backend, ['rev-parse', 'HEAD']), branch: git(backend, ['branch', '--show-current']) },
  counts: { uiCallSites: uiCalls.length, backendRoutes: backendRoutes.length, hashedSourceFiles: hashes.length },
  limitations: ['Static inventory; wrapper arguments and computed expressions remain explicit.', 'Backend loop expansion handles the current queue action loop only.', 'No API requests, database resets, provider calls, or application changes are performed.', 'Presence of a route is not runtime, authorization, or deployment acceptance.'],
  hashes,
};
fs.mkdirSync(output, { recursive: true });
for (const [name, data] of [['ui-api-calls.json', uiCalls], ['backend-routes.json', backendRoutes], ['snapshot.json', snapshot]]) fs.writeFileSync(path.join(output, name), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(snapshot.counts));
