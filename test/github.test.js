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

test('rate-limited README requests fall back to cached public source without sending credentials', async () => {
  const calls = [];
  const client = createGitHubClient({ token: 'test-only-token', fetchImpl: async (url, options) => {
    calls.push(url);
    if (new URL(url).hostname === 'api.github.com') return new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'retry-after': '60' } });
    assert.equal(new URL(url).origin, 'https://raw.githubusercontent.com');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'error');
    return new Response('# Public README\nWorks offline.');
  } });
  const readme = await client.readme('owner', 'repo', 'main');
  assert.equal(readme.source, 'github-raw');
  assert.equal(readme.htmlUrl, 'https://github.com/owner/repo/blob/main/README.md');
  assert.match(readme.text, /Works offline/);
  assert.deepEqual(await client.readme('owner', 'repo', 'main'), readme);
  assert.equal(calls.length, 2);
});

test('README API cooldown is reused for other public repositories', async () => {
  let apiCalls = 0;
  const client = createGitHubClient({ fetchImpl: async url => {
    if (new URL(url).hostname === 'api.github.com') { apiCalls++; return new Response('', { status: 429, headers: { 'retry-after': '60' } }); }
    return new Response('# README');
  } });
  await client.readme('owner', 'one', 'main');
  await client.readme('owner', 'two', 'main');
  assert.equal(apiCalls, 1);
});

test('fallback supports alternate README names and preserves real source paths', async () => {
  const client = createGitHubClient({ fetchImpl: async url => {
    if (new URL(url).hostname === 'api.github.com') return new Response('', { status: 429 });
    return url.endsWith('/README.rst') ? new Response('Project\n=======') : new Response('', { status: 404 });
  } });
  const readme = await client.readme('owner', 'repo', 'docs/branch');
  assert.equal(readme.path, 'README.rst');
  assert.match(readme.htmlUrl, /blob\/docs%2Fbranch\/README\.rst$/);
});

test('fallback never guesses a branch or bypasses invalid server credentials', async () => {
  let calls = 0;
  const missingBranch = createGitHubClient({ fetchImpl: async () => { calls++; return new Response('', { status: 429 }); } });
  await assert.rejects(missingBranch.readme('owner', 'repo'), error => error.code === 'GITHUB_RATE_LIMIT');
  assert.equal(calls, 1);
  calls = 0;
  const invalidToken = createGitHubClient({ fetchImpl: async () => { calls++; return new Response('', { status: 401 }); } });
  await assert.rejects(invalidToken.readme('owner', 'repo', 'main'), error => error.code === 'GITHUB_AUTH_ERROR');
  assert.equal(calls, 1);
});

test('public README bodies are truncated at the supported byte limit', async () => {
  const client = createGitHubClient({ fetchImpl: async url => new URL(url).hostname === 'api.github.com'
    ? new Response('', { status: 429 }) : new Response('a'.repeat(120_000)) });
  const readme = await client.readme('owner', 'repo', 'main');
  assert.equal(readme.text.length, 100_000);
  assert.equal(readme.truncated, true);
});

test('failed public source lookups return errors instead of fabricated README data', async () => {
  const missing = createGitHubClient({ fetchImpl: async url => new Response('', { status: new URL(url).hostname === 'api.github.com' ? 429 : 404 }) });
  await assert.rejects(missing.readme('owner', 'repo', 'main'), error => error.code === 'README_NOT_FOUND');
  const unavailable = createGitHubClient({ fetchImpl: async url => new Response('', { status: new URL(url).hostname === 'api.github.com' ? 429 : 503 }) });
  await assert.rejects(unavailable.readme('owner', 'repo', 'main'), error => error.code === 'README_UNAVAILABLE');
});
