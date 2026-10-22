import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBingRss, parseDuckDuckGo, fallbackKeywords, safeWebUrl, createWebSearchService } from '../server/web-search.js';

const feed = '<rss version="2.0"><channel><item><title>Markdown &amp; Tools</title><link>https://tools.example/editor</link><description><![CDATA[Write <b>Markdown</b> online.]]></description></item></channel></rss>';
const html = '<html><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftools.example%2Feditor&amp;rut=123">Markdown <b>Editor</b></a><a class="result__snippet">A <b>free</b> editor &amp; preview.</a></html>';

test('RSS parser decodes snippets and CDATA while dropping unsafe and duplicate links', () => {
  const xml = feed.replace('</channel>', '<item><title>Duplicate</title><link>https://tools.example/editor#section</link></item><item><title>Unsafe</title><link>javascript:alert(1)</link></item><item><title>中文&#x1F4DD;</title><link><![CDATA[https://tools.example/cn]]></link><description>压缩 &lt;b&gt;图片&lt;/b&gt;</description></item></channel>');
  const items = parseBingRss(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Markdown & Tools');
  assert.equal(items[0].description, 'Write Markdown online.');
  assert.equal(items[1].title, '中文📝');
  assert.equal(items[1].description, '压缩 图片');
});

test('DuckDuckGo links are unwrapped and paired with the correct snippet', () => {
  const items = parseDuckDuckGo(html + '<a href="https://second.example" class="result__a">Second</a><a class="result__snippet">Another snippet.</a>');
  assert.equal(items[0].url, 'https://tools.example/editor');
  assert.equal(items[0].description, 'A free editor & preview.');
  assert.equal(items[1].description, 'Another snippet.');
  assert.equal(items[1].domain, 'second.example');
});

test('provider challenge pages and malformed documents are not reported as results', () => {
  assert.throws(() => parseDuckDuckGo('<form id="challenge-form">Challenge</form>'));
  assert.throws(() => parseBingRss('<html>Blocked</html>'));
  assert.throws(() => parseDuckDuckGo('<html>Unexpected</html>'));
});

test('nested provider advertising redirects are excluded while real destination links are retained', () => {
  const advertising = 'https://duckduckgo.com/l/?uddg=' + encodeURIComponent('https://duckduckgo.com/y.js?ad_domain=ads.example');
  const result = parseDuckDuckGo(html + `<a class="result__a" href="${advertising}">Advertisement</a>`);
  assert.equal(result.length, 1);
  assert.equal(result[0].domain, 'tools.example');
  assert.equal(parseDuckDuckGo('<a class="result__a" href="https://duckduckgo.com/">DuckDuckGo</a>')[0].domain, 'duckduckgo.com');
});

test('fallback keyword shortening supports common English and Chinese tool searches', () => {
  assert.equal(fallbackKeywords('online markdown editor'), '"markdown editor"');
  assert.equal(fallbackKeywords('免费 在线 图片 压缩 工具'), '免费图片压缩');
  assert.equal(fallbackKeywords('在线 Markdown 编辑器'), '"markdown editor"');
  assert.equal(fallbackKeywords('royalty free images'), '"royalty free images"');
});

test('web result links allow normal web pages without accepting executable URLs or credentials', () => {
  assert.equal(safeWebUrl('https://tools.example/editor'), 'https://tools.example/editor');
  assert.ok(safeWebUrl('http://tools.example/'));
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'https://user:pass@tools.example/', 'not a url']) assert.equal(safeWebUrl(url), null);
});

test('live web results preserve source provenance and never invent a total count', async () => {
  const calls = [];
  const search = createWebSearchService({ fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(new URL(url).origin, 'https://html.duckduckgo.com');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'error');
    return new Response(html);
  } });
  const result = await search({ query: 'markdown editor' });
  assert.equal(result.source, 'web');
  assert.equal(result.provider, 'DuckDuckGo');
  assert.equal(result.totalCount, null);
  assert.equal(result.hasMore, false);
  assert.equal(result.items[0].url, 'https://tools.example/editor');
  assert.equal(calls.length, 1, 'Result destinations must never be fetched by the backend');
});

test('blocked primary provider falls back to Bing with the actual shortened query', async () => {
  const search = createWebSearchService({ fetchImpl: async url => {
    if (new URL(url).hostname === 'html.duckduckgo.com') return new Response('challenge', { status: 202 });
    assert.equal(new URL(url).hostname, 'www.bing.com');
    assert.equal(new URL(url).searchParams.get('q'), '"markdown editor"');
    return new Response(feed);
  } });
  const result = await search({ query: 'online markdown editor' });
  assert.equal(result.provider, 'Bing');
  assert.equal(result.searchQuery, '"markdown editor"');
  assert.equal(result.items.length, 1);
  assert.match(result.warnings[0], /Shorter/);
});

test('HTML challenges with HTTP 200 also use the alternate provider', async () => {
  const search = createWebSearchService({ fetchImpl: async url => new Response(new URL(url).hostname === 'html.duckduckgo.com' ? '<form id="challenge-form">Unavailable</form>' : feed) });
  assert.equal((await search({ query: 'markdown' })).provider, 'Bing');
});

test('concurrent duplicate requests and cached requests avoid extra provider calls', async () => {
  let calls = 0;
  const search = createWebSearchService({ fetchImpl: async () => { calls++; return new Response(html); } });
  const [first, same] = await Promise.all([search({ query: 'markdown' }), search({ query: 'markdown' })]);
  assert.equal(first.cached, false);
  assert.deepEqual(first.items, same.items);
  assert.equal((await search({ query: 'markdown' })).cached, true);
  assert.equal(calls, 1);
});

test('validation rejects invalid queries and unsupported web pagination before network access', async () => {
  const search = createWebSearchService({ fetchImpl: () => assert.fail('Unexpected network request') });
  for (const query of ['', 'a', null, 'a\nb', 'x'.repeat(501)]) await assert.rejects(search({ query }), error => error.status === 400);
  await assert.rejects(search({ query: 'markdown', page: 2 }), error => error.status === 400);
  await assert.rejects(search({ query: 'markdown', perPage: 11 }), error => error.status === 400);
});

test('genuine empty results stay empty instead of becoming demo or error results', async () => {
  const search = createWebSearchService({ fetchImpl: async url => new Response(new URL(url).hostname === 'html.duckduckgo.com' ? '<html>No results found</html>' : '<rss><channel></channel></rss>') });
  assert.deepEqual((await search({ query: 'unique-no-matches' })).items, []);
});

test('unavailable providers produce a structured retryable error without leaking internal details', async () => {
  const search = createWebSearchService({ fetchImpl: async () => { throw new Error('Internal proxy details'); } });
  await assert.rejects(search({ query: 'markdown' }), error => error.status === 503 && error.code === 'WEB_SEARCH_UNAVAILABLE' && error.retryAfter === 30 && !error.message.includes('proxy'));
});

test('provider response sizes and query concurrency are bounded', async () => {
  const large = createWebSearchService({ fetchImpl: async () => new Response('x'.repeat(1_500_001)) });
  await assert.rejects(large({ query: 'markdown' }), error => error.code === 'WEB_SEARCH_UNAVAILABLE');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const busy = createWebSearchService({ maxConcurrent: 1, fetchImpl: async () => { await gate; return new Response(html); } });
  const first = busy({ query: 'markdown' });
  await assert.rejects(busy({ query: 'different' }), error => error.code === 'SEARCH_BUSY');
  release();
  await first;
});
