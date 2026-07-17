export type HyzeErrorBody = {
  success?: false;
  error?: string | { message?: string; code?: string };
  code?: string;
  message?: string;
  [key: string]: unknown;
};

export class HyzeError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly body: unknown;
  readonly retryAfterSeconds: number | null;

  constructor(input: {
    message: string;
    status: number;
    code?: string | null;
    body?: unknown;
    retryAfterSeconds?: number | null;
  }) {
    super(input.message);
    this.name = "HyzeError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.body = input.body ?? null;
    this.retryAfterSeconds = input.retryAfterSeconds ?? null;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

export function parseErrorBody(body: unknown): { message: string; code: string | null } {
  if (typeof body === "string") {
    const trimmed = body.trim();
    return {
      message: trimmed || "Request failed",
      code: null,
    };
  }

  if (!body || typeof body !== "object") {
    return { message: "Request failed", code: null };
  }

  const data = body as HyzeErrorBody;
  if (typeof data.error === "string") {
    return { message: data.error, code: data.code ?? null };
  }
  if (data.error && typeof data.error === "object") {
    return {
      message: data.error.message || data.message || "Request failed",
      code: data.error.code ?? data.code ?? null,
    };
  }
  if (typeof data.message === "string") {
    return { message: data.message, code: data.code ?? null };
  }

  return { message: "Request failed", code: data.code ?? null };
}

/** Detect error-shaped payloads even when HTTP status is wrongly 2xx. */
export function looksLikeErrorPayload(body: unknown): boolean {
  if (typeof body === "string") {
    const t = body.trim().toLowerCase();
    return (
      t === "unauthorized" ||
      t === "forbidden" ||
      t === "not found" ||
      t.startsWith("error") ||
      t.includes("unauthorized")
    );
  }
  if (!body || typeof body !== "object") return false;
  const data = body as HyzeErrorBody;
  if (data.success === false) return true;
  if (typeof data.error === "string" && data.error.length > 0) return true;
  if (data.error && typeof data.error === "object") return true;
  return false;
}
