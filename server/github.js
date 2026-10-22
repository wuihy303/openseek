import { TtlCache, HttpError } from './cache.js';

const API_ORIGIN = 'https://api.github.com';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, 'GitHub returned an empty response.');
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new HttpError(502, 'GitHub response exceeded the supported size.');
      }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'GitHub returned an unreadable response.');
  } finally { reader.releaseLock(); }
}

export function createGitHubClient({ token = '', fetchImpl = fetch, timeoutMs = 10_000, ttl = 300_000 } = {}) {
  const cache = new TtlCache({ ttl, max: 300 });
  const pending = new Map();

  async function request(path) {
    const cached = cache.get(path);
    if (cached !== undefined) return cached;
    if (pending.has(path)) return pending.get(path);
    const task = (async () => {
      let response;
      try {
        response = await fetchImpl(`${API_ORIGIN}${path}`, {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'OpenSeek/1.0',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          signal: AbortSignal.timeout(timeoutMs),
          redirect: 'error'
        });
      } catch (error) {
        throw new HttpError(error.name === 'TimeoutError' ? 504 : 502,
          error.name === 'TimeoutError' ? 'GitHub took too long to respond. Please retry.' : 'Could not reach GitHub. Please retry.',
          { code: 'GITHUB_UNAVAILABLE' });
      }
      if (!response.ok) await response.body?.cancel();
      if (response.status === 404) throw new HttpError(404, 'Repository README was not found.', { code: 'README_NOT_FOUND' });
      const exhausted = response.headers.get('x-ratelimit-remaining') === '0';
      if (response.status === 429 || (response.status === 403 && (exhausted || response.headers.has('retry-after')))) {
        const reset = Number(response.headers.get('x-ratelimit-reset'));
        const explicit = Number(response.headers.get('retry-after'));
        const untilReset = Math.ceil(reset - Date.now() / 1000);
        const retryAfter = Math.min(3600, Math.max(1, explicit > 0 ? explicit : untilReset > 0 ? untilReset : 60));
        throw new HttpError(503, 'GitHub API rate limit reached. Please retry later or configure a server-side GitHub token.', { code: 'GITHUB_RATE_LIMIT', retryAfter });
      }
      if (response.status === 401 || response.status === 403) {
        throw new HttpError(502, 'GitHub rejected the server credentials. Check the server GitHub token.', { code: 'GITHUB_AUTH_ERROR' });
      }
      if (!response.ok) throw new HttpError(502, 'GitHub search is temporarily unavailable.', { code: 'GITHUB_UNAVAILABLE' });
      return cache.set(path, await readJson(response));
    })();
    pending.set(path, task);
    try { return await task; } finally { pending.delete(path); }
  }

  return {
    async search(query, { page = 1, perPage = 5 } = {}) {
      const params = new URLSearchParams({ q: query, per_page: String(perPage), page: String(page) });
      return request(`/search/repositories?${params}`);
    },
    async readme(owner, name) {
      const data = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/readme`);
      if (data.encoding !== 'base64' || typeof data.content !== 'string') {
        throw new HttpError(502, 'This README is not available in a supported format.', { code: 'README_UNAVAILABLE' });
      }
      const bytes = Buffer.from(data.content, 'base64');
      return { text: bytes.toString('utf8', 0, 100_000), path: data.path || 'README', htmlUrl: safeGitHubUrl(data.html_url), truncated: bytes.length > 100_000 };
    }
  };
}

export function safeGitHubUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
