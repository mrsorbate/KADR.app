import type { NextFunction, Request, Response } from 'express';

type RateLimitMessage = string | { error: string };

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  message?: RateLimitMessage;
};

type Entry = {
  count: number;
  resetAt: number;
};

const stores = new WeakMap<object, Map<string, Entry>>();

const getStore = (instanceKey: object) => {
  let store = stores.get(instanceKey);
  if (!store) {
    store = new Map<string, Entry>();
    stores.set(instanceKey, store);
  }
  return store;
};

const getClientIp = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';

export const createRateLimiter = (options: RateLimitOptions) => {
  const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0 ? options.windowMs : 15 * 60 * 1000;
  const max = Number.isFinite(options.max) && options.max > 0 ? options.max : 100;
  const keyGenerator = options.keyGenerator || ((req: Request) => getClientIp(req));
  const skipSuccessfulRequests = Boolean(options.skipSuccessfulRequests);
  const message = options.message || { error: 'Too many requests, please try again later.' };

  const instanceKey = {};
  const store = getStore(instanceKey);

  const cleanupExpired = (now: number) => {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    cleanupExpired(now);

    const key = keyGenerator(req);
    const existing = store.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

    if (!existing || existing.resetAt <= now) {
      store.set(key, entry);
    }

    const remainingSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count >= max) {
      res.setHeader('Retry-After', String(remainingSeconds));
      return res.status(429).json(message);
    }

    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) return;
        const current = store.get(key);
        if (!current || current.resetAt <= Date.now()) {
          store.set(key, { count: 1, resetAt: Date.now() + windowMs });
          return;
        }
        current.count += 1;
      });
      return next();
    }

    entry.count += 1;
    return next();
  };
};
