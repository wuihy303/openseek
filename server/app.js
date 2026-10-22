import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from './cache.js';

const DEFAULT_STATIC = fileURLToPath(new URL('../dist/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

async function jsonBody(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, 'Use Content-Type: application/json.', { code: 'INVALID_CONTENT_TYPE' });
  }
  if (Number(req.headers['content-length']) > 8192) { req.resume(); throw new HttpError(413, 'Request body must be 8 KB or smaller.', { code: 'BODY_TOO_LARGE' }); }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 8192) { req.resume(); throw new HttpError(413, 'Request body must be 8 KB or smaller.', { code: 'BODY_TOO_LARGE' }); }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Request body must be valid JSON.', { code: 'INVALID_JSON' }); }
}

export function createApp({ search, staticDir = DEFAULT_STATIC, rateLimit = 20, now = Date.now } = {}) {
  const clients = new Map();
  const root = path.resolve(staticDir);
  function send(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  function limit(req) {
    const ip = req.socket.remoteAddress || 'unknown';
    const time = now();
    let state = clients.get(ip);
    if (!state || state.until <= time) { state = { count: 0, until: time + 60_000 }; clients.set(ip, state); }
    if (clients.size > 10_000) for (const [key, value] of clients) if (value.until <= time) clients.delete(key);
    if (clients.size > 10_000) throw new HttpError(503, 'Search is busy. Please retry.', { retryAfter: 60 });
    if (++state.count > rateLimit) throw new HttpError(429, 'Too many searches. Please retry in a minute.', { code: 'RATE_LIMITED', retryAfter: Math.ceil((state.until - time) / 1000) });
  }

  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health' && req.method === 'GET') {
        send(res, 200, { status: 'ok', service: 'openseek', version: '1.0.0' }); return;
      }
      if (url.pathname === '/api/search') {
        if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); throw new HttpError(405, 'Use GET or POST.'); }
        const origin = req.headers.origin;
        if (origin) {
          let allowed = false;
          try { allowed = new URL(origin).host === req.headers.host; } catch { /* Reject opaque or malformed origins. */ }
          if (!allowed) throw new HttpError(403, 'Cross-origin search requests are not allowed.');
        }
        limit(req);
        const input = req.method === 'POST' ? await jsonBody(req) : Object.fromEntries(url.searchParams);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'Expected a JSON object.');
        const result = await search({ query: input.query ?? input.q, page: input.page === undefined ? 1 : Number(input.page), perPage: input.perPage === undefined ? 5 : Number(input.perPage) });
        send(res, 200, result); return;
      }
      if (url.pathname.startsWith('/api/')) throw new HttpError(404, 'API endpoint not found.');
      if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); throw new HttpError(405, 'Use GET or HEAD for static files.'); }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'Invalid URL encoding.'); }
      if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) throw new HttpError(404, 'File not found.');
      const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!target.startsWith(root + path.sep)) throw new HttpError(404, 'File not found.');
      let body;
      try { body = await readFile(target); } catch { throw new HttpError(404, 'File not found.'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': path.extname(target) === '.html' ? 'no-cache' : 'public, max-age=3600' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const known = error instanceof HttpError;
      if (known && error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
      if (!res.headersSent && !res.destroyed) send(res, known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'An unexpected server error occurred.' } });
    }
  });
}
