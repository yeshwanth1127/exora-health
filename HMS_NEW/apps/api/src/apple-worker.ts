// Runs locally with AWS credentials. No public HTTP callback or inbound tunnel is necessary.
import { createDb } from '@hms/db';
import { config } from '../../../db/scripts/config.mjs';
import { loadAppleSettings } from './modules/comms/apple-config.ts';
import { loadManagedSettings } from './modules/comms/managed-config.ts';
import {
  AmazonAppleTransport,
  appleWake,
  reconcileAppleContact,
  flushAppleReplies,
} from './modules/comms/apple-connect.ts';

const settings = loadAppleSettings(),
  managed = loadManagedSettings();
if (!settings.bindings.length)
  throw Error(
    'Apple Connect is disabled. Configure the demo clinic binding first.',
  );
const db = createDb({
  connectionString: config.appDatabaseUrl,
  maxConnections: 5,
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
  });
async function loop(binding: (typeof settings.bindings)[number]) {
  const transport = new AmazonAppleTransport(binding);
  while (!stopping) {
    try {
      for (const message of await transport.receive()) {
        if (!message.Body || !message.ReceiptHandle) continue;
        try {
          const contactId = appleWake(message.Body, binding);
          await reconcileAppleContact(
            db,
            binding,
            contactId,
            managed,
            transport,
          );
          await transport.acknowledge(message.ReceiptHandle);
        } catch {
          // Leave unsuccessful wakes for retry/DLQ without blocking other contacts or staff replies.
          console.error(
            'Apple Connect notification pending retry. Check clinic readiness and the dead-letter queue.',
          );
        }
      }
      await flushAppleReplies(db, binding, transport);
    } catch {
      // Never log participant tokens, transcript content, customer identifiers or raw AWS errors.
      console.error(
        'Apple Connect worker will retry. Check AWS access, the queue and clinic readiness.',
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
try {
  await Promise.all(settings.bindings.map(loop));
} finally {
  await db.destroy();
}
