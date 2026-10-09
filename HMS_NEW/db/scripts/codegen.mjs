// pnpm db:codegen — regenerates packages/db/src/generated/db.ts from the dev database schema.
// Run after every migration (pnpm db:reset first).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, config } from './config.mjs';

const schemas = ['platform', 'patient', 'catalog', 'booking'];
const outFile = path.join(ROOT, 'packages', 'db', 'src', 'generated', 'db.ts');
execFileSync(
  path.join(ROOT, 'node_modules', '.bin', 'kysely-codegen'),
  [
    '--dialect', 'postgres',
    '--url', config.databaseUrl,
    '--out-file', outFile,
    '--date-parser', 'string',
    '--include-pattern', `(${schemas.join('|')}).*`,
    '--exclude-pattern', '*.*_y[0-9][0-9][0-9][0-9]m[0-9][0-9]',
  ],
  { stdio: 'inherit' },
);

// packages/db parses int8 (money in paise, counters) to JS numbers, so type them that way too.
const generated = readFileSync(outFile, 'utf8');
const patched = generated.replace(
  'export type Int8 = ColumnType<string, bigint | number | string, bigint | number | string>;',
  'export type Int8 = ColumnType<number, bigint | number | string, bigint | number | string>;',
);
if (patched === generated) throw new Error('codegen: Int8 type definition not found; update the patch in codegen.mjs');
writeFileSync(outFile, patched);
