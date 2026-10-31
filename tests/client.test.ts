import { describe, expect, it } from "bun:test";
import { HyzeCloud, HyzeError } from "../src/index.js";
import { makeClient } from "./helpers.js";

describe("cliente HTTP", () => {
  it("manda a chave no Authorization e usa a API de produção por padrão", async () => {
    const { client, calls } = makeClient();
    await client.apps.list();
    expect(calls[0]!.url).toBe("https://api.hyzecloud.com/api/apps/");
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer hyze_test");
    expect(calls[0]!.headers.get("accept")).toBe("application/json");
  });

  it("aceita outra URL base, com ou sem barra no fim", async () => {
    const { client, calls } = makeClient({}, { baseUrl: "https://api.exemplo.dev/api///" });
    await client.apps.get("a1");
    expect(calls[0]!.url).toBe("https://api.exemplo.dev/api/apps/a1");
  });

  it("não manda Authorization sem chave", async () => {
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      expect(new Headers(init.headers).has("authorization")).toBe(false);
      return new Response("{}", { headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    delete process.env.HYZE_API_KEY;
    await new HyzeCloud({ fetch: fetchImpl }).apps.list();
  });

  it("monta a query sem undefined nem null e põe o workspaceId padrão", async () => {
    const { client, calls } = makeClient({}, { workspaceId: "ws_1" });
    await client.apps.deployments("a1", { page: 2, limit: undefined });
    expect(calls[0]!.url).toBe("https://api.hyzecloud.com/api/apps/a1/deployments?page=2&workspaceId=ws_1");
  });

  it("o workspaceId da chamada vence o padrão do cliente", async () => {
    const { client, calls } = makeClient({}, { workspaceId: "ws_1" });
    await client.apps.list({ workspaceId: "ws_2" });
    expect(calls[0]!.url).toEndWith("?workspaceId=ws_2");
  });

  it("corpo JSON leva Content-Type; FormData deixa o runtime pôr o boundary", async () => {
    const { client, calls } = makeClient();
    await client.post("/x", { a: 1 });
    expect(calls[0]!.headers.get("content-type")).toBe("application/json");
    expect(calls[0]!.body).toBe('{"a":1}');

    const form = new FormData();
    form.append("k", "v");
    await client.request("/y", { method: "POST", body: form, rawBody: true });
    expect(calls[1]!.headers.has("content-type")).toBe(false);
  });
});

describe("erros", () => {
  it("resposta de erro vira HyzeError com status, código, mensagem e corpo", async () => {
    const { client } = makeClient({ status: 403, body: { success: false, error: "Plano não permite", code: "PLAN_LIMIT" } });
    const error = await client.apps.setAutoBackup("a1", true).catch((e) => e);
    expect(error).toBeInstanceOf(HyzeError);
    expect(error).toMatchObject({ status: 403, code: "PLAN_LIMIT", message: "Plano não permite" });
  });

  it("lê o Retry-After de um 429", async () => {
    const { client } = makeClient({ status: 429, body: { success: false, error: "Devagar" }, headers: { "retry-after": "12" } });
    const error = (await client.apps.list().catch((e) => e)) as HyzeError;
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(12);
  });

  it("erro com corpo de texto também vira HyzeError", async () => {
    const { client } = makeClient({ status: 401, body: "Unauthorized" });
    const error = (await client.apps.list().catch((e) => e)) as HyzeError;
    expect(error).toBeInstanceOf(HyzeError);
    expect(error.status).toBe(401);
  });

  it("200 com corpo de erro não passa por sucesso", async () => {
    const { client } = makeClient({ status: 200, body: { success: false, error: "Sessão inválida" } });
    await expect(client.apps.list()).rejects.toBeInstanceOf(HyzeError);
  });
});
