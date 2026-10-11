// Every /v1 path the staff frontend calls has a backend route, so a renamed or missing route fails here
// instead of in the browser. Paths are read from the frontend source (the retained legacy app and the
// original modules' '/api/v1/admin/…' view-model paths are not API calls and are skipped). Interpolated
// segments (`${id}`) match any segment; a path that is only a prefix the code extends (`${base}/slots`)
// must be the prefix of a route. The HTTP method isn't checked here: the flow tests exercise each call.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '@hms/db';
import { buildServer, routesOf } from '../server.ts';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../staff-web/src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'legacy' ? [] : files(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** `/v1/…` paths in string and template literals, with the interpolations kept as `${…}`. */
export function frontendPaths(source: string): string[] {
  const out: string[] = [];
  const re = /["'`](\/v1\/(?:[^"'`$?\\]|\$\{(?:[^{}]|\{[^{}]*\})*\})*)/g;
  for (const m of source.matchAll(re)) out.push(m[1]!);
  return out;
}

/** Expands `${a ? "/x" : ""}` suffixes into each literal choice; other interpolations become one segment. */
export function variants(p: string): string[][] {
  const parts = p.split(/(\$\{(?:[^{}]|\{[^{}]*\})*\})/).filter(Boolean);
  let acc = [''];
  for (const part of parts) {
    if (!part.startsWith('${')) {
      acc = acc.map((a) => a + part);
      continue;
    }
    const literals = [...part.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? '');
    acc = acc.flatMap((a) => (a.endsWith('/') || !literals.length ? [a + '\u0000'] : literals.map((l) => a + l)));
  }
  // A conditional can also add a query string (`${all ? "?includeInactive=true" : ""}`): drop it.
  return acc.map((a) => a.split('?')[0]!.replace(/\/+$/, '').split('/').slice(1));
}

const segmentMatches = (front: string, route: string) => front === '\u0000' || route.startsWith(':') || front === route;

function covered(front: string[], routes: string[][], prefixOk: boolean) {
  return routes.some((r) => (r.length === front.length || (prefixOk && r.length > front.length)) && front.every((s, i) => segmentMatches(s, r[i]!)));
}

const db = createDb({ connectionString: 'postgres://unused@127.0.0.1:1/unused', maxConnections: 1 });
const app = buildServer({ db, verifier: async () => Promise.reject(new Error('unused')) });

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('frontend → backend route coverage', () => {
  it('parses interpolations and conditional suffixes', () => {
    expect(frontendPaths('request(`/v1/practitioners/${p.id}/slots?${query({ a: 1 })}`)')).toEqual(['/v1/practitioners/${p.id}/slots']);
    expect(variants('/v1/practitioners/${b.doctor_id}/weekly-plan${preview ? "/preview" : ""}')).toEqual([
      ['v1', 'practitioners', '\u0000', 'weekly-plan', 'preview'],
      ['v1', 'practitioners', '\u0000', 'weekly-plan'],
    ]);
    expect(variants('/v1/facilities${all ? "?includeInactive=true" : ""}')).toEqual([['v1', 'facilities'], ['v1', 'facilities']]);
  });

  it('every /v1 call in the staff frontend has a route', async () => {
    await app.ready();
    const routes = routesOf(app).filter((r) => r.url.startsWith('/v1/')).map((r) => r.url.split('/').slice(1));
    expect(routes.length).toBeGreaterThan(80);
    const calls = files(SRC).flatMap((f) => frontendPaths(readFileSync(f, 'utf8')).map((p) => ({ file: path.relative(SRC, f), p })));
    expect(calls.length).toBeGreaterThan(80);
    const missing = calls.filter(({ p }) => variants(p).some((v) => !covered(v, routes, v.at(-1) === '\u0000')));
    expect(missing).toEqual([]);
  });

  it('the new editing endpoints are registered', async () => {
    await app.ready();
    const have = new Set(routesOf(app).map((r) => `${r.method} ${r.url}`));
    for (const r of [
      'POST /v1/facilities',
      'PATCH /v1/facilities/:facilityId',
      'POST /v1/facilities/:facilityId/departments',
      'PATCH /v1/departments/:departmentId',
      'POST /v1/facilities/:facilityId/consult-rooms',
      'PATCH /v1/consult-rooms/:locationId',
      'POST /v1/departments/:departmentId/services',
      'PATCH /v1/healthcare-services/:healthcareServiceId',
      'PUT /v1/healthcare-services/:healthcareServiceId/fee',
      'PUT /v1/practitioners/:staffId/fees',
      'PUT /v1/practitioners/:staffId/profile',
      'POST /v1/practitioners/:staffId/affiliations',
      'POST /v1/practitioner-affiliations/:affiliationId/end',
      'PATCH /v1/staff/:staffId',
      'PATCH /v1/patients/:patientId',
      'POST /v1/roles/:roleId/retire',
    ]) expect(have, r).toContain(r);
  });
});
