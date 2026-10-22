import { createGitHubClient } from './github.js';
import { createSearchService } from './search.js';
import { createApp } from './app.js';

function integer(name, fallback, min, max) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  return value;
}

const port = integer('PORT', 3000, 1, 65535);
const ttl = integer('CACHE_TTL_SECONDS', 300, 1, 3600) * 1000;
const github = createGitHubClient({ token: process.env.GITHUB_TOKEN || '', ttl, timeoutMs: integer('GITHUB_TIMEOUT_MS', 10_000, 1000, 30_000) });
const search = createSearchService({ github, ttl });
const server = createApp({ search, rateLimit: integer('SEARCH_RATE_LIMIT', 20, 1, 1000) });
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`OpenSeek is listening on port ${port}`);
});
server.on('error', error => { console.error(`Server failed to start (${error.code || 'UNKNOWN'}).`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
});
