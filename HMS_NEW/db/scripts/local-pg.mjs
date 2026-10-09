// Runs a local PostgreSQL 18 server from the npm-packaged binaries (embedded-postgres),
// for machines and CI containers without Docker. Usage: node local-pg.mjs start|stop|status
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync, chownSync, rmSync } from 'node:fs';
import { userInfo } from 'node:os';
import path from 'node:path';
import { config } from './config.mjs';

function binDir() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const fromEmbedded = createRequire(createRequire(import.meta.url).resolve('embedded-postgres'));
  const pkg = `@embedded-postgres/${process.platform}-${process.arch}`;
  // The package's export map hides package.json, so resolve its entry point and walk up to the package root.
  let dir = path.dirname(fromEmbedded.resolve(pkg));
  while (!existsSync(path.join(dir, 'native', 'bin'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`PostgreSQL binaries not found in ${pkg}`);
    dir = parent;
  }
  return path.join(dir, 'native', 'bin');
}

// initdb and postgres refuse to run as root; drop to an unprivileged OS user when needed.
const runAs = process.getuid?.() === 0 ? (process.env.PG_OS_USER ?? 'postgres') : null;

function run(bin, args, opts = {}) {
  const exe = path.join(binDir(), bin);
  const [cmd, argv] = runAs ? ['runuser', ['-u', runAs, '--', exe, ...args]] : [exe, args];
  return execFileSync(cmd, argv, { stdio: 'inherit', ...opts });
}

function ownedByRunUser(dir) {
  if (!runAs) return;
  const uid = Number(execFileSync('id', ['-u', runAs]).toString().trim());
  const gid = Number(execFileSync('id', ['-g', runAs]).toString().trim());
  chownSync(dir, uid, gid);
}

function initialise() {
  if (existsSync(path.join(config.dataDir, 'PG_VERSION'))) return;
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  ownedByRunUser(config.dataDir);
  const pwfile = path.join(config.dataDir, '..', '.pg-initpw');
  writeFileSync(pwfile, 'postgres\n', { mode: 0o644 });
  try {
    run('initdb', ['-D', config.dataDir, '-U', 'postgres', '--auth=scram-sha-256', `--pwfile=${pwfile}`, '--encoding=UTF8', '--locale=C.UTF-8']);
  } finally {
    rmSync(pwfile, { force: true });
  }
}

function status() {
  try {
    run('pg_ctl', ['-D', config.dataDir, 'status'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const command = process.argv[2];
if (command === 'start') {
  initialise();
  if (status()) {
    console.log(`PostgreSQL already running on port ${config.port}`);
  } else {
    const opts = `-p ${config.port} -c listen_addresses=127.0.0.1 -k ${config.dataDir}`;
    run('pg_ctl', ['-D', config.dataDir, '-l', path.join(config.dataDir, 'server.log'), '-o', opts, '-w', 'start']);
    console.log(`PostgreSQL started on port ${config.port} (data: ${config.dataDir}, user: ${runAs ?? userInfo().username})`);
  }
} else if (command === 'stop') {
  if (status()) run('pg_ctl', ['-D', config.dataDir, '-m', 'fast', '-w', 'stop']);
  else console.log('PostgreSQL is not running');
} else if (command === 'status') {
  console.log(status() ? `running on port ${config.port}` : 'stopped');
} else {
  console.error('Usage: local-pg.mjs start|stop|status');
  process.exit(1);
}
