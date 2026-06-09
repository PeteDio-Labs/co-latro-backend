/**
 * PET-65 — logging middleware tests. We capture stdout writes so we can assert the exact
 * structured-line shape per request, and confirm /health is excluded.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import { errorLogger, requestLogger } from "./logging.ts";

let server: Server;
let base: string;
let originalWrite: typeof process.stdout.write;
let captured: string[];

/** Re-route process.stdout.write so we can inspect the JSON lines emitted by the middleware. */
function startStdoutCapture(): void {
  captured = [];
  originalWrite = process.stdout.write.bind(process.stdout);
  // The middleware writes plain strings; tolerate Buffer/Uint8Array too just in case.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.stdout.write = ((chunk: any) => {
    captured.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

function stopStdoutCapture(): void {
  process.stdout.write = originalWrite;
}

function findRequestLine(path: string): Record<string, unknown> | undefined {
  for (const chunk of captured) {
    for (const line of chunk.split("\n")) {
      if (!line) continue;
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (parsed.type === "request" && parsed.path === path) return parsed;
      } catch {
        // non-JSON lines (other writers) are noise — skip.
      }
    }
  }
  return undefined;
}

beforeAll(() => {
  const app = express();
  app.use(express.json());
  app.use(requestLogger());
  app.get("/health", (_req, res) => res.json({ status: "UP" }));
  app.get("/ok", (_req, res) => res.json({ ok: true }));
  app.get("/boom", (_req, _res, next) => next(new Error("kaboom")));
  app.get("/sad", (_req, res) =>
    res.status(500).json({ error: "internal_error", message: "Something went wrong" }),
  );
  app.use(errorLogger());
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: "internal_error", message: "Something went wrong" });
  });
  server = app.listen(0) as unknown as Server;
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://localhost:${port}`;
});

afterAll(() => {
  stopStdoutCapture();
  server.close();
});

beforeEach(() => {
  startStdoutCapture();
});

describe("requestLogger middleware", () => {
  it("emits a JSON line with method/path/status/duration after the response", async () => {
    const r = await fetch(`${base}/ok`);
    expect(r.status).toBe(200);
    stopStdoutCapture();

    const line = findRequestLine("/ok");
    expect(line).toBeTruthy();
    expect(line!.method).toBe("GET");
    expect(line!.status).toBe(200);
    expect(typeof line!.duration_ms).toBe("number");
    expect(line!.duration_ms).toBeGreaterThanOrEqual(0);
    expect(typeof line!.requestId).toBe("string");
    expect((line!.requestId as string).length).toBeGreaterThan(0);
    expect(typeof line!.timestamp).toBe("string");
  });

  it("excludes /health from logging", async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    stopStdoutCapture();

    expect(findRequestLine("/health")).toBeUndefined();
  });

  it("emits an extra error line for status >= 500 responses with the error code", async () => {
    const r = await fetch(`${base}/sad`);
    expect(r.status).toBe(500);
    stopStdoutCapture();

    let foundError: Record<string, unknown> | undefined;
    for (const chunk of captured) {
      for (const line of chunk.split("\n")) {
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          if (parsed.type === "request_error" && parsed.path === "/sad") foundError = parsed;
        } catch {
          // skip
        }
      }
    }
    expect(foundError).toBeTruthy();
    expect(foundError!.errorCode).toBe("internal_error");
    expect(foundError!.status).toBe(500);
  });

  it("errorLogger fires for thrown errors with the requestId correlated to the request line", async () => {
    const r = await fetch(`${base}/boom`);
    expect(r.status).toBe(500);
    stopStdoutCapture();

    let reqLine: Record<string, unknown> | undefined;
    const errLines: Record<string, unknown>[] = [];
    for (const chunk of captured) {
      for (const line of chunk.split("\n")) {
        if (!line) continue;
        try {
          const parsed = JSON.parse(line) as Record<string, unknown>;
          if (parsed.path !== "/boom") continue;
          if (parsed.type === "request") reqLine = parsed;
          if (parsed.type === "request_error") errLines.push(parsed);
        } catch {
          // skip
        }
      }
    }
    expect(reqLine).toBeTruthy();
    // errorLogger fires first (with the thrown error's message), and the response-finish path
    // can also emit a status-500 line for the body. We assert the thrown one is present.
    const fromErrorLogger = errLines.find((l) => l.errorMessage === "kaboom");
    expect(fromErrorLogger).toBeTruthy();
    expect(fromErrorLogger!.requestId).toBe(reqLine!.requestId);
  });
});
