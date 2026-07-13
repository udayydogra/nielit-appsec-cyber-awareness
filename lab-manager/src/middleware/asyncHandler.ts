// Express 4 does not forward errors thrown in async handlers — an uncaught
// rejection crashes the whole process. `ah` wraps an async handler so any rejection
// flows to the error middleware instead. `errorHandler` is the last-resort 500.
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[error]', err);
  if (res.headersSent) return; // e.g. mid-SSE-stream — can't change status now
  res.status(500).json({ error: 'internal_error' });
}
