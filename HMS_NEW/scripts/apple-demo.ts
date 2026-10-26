// Synthetic local smoke test, deliberately separate from Apple's network and AWS delivery.
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import pg from 'pg';
import { createDb } from '../packages/db/src/index.ts';
import { config } from '../db/scripts/config.mjs';
import { dbmate, applySeeds, enableLocalAppLogin } from '../db/scripts/lib.mjs';
import { createAppleDemoClinic } from '../db/scripts/apple-demo-fixture.ts';
import {
  ingestAppleTranscript,
  processAppleConversation,
} from '../apps/api/src/modules/comms/apple-messages.ts';
import type { AppleBinding } from '../apps/api/src/modules/comms/apple-config.ts';

if (
  config.port !== '54349' ||
  !['127.0.0.1', 'localhost'].includes(new URL(config.adminUrl).hostname)
)
  throw Error(
    'Run the Apple demo against the dedicated local PostgreSQL on PG_PORT=54349.',
  );
const dir = '.apple-demo',
  file = dir + '/state.json';
const demoUrl =
  'postgres://postgres:postgres@127.0.0.1:54349/hms_apple_demo?sslmode=disable';
const appUrl =
  'postgres://hms_app:hms_app_local@127.0.0.1:54349/hms_apple_demo?sslmode=disable';
type Demo = {
  clinic: Awaited<ReturnType<typeof createAppleDemoClinic>>;
  binding: AppleBinding;
  signingSecret: string;
  contactId: string;
};
const save = (value: Demo) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
async function prepare() {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (existsSync(file)) {
    console.log(
      'Local Apple demo already prepared. Existing records preserved.',
    );
    return;
  }
  const admin = new pg.Client({ connectionString: config.adminUrl });
  await admin.connect();
  try {
    if (
      !(
        await admin.query(
          "SELECT 1 FROM pg_database WHERE datname='hms_apple_demo'",
        )
      ).rowCount
    )
      await admin.query('CREATE DATABASE hms_apple_demo');
  } finally {
    await admin.end();
  }
  dbmate(demoUrl, ['up'], { stdio: 'pipe' });
  await applySeeds(demoUrl, [config.referenceSeedsDir]);
  await enableLocalAppLogin();
  const pool = new pg.Pool({ connectionString: demoUrl });
  let clinic: Demo['clinic'];
  try {
    clinic = await createAppleDemoClinic(pool);
  } finally {
    await pool.end();
  }
  const binding: AppleBinding = {
    tenantId: clinic.tenantId,
    facilityId: clinic.facilityId,
    instanceArn: `arn:aws:connect:us-east-1:000000000000:instance/${randomUUID()}`,
    topicArn: 'arn:aws:sns:us-east-1:000000000000:local-demo',
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/000000000000/local-demo',
    sessionTable: 'local-demo',
    localDemo: true,
  };
  const state: Demo = {
    clinic,
    binding,
    signingSecret: randomBytes(32).toString('hex'),
    contactId: randomUUID(),
  };
  save(state);
  const env = {
    PG_PORT: '54349',
    DATABASE_URL: demoUrl,
    APP_DATABASE_URL: appUrl,
    PORT: '3089',
    HOST: '127.0.0.1',
    AUTH_MODE: 'dev',
    PUBLIC_BOOKING_ENABLED: 'true',
    PUBLIC_BOOKING_SITES_JSON: JSON.stringify([clinic.site]),
    PUBLIC_BOOKING_SIGNING_SECRET: state.signingSecret,
    APPLE_CONNECT_ENABLED: 'true',
    APPLE_CONNECT_BINDINGS_JSON: JSON.stringify([binding]),
  };
  writeFileSync(
    dir + '/api.env',
    Object.entries(env)
      .map(([key, value]) => `${key}='${value}'`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  console.log(
    'Synthetic New York clinic prepared, USD 125 consultation. No AWS or Apple connection.',
  );
  console.log('Demo sign-in subject: ' + clinic.ownerSubject);
}
async function send(text: string) {
  const state: Demo = JSON.parse(readFileSync(file, 'utf8'));
  const db = createDb({ connectionString: appUrl, maxConnections: 5 });
  const inboundId = randomUUID();
  try {
    const id = await ingestAppleTranscript(db, state.binding, state.contactId, [
      {
        Id: inboundId,
        Type: 'MESSAGE',
        ParticipantRole: 'CUSTOMER',
        ContentType: 'text/plain',
        Content: text,
        AbsoluteTime: new Date().toISOString(),
      },
    ]);
    const settings = {
      fetcher: fetch,
      booking: {
        sites: [state.clinic.site],
        signingSecret: state.signingSecret,
      },
    };
    for (let n = 0; n < 20; n++)
      if (!(await processAppleConversation(db, state.binding, id, settings)))
        break;
    const pool = new pg.Pool({ connectionString: demoUrl });
    try {
      const { rows } = await pool.query(
        'SELECT o.text_content FROM comms.apple_message o JOIN comms.apple_message i ON i.id=o.reply_to WHERE i.conversation_id=$1 AND i.provider_id=$2',
        [id, inboundId],
      );
      console.log(
        rows[0]?.text_content ??
          'No automated reply (conversation paused or closed).',
      );
      return rows[0]?.text_content as string | undefined;
    } finally {
      await pool.end();
    }
  } finally {
    await db.destroy();
  }
}
const action = process.argv[2] ?? 'prepare';
if (action === 'prepare') await prepare();
else if (action === 'send') await send(process.argv.slice(3).join(' '));
else if (action === 'smoke') {
  const state: Demo = JSON.parse(readFileSync(file, 'utf8'));
  state.contactId = randomUUID();
  save(state);
  let finalReply: string | undefined;
  for (const text of [
    'HI',
    'YES',
    '1',
    '1',
    'Synthetic Demo Visitor',
    '+12125550123',
    'CONFIRM',
  ]) {
    console.log('\nLOCAL VISITOR: ' + text);
    finalReply = await send(text);
  }
  if (!finalReply?.startsWith('Your appointment is confirmed.'))
    throw Error(
      'Local smoke did not receive a committed booking confirmation.',
    );
  console.log(
    '\nLocal conversation only. No message has been delivered through Apple or Amazon.',
  );
} else throw Error('Use prepare, smoke, or send <text>.');
