"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = void 0;
const stores = new WeakMap();
const getStore = (instanceKey) => {
    let store = stores.get(instanceKey);
    if (!store) {
        store = new Map();
        stores.set(instanceKey, store);
    }
    return store;
};
const getClientIp = (req) => req.ip || req.socket.remoteAddress || 'unknown';
const createRateLimiter = (options) => {
    const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0 ? options.windowMs : 15 * 60 * 1000;
    const max = Number.isFinite(options.max) && options.max > 0 ? options.max : 100;
    const keyGenerator = options.keyGenerator || ((req) => getClientIp(req));
    const skipSuccessfulRequests = Boolean(options.skipSuccessfulRequests);
    const message = options.message || { error: 'Too many requests, please try again later.' };
    const instanceKey = {};
    const store = getStore(instanceKey);
    const cleanupExpired = (now) => {
        for (const [key, entry] of store.entries()) {
            if (entry.resetAt <= now) {
                store.delete(key);
            }
        }
    };
    return (req, res, next) => {
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
                if (res.statusCode < 400)
                    return;
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
exports.createRateLimiter = createRateLimiter;
//# sourceMappingURL=rateLimit.js.map