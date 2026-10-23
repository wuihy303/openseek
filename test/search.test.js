import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchPlan, extractReadmeEvidence, extractInstallation, createSearchService } from '../server/search.js';
import { HttpError, TtlCache } from '../server/cache.js';

const repo = { id: 1, name: 'reader', owner: { login: 'owner' }, private: false, default_branch: 'main', html_url: 'https://github.com/owner/reader', description: 'Markdown editor', language: 'TypeScript', stargazers_count: 123, pushed_at: '2026-01-01T00:00:00Z', topics: ['markdown'] };
const readme = { text: '# Reader\nWorks offline.\n## Installation\n```sh\nnpm install reader\n```\n', path: 'README.md', htmlUrl: 'https://github.com/owner/reader/blob/main/README.md', truncated: false };

test('Chinese query produces useful repository keywords and retains requirements', () => {
  const plan = buildSearchPlan('支持离线使用的 Markdown 编辑器');
  assert.match(plan.githubQuery, /^markdown editor /);
  assert.ok(plan.requirements.some(item => item.label === 'Offline use'));
});

test('English PDF query uses a language qualifier and specific retrieval terms', () => {
  assert.match(buildSearchPlan('Python library to extract tables from PDF').githubQuery, /^pdf table language:python /);
  assert.match(buildSearchPlan('Rust toolkit for interactive CLI prompts').githubQuery, /language:rust/);
});

test('invalid queries are rejected before upstream work', () => {
  for (const query of ['', 'a', null, [], 'a\nb', 'x'.repeat(501)]) assert.throws(() => buildSearchPlan(query), error => error.status === 400);
});

test('README evidence has exact source lines and never treats unsupported statements as evidence', () => {
  const requirements = buildSearchPlan('offline markdown editor with Windows support').requirements;
  const result = extractReadmeEvidence({ ...readme, text: 'Windows is not supported.\nWorks offline.' }, requirements);
  assert.equal(result.found.length, 1);
  assert.equal(result.found[0].source, 'README.md:L2');
  assert.ok(result.found[0].url.endsWith('#L2'));
  assert.match(result.missing[0], /Windows/);
});

test('installation extraction quotes only command blocks under an install heading', () => {
  assert.equal(extractInstallation(readme).text, 'npm install reader');
  assert.equal(extractInstallation({ ...readme, text: '# Usage\n```sh\nrm -rf example\n```' }), null);
});

test('cache is bounded and entries expire', () => {
  let now = 0;
  const cache = new TtlCache({ max: 2, ttl: 10, now: () => now });
  cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
  assert.equal(cache.get('a'), undefined);
  now = 11;
  assert.equal(cache.get('c'), undefined);
});

test('real metadata is mapped, README evidence extracted, and repeated queries cached', async () => {
  let searches = 0;
  const service = createSearchService({ github: {
    async search() { searches++; return { total_count: 12, items: [repo] }; },
    async readme(owner, name, branch) { assert.equal(branch, 'main'); return readme; }
  } });
  const result = await service({ query: 'offline markdown editor' });
  assert.equal(result.items[0].stars, 123);
  assert.equal(result.items[0].evidence[0].label, 'Offline use');
  assert.equal(result.hasMore, true);
  assert.equal((await service({ query: 'offline markdown editor' })).cached, true);
  assert.equal(searches, 1);
});

test('missing README preserves search results and does not fabricate evidence', async () => {
  const service = createSearchService({ github: { async search() { return { total_count: 1, items: [repo] }; }, async readme() { throw new HttpError(404, 'README missing', { code: 'README_NOT_FOUND' }); } } });
  const result = await service({ query: 'offline markdown editor' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].readme, null);
  assert.deepEqual(result.items[0].evidence, []);
  assert.match(result.items[0].readmeError, /missing/);
  assert.equal(result.items[0].readmeErrorCode, 'README_NOT_FOUND');
  assert.match(result.warnings[0], /README sources could not be loaded/);
});

test('empty query result uses a documented broader fallback', async () => {
  let searches = 0;
  const service = createSearchService({ github: { async search() { searches++; return { total_count: 0, items: [] }; } } });
  const result = await service({ query: 'markdown editor' });
  assert.equal(searches, 2);
  assert.equal(result.items.length, 0);
  assert.match(result.warnings[0], /Broader/);
});

test('concurrent duplicate searches share upstream requests and busy searches are bounded', async () => {
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const service = createSearchService({ maxConcurrent: 1, github: { async search() { calls++; await waiting; return { total_count: 0, items: [] }; } } });
  const first = service({ query: 'analytics' });
  const same = service({ query: 'analytics' });
  await assert.rejects(service({ query: 'markdown' }), error => error.code === 'SEARCH_BUSY');
  release();
  await Promise.all([first, same]);
  assert.equal(calls, 1);
});

test('invalid pagination never reaches GitHub', async () => {
  const service = createSearchService({ github: {} });
  await assert.rejects(service({ query: 'markdown', page: 11 }), error => error.status === 400);
  await assert.rejects(service({ query: 'markdown', perPage: 30 }), error => error.status === 400);
});

test('malicious repository URLs are excluded', async () => {
  const service = createSearchService({ github: { async search() { return { total_count: 1, items: [{ ...repo, html_url: 'javascript:alert(1)' }] }; } } });
  assert.deepEqual((await service({ query: 'markdown' })).items, []);
});

test('repositories with matching README statements rank before metadata-only matches', async () => {
  const second = { ...repo, id: 2, name: 'offline-editor', html_url: 'https://github.com/owner/offline-editor' };
  const service = createSearchService({ github: {
    async search() { return { total_count: 2, items: [repo, second] }; },
    async readme(owner, name) { return name === 'reader' ? { ...readme, text: '# Markdown editor' } : readme; }
  } });
  assert.equal((await service({ query: 'offline markdown editor' })).items[0].name, 'offline-editor');
});

test('searches always constrain public visibility and filter unexpected private results', async () => {
  assert.match(buildSearchPlan('markdown editor').githubQuery, /\bis:public\b/);
  const service = createSearchService({ github: {
    async search(query) { assert.match(query, /\bis:public\b/); return { total_count: 1, items: [{ ...repo, private: true }] }; },
    async readme() { assert.fail('Private README must never be fetched'); }
  } });
  assert.deepEqual((await service({ query: 'markdown editor' })).items, []);
});
