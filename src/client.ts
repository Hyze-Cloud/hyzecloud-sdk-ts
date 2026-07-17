import { HyzeError, looksLikeErrorPayload, parseErrorBody } from "./errors";
import type { HyzeClientOptions, RequestOptions } from "./types";
import { ApiKeysResource } from "./resources/api-keys";
import { AppsResource } from "./resources/apps";
import { DatabasesResource } from "./resources/databases";
import { GithubResource } from "./resources/github";
import { InvoicesResource } from "./resources/invoices";
import { PlansResource } from "./resources/plans";

const DEFAULT_BASE_URL = "https://api.hyzecloud.com/api";

function joinUrl(base: string, path: string) {
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function toQueryString(
  query?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

export class HyzeCloud {
  readonly apps: AppsResource;
  readonly databases: DatabasesResource;
  readonly apiKeys: ApiKeysResource;
  readonly invoices: InvoicesResource;
  readonly github: GithubResource;
  readonly plans: PlansResource;

  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly workspaceId?: string;
  private readonly defaultSignal?: AbortSignal;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: HyzeClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.HYZE_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.HYZE_API_URL ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.workspaceId = options.workspaceId;
    this.defaultSignal = options.signal;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = { ...options.headers };

    if (!this.fetchImpl) {
      throw new Error(
        "fetch is not available. Use Node.js 18+, Bun, or pass options.fetch.",
      );
    }

    this.apps = new AppsResource(this);
    this.databases = new DatabasesResource(this);
    this.apiKeys = new ApiKeysResource(this);
    this.invoices = new InvoicesResource(this);
    this.github = new GithubResource(this);
    this.plans = new PlansResource(this);
  }

  /** Low-level request helper. Path is relative to base URL (e.g. `/apps/`). */
  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = (options.method ?? "GET").toUpperCase();
    const query = { ...options.query };
    if (this.workspaceId && query.workspaceId === undefined) {
      query.workspaceId = this.workspaceId;
    }

    const url = `${joinUrl(this.baseUrl, path)}${toQueryString(query)}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.defaultHeaders,
      ...options.headers,
    };

    if (this.apiKey && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    let body: BodyInit | undefined;
    if (options.body !== undefined && options.body !== null) {
      if (options.rawBody || isFormData(options.body)) {
        body = options.body as BodyInit;
        // Let runtime set multipart boundary for FormData
        if (isFormData(options.body)) {
          delete headers["Content-Type"];
          delete headers["content-type"];
        }
      } else if (
        typeof options.body === "string" ||
        options.body instanceof Uint8Array ||
        options.body instanceof ArrayBuffer ||
        (typeof Blob !== "undefined" && options.body instanceof Blob)
      ) {
        body = options.body as BodyInit;
        if (!headers["Content-Type"] && !headers["content-type"] && typeof options.body === "string") {
          headers["Content-Type"] = "application/json";
        }
      } else {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
        body = JSON.stringify(options.body);
      }
    }

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body,
      signal: options.signal ?? this.defaultSignal,
    });

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    let payload: unknown = null;
    if (isJson) {
      payload = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => null);
      // Some endpoints return bare strings like "Unauthorized"
      payload = text;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }
    }

    const retryAfter = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfter ? Number(retryAfter) || null : null;

    if (!response.ok) {
      const { message, code } = parseErrorBody(payload);
      throw new HyzeError({
        message: message || `Hyze API failed with status ${response.status}`,
        status: response.status,
        code,
        body: payload,
        retryAfterSeconds,
      });
    }

    // Guard against APIs that return 200 + error-shaped body
    if (looksLikeErrorPayload(payload)) {
      const { message, code } = parseErrorBody(payload);
      throw new HyzeError({
        message: message || "Request failed",
        status: response.status === 200 ? 401 : response.status,
        code,
        body: payload,
        retryAfterSeconds,
      });
    }

    return payload as T;
  }

  get<T = unknown>(
    path: string,
    query?: RequestOptions["query"],
    options?: Omit<RequestOptions, "method" | "query" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "GET", query });
  }

  post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T = unknown>(
    path: string,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}
