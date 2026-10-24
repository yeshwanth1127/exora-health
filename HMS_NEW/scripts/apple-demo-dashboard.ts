import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const state = JSON.parse(readFileSync('.apple-demo/state.json', 'utf8'));
if (!state.binding?.localDemo)
  throw Error('This launcher is for the isolated synthetic demo only.');
const api = spawn(
  process.execPath,
  ['--env-file=.apple-demo/api.env', '--import', 'tsx', 'apps/api/src/main.ts'],
  { stdio: 'inherit' },
);
const web = spawn(
  'corepack',
  [
    'pnpm',
    '--filter',
    '@hms/staff-web',
    'dev',
    '--host',
    '127.0.0.1',
    '--port',
    '5209',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      HMS_API_PROXY_TARGET: 'http://127.0.0.1:3089',
      VITE_HMS_DEV_LOGIN: 'true',
      VITE_HMS_DEFAULT_SUBJECT: state.clinic.ownerSubject,
    },
  },
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  api.kill('SIGTERM');
  web.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const child of [api, web]) {
  child.on('exit', stop);
  child.on('error', stop);
}
console.log(
  'Synthetic Apple demo dashboard: http://127.0.0.1:5209/staff/apple_messages',
);
console.log('No Apple or Amazon delivery is enabled by this demo launcher.');
