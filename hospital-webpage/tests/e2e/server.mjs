// Production builds through one origin, plus isolated signed-webhook transport.
// Test controls bind only to loopback and are never bundled into the website.
import { createServer, request as httpRequest } from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, stat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const website = process.cwd();
const backendRoot = process.env.HMS_E2E_BACKEND_PATH;
if (!backendRoot) throw new Error('Set HMS_E2E_BACKEND_PATH to the compatible hms-backend checkout. See specs/website-test-results.md.');
const directory = await realpath(await mkdtemp(join(tmpdir(), 'hms-e2e-')));
const secret = randomBytes(32).toString('hex');
const origin = 'http://127.0.0.1:4187';
// Every scenario replays patients and staff from one loopback address; rate limits are unit-tested in the backend.
const env = { ...process.env, APP_ENV: 'development', DEMO_MODE: 'false',
  DATABASE_URL: `sqlite:///${join(directory, 'clinic.db')}`, MEDIA_DIR: join(directory, 'uploads'),
  MEDIA_SCAN_SOCKET: '', ADMIN_API_KEY: secret, VOICE_SERVICE_API_KEY: secret,
  WHATSAPP_SERVICE_API_KEY: secret, WHATSAPP_OWNER_SECRET: secret,
  WEB_BOOKING_ENABLED: 'true', WEB_BOOKING_ORIGIN: origin, STAFF_ORIGIN: origin,
  WHATSAPP_BOOKING_NUMBER: '919700000000', WHATSAPP_OUTREACH_ENABLED: 'false',
  POSTHOG_GROWTH_ENABLED: 'false', RATE_LIMITS_ENABLED: 'false', SARVAM_API_KEY: '', SARVAM_APP_VERSION: '',
  HMS_E2E_DIRECTORY: directory, HMS_E2E_BACKEND_PATH: resolve(backendRoot) };
const python = join(backendRoot, '.venv/bin/python');
function pythonRun(args, cwd = backendRoot, input) {
  const run = spawnSync(python, args, { cwd, env, input, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || run.error?.message || 'Test Python process failed');
  return run.stdout;
}
function fixture(command, data = {}) {
  return JSON.parse(pythonRun([join(website, 'tests/e2e/backend_fixture.py'), command], backendRoot, JSON.stringify(data)));
}
const running = [];
let api;
let stopping = false;
async function close() {
  if (stopping) return;
  stopping = true;
  for (const server of running) server.closeAllConnections?.();
  await Promise.all(running.map(server => new Promise(done => server.close(done))));
  if (api && api.exitCode === null) {
    const exited = new Promise(done => api.once('exit', done));
    api.kill('SIGTERM');
    await Promise.race([exited, delay(3000)]);
    if (api.exitCode === null) api.kill('SIGKILL');
  }
  await rm(directory, { recursive: true, force: true });
  await rm(join(website, '.e2e'), { recursive: true, force: true });
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => void close().then(() => process.exit(0)));
process.on('uncaughtException', error => { console.error(error.message); void close().then(() => process.exit(1)); });
async function listen(server, port = 0) {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  running.push(server);
  return server.address().port;
}
const portProbe = createServer();
const apiPort = await listen(portProbe);
await new Promise(done => portProbe.close(done)); running.pop();
pythonRun(['-m', 'alembic', 'upgrade', 'head']);
api = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(apiPort), '--no-access-log'],
  { cwd: backendRoot, env, stdio: ['ignore', 'ignore', 'pipe'] });
let diagnostics = '';
api.stderr.on('data', bytes => { diagnostics = (diagnostics + bytes).slice(-3000); });
const apiUrl = `http://127.0.0.1:${apiPort}`;
let ready = false;
for (let i = 0; i < 100; i++) {
  ready = await fetch(apiUrl + '/api/health/ready').then(r => r.ok).catch(() => false);
  if (ready || api.exitCode !== null) break;
  await delay(100);
}
if (!ready) throw new Error(`Disposable API failed to start: ${diagnostics}`);
fixture('reset');
const { createBackendClient } = await import(pathToFileURL(join(backendRoot, 'whatsapp-bot/backend-client.mjs')));
const { createLiveEngine } = await import(pathToFileURL(join(backendRoot, 'whatsapp-bot/live-engine.mjs')));
const { createWebhookServer, createInboundWorker } = await import(pathToFileURL(join(backendRoot, 'whatsapp-bot/server.mjs')));
const backend = createBackendClient({ baseUrl: apiUrl, serviceKey: secret });
const engine = createLiveEngine({ backend, clinicReady: false, requireReference: true });
const sendText = async () => {}; // All outbound transport is simulated.
sendText.sendResponse = async () => {};
const worker = createInboundWorker({ backend, engine, sendText });
const { server: webhookServer } = createWebhookServer({ appSecret: secret, verifyToken: 'fictional',
  phoneNumberId: '123456', engine, sendText, enqueueInbound: backend.enqueueInbound, checkReady: backend.inboundReady });
const webhookPort = await listen(webhookServer);
let sequence = 0;
const controls = createServer(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${secret}`) { res.writeHead(403).end(); return; }
  try {
    let raw = ''; for await (const bytes of req) raw += bytes;
    const data = JSON.parse(raw || '{}');
    let result;
    if (req.url === '/verify') {
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
        metadata: { phone_number_id: '123456' }, messages: [{ id: `wamid.e2e-${++sequence}`,
          from: data.sender, type: 'text', text: { body: data.text } }],
      } }] }] });
      const response = await fetch(`http://127.0.0.1:${webhookPort}/webhook`, { method: 'POST', body,
        headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}` } });
      if (!response.ok || !await worker()) throw new Error('Signed webhook/worker did not process verification');
      result = { processed: true };
    } else result = fixture(req.url.slice(1), data);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
  } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message })); }
});
const controlPort = await listen(controls);
const { mkdir } = await import('node:fs/promises');
await mkdir(join(website, '.e2e'), { recursive: true });
await writeFile(join(website, '.e2e/runtime.json'), JSON.stringify({ control: `http://127.0.0.1:${controlPort}`, token: secret }), { mode: 0o600 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' };
const proxy = createServer(async (req, res) => {
  if (req.url === '/__ready') { res.writeHead(200).end('ready'); return; }
  const pathname = new URL(req.url, origin).pathname;
  if (/^\/(api|staff|book|talk|admin|whatsapp-assets)(\/|$)/.test(pathname)) {
    const upstream = httpRequest(apiUrl + req.url, { method: req.method, headers: req.headers }, upstreamResponse => {
      res.writeHead(upstreamResponse.statusCode, upstreamResponse.headers); upstreamResponse.pipe(res);
    });
    upstream.on('error', () => res.writeHead(502).end('Test backend unavailable'));
    req.pipe(upstream); return;
  }
  try {
    const dist = join(website, 'dist');
    let file = resolve(dist, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(dist + '/')) file = join(dist, 'index.html');
    if (!await stat(file).then(s => s.isFile()).catch(() => false)) {
      if (extname(pathname)) { res.writeHead(404).end('Not found'); return; }
      file = join(dist, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(500).end('Build the website before running E2E'); }
});
await listen(proxy, 4187);
console.log('Disposable clinic and built website ready; outbound provider transport is simulated.');
