import type { NextFunction, Request, Response } from 'express';
type RateLimitMessage = string | {
    error: string;
};
type RateLimitOptions = {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    message?: RateLimitMessage;
};
export declare const createRateLimiter: (options: RateLimitOptions) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=rateLimit.d.ts.map