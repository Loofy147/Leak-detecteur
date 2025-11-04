// lib/optimization/cache.js
// In-memory caching layer for frequently accessed data

class Cache {
  constructor() {
    this.store = new Map();
    this.ttl = new Map(); // Time to live
  }

  set(key, value, ttlSeconds = 300) {
    this.store.set(key, value);
    this.ttl.set(key, Date.now() + ttlSeconds * 1000);
  }

  get(key) {
    if (!this.store.has(key)) return null;

    const expiry = this.ttl.get(key);
    if (Date.now() > expiry) {
      this.store.delete(key);
      this.ttl.delete(key);
      return null;
    }

    return this.store.get(key);
  }

  delete(key) {
    this.store.delete(key);
    this.ttl.delete(key);
  }

  clear() {
    this.store.clear();
    this.ttl.clear();
  }

  // Get or compute value
  async getOrSet(key, fn, ttlSeconds = 300) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

export const cache = new Cache();
