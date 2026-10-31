import { HyzeCloud } from "../src/index.js";

export type Call = {
  url: string;
  method: string;
  headers: Headers;
  body: BodyInit | null | undefined;
};

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

/** Cliente com `fetch` falso: guarda o que foi enviado e devolve a resposta combinada. */
export function makeClient(reply: Reply = {}, options: ConstructorParameters<typeof HyzeCloud>[0] = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: init.body,
    });
    const body = reply.body === undefined ? { success: true } : reply.body;
    const isText = typeof body === "string";
    return new Response(isText ? body : JSON.stringify(body), {
      status: reply.status ?? 200,
      headers: { "content-type": isText ? "text/plain" : "application/json", ...reply.headers },
    });
  }) as unknown as typeof fetch;

  const client = new HyzeCloud({ apiKey: "hyze_test", fetch: fetchImpl, ...options });
  return { client, calls };
}
