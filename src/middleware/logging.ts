/**
 * PET-65 — request logger middleware. Emits one structured JSON line per request AFTER the
 * response finishes (so we capture status + duration). `/health` is excluded — it's polled by
 * docker and would drown the log. Anonymous requests are logged too (the auth middleware sets
 * req.userId on success; before that runs, userId is just undefined and omitted).
 *
 * Error responses (status >= 500 or Express error-handler invocations) get an extra "error"
 * line tagged with the JSON {error, message} code when the response body carries one. Stacks
 * are gated behind NODE_ENV !== "production" so they don't leak into hosted logs.
 */

import type { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const EXCLUDED_PATHS = new Set(["/health"]);

interface RequestLogLine {
  level: "info";
  type: "request";
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  userId?: string;
  timestamp: string;
}

interface ErrorLogLine {
  level: "error";
  type: "request_error";
  requestId: string;
  method: string;
  path: string;
  status: number;
  errorCode?: string;
  errorMessage?: string;
  stack?: string;
  timestamp: string;
}

/** Resolve a stable id for this request so the request line + any error line can be correlated. */
function ensureRequestId(req: Request): string {
  if (!req.requestId) req.requestId = crypto.randomUUID();
  return req.requestId;
}

/** Capture the JSON body Express writes via res.json so the error line can pick up its error code. */
function interceptJsonBody(res: Response): { current: unknown } {
  const captured: { current: unknown } = { current: undefined };
  const originalJson = res.json.bind(res);
  res.json = function patchedJson(body: unknown) {
    captured.current = body;
    return originalJson(body);
  };
  return captured;
}

/** Best-effort write to stdout — never throws into the caller. */
function emit(line: RequestLogLine | ErrorLogLine): void {
  try {
    process.stdout.write(JSON.stringify(line) + "\n");
  } catch {
    // stdout closed (e.g. under test teardown) — swallow; logging must not break the response cycle.
  }
}

/**
 * Wire near the top of the middleware chain (after express.json(), before auth) so even
 * unauthenticated requests are logged. The actual write happens on the `finish` event.
 */
export function requestLogger() {
  return function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (EXCLUDED_PATHS.has(req.path)) {
      next();
      return;
    }
    const requestId = ensureRequestId(req);
    const start = performance.now();
    const capturedBody = interceptJsonBody(res);

    res.on("finish", () => {
      const duration_ms = Math.round((performance.now() - start) * 1000) / 1000;
      const line: RequestLogLine = {
        level: "info",
        type: "request",
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms,
        timestamp: new Date().toISOString(),
      };
      if (req.userId) line.userId = req.userId;
      emit(line);

      if (res.statusCode >= 500) {
        const body = capturedBody.current;
        const errLine: ErrorLogLine = {
          level: "error",
          type: "request_error",
          requestId,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          timestamp: new Date().toISOString(),
        };
        if (body && typeof body === "object") {
          const b = body as { error?: unknown; message?: unknown };
          if (typeof b.error === "string") errLine.errorCode = b.error;
          if (typeof b.message === "string") errLine.errorMessage = b.message;
        }
        emit(errLine);
      }
    });

    next();
  };
}

/**
 * Express error-handler shim — emits an error line for thrown errors (the centralized handler in
 * app.ts still owns the response). Stacks only in non-production so they stay out of hosted logs.
 */
export function errorLogger() {
  return function errorLoggingMiddleware(
    err: unknown,
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const requestId = ensureRequestId(req);
    const errLine: ErrorLogLine = {
      level: "error",
      type: "request_error",
      requestId,
      method: req.method,
      path: req.path,
      status: 500,
      timestamp: new Date().toISOString(),
    };
    if (err instanceof Error) {
      errLine.errorMessage = err.message;
      if (process.env.NODE_ENV !== "production") errLine.stack = err.stack;
    } else {
      errLine.errorMessage = String(err);
    }
    emit(errLine);
    next(err);
  };
}
