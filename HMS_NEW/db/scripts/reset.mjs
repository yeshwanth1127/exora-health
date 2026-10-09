// pnpm db:reset [--test] — drops and recreates the dev (or test) database, migrates and seeds it.
// Dev seeds are loaded only into the dev database.
import { config } from './config.mjs';
import { resetDatabase } from './lib.mjs';

const test = process.argv.includes('--test');
const url = test ? config.testDatabaseUrl : config.databaseUrl;
await resetDatabase(url, { devSeeds: !test });
console.log(`Reset ${new URL(url).pathname.slice(1)}: migrated and seeded`);
