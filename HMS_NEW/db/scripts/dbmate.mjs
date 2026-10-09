// pnpm db:migrate | db:rollback | db:status | db:new <name> — dbmate against DATABASE_URL.
import { config } from './config.mjs';
import { dbmate } from './lib.mjs';

dbmate(config.databaseUrl, process.argv.slice(2));
