import { HttpError, TtlCache } from './cache.js';
import { validateQuery } from './search.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', middot: '·', copy: '©', reg: '®' };

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity) => {
    if (entity.startsWith('#')) {
      const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : '';
    }
    return ENTITIES[entity.toLowerCase()] ?? original;
  });
}

function plainText(value = '') {
  return decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
    .replace(/<[^>]*>/g, '').replace(/[\x00-\x1f\s]+/g, ' ').trim();
}

export function safeWebUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function normalizeResults(items) {
  const seen = new Set();
  return items.flatMap(item => {
    const url = safeWebUrl(item.url);
    const title = plainText(item.title).slice(0, 300);
    if (!url || !title) return [];
    const parsed = new URL(url);
    parsed.hash = '';
    if (seen.has(parsed.href)) return [];
    seen.add(parsed.href);
    return [{ title, url, domain: parsed.hostname.replace(/^www\./, ''), description: plainText(item.description).slice(0, 1500) }];
  }).slice(0, 10);
}

export function rankWebResults(items, query) {
  const text = query.toLowerCase();
  const ignored = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'to', 'me', 'find', 'please', 'tool', 'tools']);
  const terms = (text.match(/[a-z\d]+/g) || []).filter(term => !ignored.has(term));
  for (const segment of text.match(/[\u3400-\u9fff]+/g) || []) {
    if (segment.length === 1) terms.push(segment);
    else for (let index = 0; index < segment.length - 1; index++) terms.push(segment.slice(index, index + 2));
  }
  const keywords = [...new Set(terms)].slice(0, 30);
  const score = item => keywords.reduce((total, term) => total +
    (item.title.toLowerCase().includes(term) ? 5 : 0) +
    (item.description.toLowerCase().includes(term) ? 1 : 0) +
    (item.url.toLowerCase().includes(term) ? 1 : 0), 0);
  return [...items].sort((left, right) => score(right) - score(left));
}

export function parseBingRss(xml) {
  if (!/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) throw new Error('Unexpected search feed');
  const tag = (body, name) => body.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '';
  return normalizeResults([...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => ({
    title: tag(match[1], 'title'), url: plainText(tag(match[1], 'link')), description: tag(match[1], 'description')
  })));
}

function attribute(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return decodeEntities(match?.[1] ?? match?.[2] ?? '');
}

function duckDestination(href) {
  try {
    let url = new URL(href, 'https://duckduckgo.com');
    for (let depth = 0; depth < 3; depth++) {
      const internal = url.hostname === 'duckduckgo.com' || url.hostname.endsWith('.duckduckgo.com');
      if (!internal || !['/l/', '/l', '/y.js'].includes(url.pathname)) return url.href;
      const destination = url.searchParams.get('uddg');
      if (!destination) return null;
      url = new URL(destination);
    }
  } catch { /* Ignore invalid redirect links. */ }
  return null;
}

export function parseDuckDuckGo(html) {
  if (/challenge-form|anomaly-modal|anomaly\.js/i.test(html)) throw new Error('Search provider unavailable');
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .filter(match => attribute(match[1], 'class').split(/\s+/).includes('result__a'));
  if (!anchors.length && !/no results (?:found|for)|no more results/i.test(plainText(html))) throw new Error('Unexpected search page');
  return normalizeResults(anchors.map((anchor, index) => {
    const segment = html.slice(anchor.index + anchor[0].length, anchors[index + 1]?.index ?? html.length);
    const snippet = segment.match(/<(?:a|div)\b[^>]*\bclass\s*=\s*["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1] || '';
    const href = attribute(anchor[1], 'href');
    return { title: anchor[2], url: duckDestination(href), description: snippet };
  }));
}

export function fallbackKeywords(query) {
  let keywords = query.replace(/^(?:please |find me |help me find |show me |帮我找(?:一下|一个|个)?|请帮我找|推荐一个)/i, '')
    .replace(/\b(?:online|tools?)\b/gi, ' ').replace(/在线|工具/g, ' ').replace(/\s+/g, ' ').trim();
  if (/markdown/i.test(keywords) && /编辑|editor/i.test(keywords)) return '"markdown editor"';
  if (/^[\u3400-\u9fff\s]+$/.test(keywords)) keywords = keywords.replace(/\s/g, '');
  if (!keywords) return query;
  return /^[a-z\d -]+$/i.test(keywords) && keywords.split(' ').length >= 2 && keywords.split(' ').length <= 4 ? `"${keywords}"` : keywords;
}

async function readSearchBody(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response');
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_500_000) { await reader.cancel(); throw new Error('Search response too large'); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { reader.releaseLock(); }
}

export function createWebSearchService({ fetchImpl = fetch, ttl = 300_000, timeoutMs = 10_000, maxConcurrent = 4 } = {}) {
  const cache = new TtlCache({ ttl, max: 100 });
  const pending = new Map();
  let active = 0;
  return async function webSearch({ query: input, page = 1, perPage = 10 }) {
    const query = validateQuery(input);
    if (page !== 1 || !Number.isInteger(perPage) || perPage < 1 || perPage > 10) {
      throw new HttpError(400, 'Web search returns the top 1–10 results on page 1.', { code: 'INVALID_PAGINATION' });
    }
    const key = JSON.stringify([query.toLowerCase(), perPage]);
    const cached = cache.get(key);
    if (cached) return { ...cached, cached: true };
    if (pending.has(key)) return pending.get(key);
    if (active >= maxConcurrent) throw new HttpError(503, 'Web search is busy. Please retry shortly.', { code: 'SEARCH_BUSY', retryAfter: 5 });
    active++;
    const task = (async () => {
      const fallback = fallbackKeywords(query);
      const providers = [
        { name: 'DuckDuckGo', searchQuery: query, url: `https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query })}`, parse: parseDuckDuckGo },
        { name: 'Bing', searchQuery: fallback, url: `https://www.bing.com/search?${new URLSearchParams({ format: 'rss', q: fallback })}`, parse: parseBingRss }
      ];
      let emptyResult;
      for (const provider of providers) {
        try {
          const response = await fetchImpl(provider.url, {
            headers: { 'User-Agent': 'OpenSeek/1.1', Accept: 'application/rss+xml,text/html;q=0.9' },
            signal: AbortSignal.timeout(timeoutMs), redirect: 'error'
          });
          if (!response.ok || response.status === 202) { await response.body?.cancel(); continue; }
          const items = rankWebResults(provider.parse(await readSearchBody(response)), query).slice(0, perPage);
          const result = { query, source: 'web', provider: provider.name, searchQuery: provider.searchQuery,
            totalCount: null, page: 1, perPage, hasMore: false, fetchedAt: new Date().toISOString(), cached: false,
            warnings: provider.searchQuery !== query ? ['Shorter keywords were used to find relevant web pages.'] : [], items };
          if (items.length) return cache.set(key, result);
          emptyResult = result;
        } catch { /* Try the other public search provider; never fetch result URLs on the server. */ }
      }
      if (emptyResult) return cache.set(key, emptyResult);
      throw new HttpError(503, 'Web search is temporarily unavailable. Please try again shortly.', { code: 'WEB_SEARCH_UNAVAILABLE', retryAfter: 30 });
    })();
    pending.set(key, task);
    try { return await task; } finally { active--; pending.delete(key); }
  };
}
