import test from 'node:test';
import assert from 'node:assert/strict';
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
let instance = 0;
async function client() { return import(`../api.js?test=${instance++}`); }
test('modification fetches CSRF and uses a same-origin cookie and stable idempotency key', async () => {
  const calls = []; globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return path.endsWith('/csrf') ? response(200, { headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' }) : response(201, { id: '1' });
  };
  const { api } = await client();
  assert.deepEqual(await api('/api/reservations', { method: 'POST', body: { placeId: '20' }, headers: { 'Idempotency-Key': 'stable' } }), { id: '1' });
  assert.equal(calls.length, 2); assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'synthetic-token');
  assert.equal(calls[1].options.headers['Idempotency-Key'], 'stable');
  assert.equal(calls[1].options.body, '{"placeId":"20"}');
});
test('a CSRF refusal renews the token and retries once with the same body and key', async () => {
  let tokens = 0, requests = 0; const keys = [];
  globalThis.fetch = async (path, options) => {
    if (path.endsWith('/csrf')) return response(200, { headerName: 'X-CSRF-TOKEN', token: `token-${++tokens}` });
    keys.push(options.headers['Idempotency-Key']); requests++;
    return requests === 1 ? response(403, { code: 'CSRF_INVALID' }) : response(201, { id: '1' });
  };
  const { api } = await client();
  await api('/api/reservations', { method: 'POST', body: {}, headers: { 'Idempotency-Key': 'same' } });
  assert.equal(tokens, 2); assert.deepEqual(keys, ['same', 'same']);
});
test('does not endlessly retry CSRF or retry a business refusal', async () => {
  let attempts = 0; globalThis.fetch = async path => path.endsWith('/csrf')
    ? response(200, { headerName: 'X-CSRF-TOKEN', token: 'test' })
    : (++attempts, response(403, { code: 'CSRF_INVALID', message: 'Refus' }));
  const { api, ApiError } = await client();
  await assert.rejects(api('/api/reservations', { method: 'POST' }), error => error instanceof ApiError && error.status === 403);
  assert.equal(attempts, 2);
  attempts = 0; globalThis.fetch = async () => (++attempts, response(409, { code: 'RESERVATION_CONFLICT', message: 'Conflit' }));
  await assert.rejects(api('/api/reservations', { method: 'POST' }), /Conflit/); assert.equal(attempts, 1);
});
test('network failures do not silently repeat a modification', async () => {
  let attempts = 0; globalThis.fetch = async path => {
    if (path.endsWith('/csrf')) return response(200, { headerName: 'X-CSRF-TOKEN', token: 'test' });
    attempts++; throw new TypeError('network');
  };
  const { api } = await client();
  await assert.rejects(api('/api/reservations', { method: 'POST' }), error => error.code === 'NETWORK_UNAVAILABLE');
  assert.equal(attempts, 1);
});
test('login is form encoded and logout accepts a 204 response', async () => {
  const calls = []; globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    if (path.endsWith('/csrf')) return response(200, { headerName: 'X-CSRF-TOKEN', token: 'test' });
    return response(path.endsWith('/logout') ? 204 : 200, {});
  };
  const { api } = await client();
  await api('/api/auth/login', { method: 'POST', body: new URLSearchParams({ email: 'test@example.test', password: 'synthetic' }) });
  assert.equal(calls[1].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(await api('/api/auth/logout', { method: 'POST' }), null);
});
