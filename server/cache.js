export class TtlCache {
  constructor({ ttl = 300_000, max = 200, now = Date.now } = {}) {
    this.ttl = ttl;
    this.max = max;
    this.now = now;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    this.entries.delete(key);
    while (this.entries.size >= this.max) this.entries.delete(this.entries.keys().next().value);
    this.entries.set(key, { value, expires: this.now() + this.ttl });
    return value;
  }
}

export class HttpError extends Error {
  constructor(status, message, { code = 'REQUEST_FAILED', retryAfter } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
