import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { buildSearchPlan } from '../server/search.js';
import { HttpError } from '../server/cache.js';

async function serve(t, options = {}) {
  const server = createApp({ search: async input => { buildSearchPlan(input.query); return { query: input.query, items: [] }; }, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (url, body, extra = {}) => fetch(url + '/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra.headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('health and frontend are served without upstream access', async t => {
  const url = await serve(t);
  assert.equal((await (await fetch(url + '/api/health')).json()).status, 'ok');
  const home = await fetch(url);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.match(await home.text(), /OpenSeek/);
  assert.equal((await fetch(url + '/app.js', { method: 'HEAD' })).status, 200);
});

test('GET and POST search requests reach the search service', async t => {
  const url = await serve(t);
  assert.equal((await (await post(url, { query: 'markdown' })).json()).query, 'markdown');
  assert.equal((await (await fetch(url + '/api/search?q=rust')).json()).query, 'rust');
});

test('malformed bodies, content types and invalid queries are rejected', async t => {
  const url = await serve(t);
  assert.equal((await post(url, '{broken')).status, 400);
  assert.equal((await post(url, { query: '' })).status, 400);
  assert.equal((await post(url, { query: 'ok' }, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post(url, 'x'.repeat(9000))).status, 413);
  assert.equal((await post(url, null)).status, 400);
});

test('cross-origin requests are rejected and same-origin requests accepted', async t => {
  const url = await serve(t);
  assert.equal((await post(url, { query: 'markdown' }, { headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await post(url, { query: 'markdown' }, { headers: { Origin: 'null' } })).status, 403);
  assert.equal((await post(url, { query: 'markdown' }, { headers: { Origin: url } })).status, 200);
});

test('search rate limit cannot be bypassed with forwarded headers', async t => {
  const url = await serve(t, { rateLimit: 1 });
  assert.equal((await post(url, { query: 'markdown' })).status, 200);
  const limited = await post(url, { query: 'rust' }, { headers: { 'X-Forwarded-For': 'different-ip' } });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('unsupported methods and private filesystem paths are not served', async t => {
  const url = await serve(t);
  assert.equal((await fetch(url + '/api/search', { method: 'DELETE' })).status, 405);
  for (const pathname of ['/.env', '/server/index.js', '/%2e%2e%2f.env', '/%zz', '/api/unknown']) {
    assert.ok([400, 404].includes((await fetch(url + pathname)).status), pathname);
  }
});

test('upstream failures retain structured codes and retry hints', async t => {
  const url = await serve(t, { search: async () => { throw new HttpError(503, 'Upstream limited', { code: 'GITHUB_RATE_LIMIT', retryAfter: 30 }); } });
  const response = await post(url, { query: 'markdown' });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '30');
  assert.equal((await response.json()).error.code, 'GITHUB_RATE_LIMIT');
});
