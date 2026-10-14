import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { request, HmsError, setIdentity } from '../src/hms/client.ts';
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; setIdentity(''); });
test('aborted writes remain uncertain while aborted reads retain normal cancellation', async () => {
  globalThis.fetch = async () => { throw new DOMException('Canceled', 'AbortError'); };
  await assert.rejects(request('/v1/appointments', { method:'POST',body:{} }), (e:any) => e instanceof HmsError && e.code === 'outcome_unknown');
  await assert.rejects(request('/v1/appointments'), (e:any) => e.name === 'AbortError');
});
test('identity changed while a write was pending cannot treat a response as current success', async () => {
  globalThis.fetch = async () => { setIdentity('new-context'); return Response.json({saved:true}); };
  await assert.rejects(request('/v1/appointments', {method:'POST',body:{}}), (e:any) => e instanceof HmsError && e.code === 'context_changed');
});
