import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubClient, safeGitHubUrl } from '../server/github.js';

test('only official HTTPS GitHub links are allowed', () => {
  assert.ok(safeGitHubUrl('https://github.com/a/b'));
  for (const url of ['javascript:alert(1)', 'http://github.com/a/b', 'https://github.com.evil.test/a', 'https://user:pass@github.com/a']) assert.equal(safeGitHubUrl(url), null);
});

test('GitHub JSON requests are authenticated only on the server and cached', async () => {
  let calls = 0;
  const client = createGitHubClient({ token: 'test-only-token', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, 'https://api.github.com');
    assert.equal(options.headers.Authorization, 'Bearer test-only-token');
    assert.equal(options.redirect, 'error');
    return Response.json({ total_count: 0, items: [] });
  } });
  await client.search('markdown'); await client.search('markdown');
  assert.equal(calls, 1);
});

test('README contents are decoded and source links retained', async () => {
  const client = createGitHubClient({ fetchImpl: async () => Response.json({ encoding: 'base64', content: Buffer.from('# Hello\n离线').toString('base64'), path: 'README.md', html_url: 'https://github.com/a/b/blob/main/README.md' }) });
  const readme = await client.readme('a', 'b');
  assert.equal(readme.text, '# Hello\n离线');
  assert.ok(readme.htmlUrl.endsWith('README.md'));
});

test('rate limits expose a retry delay without leaking upstream error payloads', async () => {
  const client = createGitHubClient({ fetchImpl: async () => new Response('secret upstream message', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'retry-after': '42' } }) });
  await assert.rejects(client.search('markdown'), error => error.status === 503 && error.retryAfter === 42 && !error.message.includes('secret'));
});

test('authentication and network failures have safe client-facing errors', async () => {
  const auth = createGitHubClient({ fetchImpl: async () => new Response('credential detail', { status: 401 }) });
  await assert.rejects(auth.search('markdown'), error => error.code === 'GITHUB_AUTH_ERROR' && !error.message.includes('credential detail'));
  const network = createGitHubClient({ fetchImpl: async () => { throw new Error('private network detail'); } });
  await assert.rejects(network.search('markdown'), error => error.status === 502 && !error.message.includes('private'));
});

test('invalid JSON and oversized upstream responses are rejected', async () => {
  const invalid = createGitHubClient({ fetchImpl: async () => new Response('not json') });
  await assert.rejects(invalid.search('markdown'), error => error.status === 502);
  const large = createGitHubClient({ fetchImpl: async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)) });
  await assert.rejects(large.search('markdown'), error => error.status === 502);
});

test('secondary rate limits and missing reset metadata have sensible retry hints', async () => {
  const secondary = createGitHubClient({ fetchImpl: async () => new Response('', { status: 403, headers: { 'retry-after': '90' } }) });
  await assert.rejects(secondary.search('markdown'), error => error.code === 'GITHUB_RATE_LIMIT' && error.retryAfter === 90);
  const fallback = createGitHubClient({ fetchImpl: async () => new Response('', { status: 429 }) });
  await assert.rejects(fallback.search('markdown'), error => error.retryAfter === 60);
});
