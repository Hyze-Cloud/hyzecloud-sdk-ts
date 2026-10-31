import { describe, expect, it } from "bun:test";
import type { HyzeCloud } from "../src/index.js";
import { makeClient } from "./helpers.js";

const BASE = "https://api.hyzecloud.com/api";

type Case = {
  name: string;
  run: (c: HyzeCloud) => Promise<unknown>;
  method: string;
  path: string;
  /** corpo JSON esperado (omitido = sem corpo) */
  body?: unknown;
};

/**
 * Contrato de cada método do SDK: que método HTTP e que caminho ele chama. A existência dessas
 * rotas na API é conferida por `bun run check:api` (scripts/check-api-routes.ts).
 */
const CASES: Case[] = [
  // ---- apps (já existentes)
  { name: "apps.list", run: (c) => c.apps.list(), method: "GET", path: "/apps/" },
  { name: "apps.get", run: (c) => c.apps.get("a1"), method: "GET", path: "/apps/a1" },
  { name: "apps.delete", run: (c) => c.apps.delete("a1"), method: "DELETE", path: "/apps/a1" },
  { name: "apps.start", run: (c) => c.apps.start("a1"), method: "POST", path: "/apps/a1/start" },
  { name: "apps.stop", run: (c) => c.apps.stop("a1"), method: "POST", path: "/apps/a1/stop" },
  { name: "apps.restart", run: (c) => c.apps.restart("a1"), method: "POST", path: "/apps/a1/restart" },
  { name: "apps.logs", run: (c) => c.apps.logs("a1", { tail: 50, timestamps: true }), method: "GET", path: "/apps/a1/logs?tail=50&timestamps=true" },
  { name: "apps.deployments", run: (c) => c.apps.deployments("a1", { limit: 5 }), method: "GET", path: "/apps/a1/deployments?limit=5" },
  { name: "apps.getEnv", run: (c) => c.apps.getEnv("a1"), method: "GET", path: "/apps/a1/env" },
  { name: "apps.setEnv", run: (c) => c.apps.setEnv("a1", { A: "1" }), method: "PUT", path: "/apps/a1/env", body: { envVars: { A: "1" } } },
  { name: "apps.updateSettings", run: (c) => c.apps.updateSettings("a1", { memoryMB: 512 }), method: "PUT", path: "/apps/a1/settings", body: { memoryMB: 512 } },
  { name: "apps.deployFromRepo", run: (c) => c.apps.deployFromRepo({ repo: "o/r" } as never), method: "POST", path: "/apps/deploy-from-repo", body: { repo: "o/r" } },
  { name: "apps.createBackup", run: (c) => c.apps.createBackup("a1"), method: "POST", path: "/apps/a1/backup" },
  { name: "apps.listBackups", run: (c) => c.apps.listBackups("a1"), method: "GET", path: "/apps/a1/backups" },
  { name: "apps.deleteBackups", run: (c) => c.apps.deleteBackups("a1"), method: "DELETE", path: "/apps/a1/backups" },
  { name: "apps.restoreBackup", run: (c) => c.apps.restoreBackup("a1", "b1"), method: "POST", path: "/apps/a1/backups/restore", body: { backupId: "b1" } },
  { name: "apps.downloadBackup", run: (c) => c.apps.downloadBackup("a1", "b1"), method: "GET", path: "/apps/a1/backups/b1/download" },

  // ---- apps (novos): deploys
  { name: "apps.deployment", run: (c) => c.apps.deployment("a1", "d1"), method: "GET", path: "/apps/a1/deployments/d1" },
  { name: "apps.deploymentLogs", run: (c) => c.apps.deploymentLogs("a1", "d1"), method: "GET", path: "/apps/a1/deployments/d1/logs" },
  { name: "apps.buildProgress (app)", run: (c) => c.apps.buildProgress("a1"), method: "GET", path: "/apps/a1/build-progress" },
  { name: "apps.buildProgress (deploy)", run: (c) => c.apps.buildProgress("a1", "d1"), method: "GET", path: "/apps/a1/deployments/d1/build-progress" },
  { name: "apps.cancelDeployment", run: (c) => c.apps.cancelDeployment("a1", "d1"), method: "POST", path: "/apps/a1/deployments/d1/cancel" },
  { name: "apps.retryDeployment", run: (c) => c.apps.retryDeployment("a1", "d1"), method: "POST", path: "/apps/a1/deployments/d1/retry" },
  { name: "apps.rollbackDeployment", run: (c) => c.apps.rollbackDeployment("a1", "d1"), method: "POST", path: "/apps/a1/deployments/d1/rollback" },
  { name: "apps.rebuild", run: (c) => c.apps.rebuild("a1"), method: "POST", path: "/apps/a1/rebuild" },

  // ---- apps (novos): backup automático, transferência e métricas
  { name: "apps.setAutoBackup", run: (c) => c.apps.setAutoBackup("a1", true), method: "PUT", path: "/apps/a1/auto-backup", body: { enabled: true } },
  { name: "apps.transfer", run: (c) => c.apps.transfer("a1", { targetOrganizationId: "ws2" }), method: "POST", path: "/apps/a1/transfer", body: { targetOrganizationId: "ws2" } },
  { name: "apps.stats", run: (c) => c.apps.stats(["a1", "a2"]), method: "GET", path: "/apps/stats?ids=a1%2Ca2" },

  // ---- apps (novos): domínios
  { name: "apps.listDomains", run: (c) => c.apps.listDomains("a1"), method: "GET", path: "/apps/a1/domains" },
  { name: "apps.addDomain", run: (c) => c.apps.addDomain("a1", "meu.site.com"), method: "POST", path: "/apps/a1/domains", body: { hostname: "meu.site.com" } },
  { name: "apps.verifyDomain", run: (c) => c.apps.verifyDomain("a1", "dom1"), method: "POST", path: "/apps/a1/domains/dom1/verify" },
  { name: "apps.removeDomain", run: (c) => c.apps.removeDomain("a1", "dom1"), method: "DELETE", path: "/apps/a1/domains/dom1" },

  // ---- databases
  { name: "databases.list", run: (c) => c.databases.list(), method: "GET", path: "/databases/" },
  { name: "databases.get", run: (c) => c.databases.get("db1"), method: "GET", path: "/databases/db1" },
  { name: "databases.delete", run: (c) => c.databases.delete("db1"), method: "DELETE", path: "/databases/db1" },
  { name: "databases.updateSettings", run: (c) => c.databases.updateSettings("db1", { name: "x" }), method: "PATCH", path: "/databases/db1/settings", body: { name: "x" } },
  { name: "databases.stats", run: (c) => c.databases.stats("db1"), method: "GET", path: "/databases/db1/stats" },
  { name: "databases.statsMany (novo)", run: (c) => c.databases.statsMany(["db1", "db2"]), method: "GET", path: "/databases/stats?ids=db1%2Cdb2" },
  { name: "databases.create", run: (c) => c.databases.create({ name: "pg", engine: "postgresql" } as never), method: "POST", path: "/databases/", body: { name: "pg", engine: "postgresql" } },
  { name: "databases.logs", run: (c) => c.databases.logs("db1", { tail: 20 }), method: "GET", path: "/databases/db1/logs?tail=20" },
  { name: "databases.start", run: (c) => c.databases.start("db1"), method: "POST", path: "/databases/db1/start" },
  { name: "databases.stop", run: (c) => c.databases.stop("db1"), method: "POST", path: "/databases/db1/stop" },
  { name: "databases.rotatePassword (gera)", run: (c) => c.databases.rotatePassword("db1"), method: "POST", path: "/databases/db1/rotate-password", body: {} },
  { name: "databases.rotatePassword (informada)", run: (c) => c.databases.rotatePassword("db1", "nova-senha"), method: "POST", path: "/databases/db1/rotate-password", body: { password: "nova-senha" } },
  { name: "databases.createBackup", run: (c) => c.databases.createBackup("db1"), method: "POST", path: "/databases/db1/backups" },
  { name: "databases.listBackups", run: (c) => c.databases.listBackups("db1"), method: "GET", path: "/databases/db1/backups" },
  { name: "databases.downloadBackup", run: (c) => c.databases.downloadBackup("db1", "b1"), method: "GET", path: "/databases/db1/backups/b1/download" },
  { name: "databases.restore", run: (c) => c.databases.restore("db1", "b1"), method: "POST", path: "/databases/db1/restore", body: { backupId: "b1" } },
  { name: "databases.operations", run: (c) => c.databases.operations("db1"), method: "GET", path: "/databases/db1/operations" },

  // ---- tags (novo)
  { name: "tags.list", run: (c) => c.tags.list(), method: "GET", path: "/tags/" },
  { name: "tags.create", run: (c) => c.tags.create({ name: "api", color: "#7c46ce" }), method: "POST", path: "/tags/", body: { name: "api", color: "#7c46ce" } },
  { name: "tags.update", run: (c) => c.tags.update("t1", { name: "novo" }), method: "PATCH", path: "/tags/t1", body: { name: "novo" } },
  { name: "tags.delete", run: (c) => c.tags.delete("t1"), method: "DELETE", path: "/tags/t1" },
  { name: "tags.setLinks", run: (c) => c.tags.setLinks({ kind: "app", id: "a1", tagIds: ["t1", "t2"] }), method: "PUT", path: "/tags/links", body: { kind: "app", id: "a1", tagIds: ["t1", "t2"] } },

  // ---- api keys, faturas, GitHub, planos
  { name: "apiKeys.list", run: (c) => c.apiKeys.list(), method: "GET", path: "/api-keys/" },
  { name: "apiKeys.create", run: (c) => c.apiKeys.create({ name: "ci" } as never), method: "POST", path: "/api-keys/", body: { name: "ci" } },
  { name: "apiKeys.update", run: (c) => c.apiKeys.update("k1", { name: "x" } as never), method: "PUT", path: "/api-keys/k1", body: { name: "x" } },
  { name: "apiKeys.delete", run: (c) => c.apiKeys.delete("k1"), method: "DELETE", path: "/api-keys/k1" },
  { name: "invoices.list", run: (c) => c.invoices.list({ limit: 10 }), method: "GET", path: "/invoices/?limit=10" },
  { name: "invoices.createPix", run: (c) => c.invoices.createPix({ planId: "pro" } as never), method: "POST", path: "/invoices/pix", body: { planId: "pro" } },
  { name: "invoices.status", run: (c) => c.invoices.status("i1", { includePix: true }), method: "GET", path: "/invoices/i1/status?includePix=true" },
  { name: "github.status", run: (c) => c.github.status(), method: "GET", path: "/integrations/github/status" },
  { name: "github.installUrl", run: (c) => c.github.installUrl(), method: "GET", path: "/integrations/github/install-url" },
  { name: "github.disconnect", run: (c) => c.github.disconnect(), method: "DELETE", path: "/integrations/github/connection" },
  { name: "github.repos", run: (c) => c.github.repos(), method: "GET", path: "/integrations/github/repos" },
  { name: "github.branches", run: (c) => c.github.branches("o", "r"), method: "GET", path: "/integrations/github/repos/o/r/branches" },
  { name: "github.detectRuntime", run: (c) => c.github.detectRuntime("o", "r", { branch: "main" }), method: "GET", path: "/integrations/github/repos/o/r/runtime?branch=main" },
  { name: "plans.current", run: (c) => c.plans.current(), method: "GET", path: "/plans/current" },
  { name: "plans.list", run: (c) => c.plans.list(), method: "GET", path: "/plans/" },
];

describe("contrato dos métodos do SDK", () => {
  for (const item of CASES) {
    it(`${item.name} → ${item.method} ${item.path}`, async () => {
      const { client, calls } = makeClient();
      await item.run(client);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.method).toBe(item.method);
      expect(calls[0]!.url).toBe(`${BASE}${item.path}`);
      if (item.body === undefined) expect(calls[0]!.body ?? null).toBeNull();
      else expect(JSON.parse(String(calls[0]!.body))).toEqual(item.body);
    });
  }

  it("cobre todos os métodos públicos dos resources, para ninguém ficar sem teste", () => {
    const { client } = makeClient();
    const resources = ["apps", "databases", "apiKeys", "invoices", "github", "plans", "tags"] as const;
    const methods = resources.flatMap((name) =>
      Object.getOwnPropertyNames(Object.getPrototypeOf(client[name]))
        .filter((m) => m !== "constructor")
        .map((m) => `${name}.${m}`),
    );
    // os de upload (multipart) têm teste próprio abaixo
    const multipart = new Set(["apps.deployFromZip", "apps.inspectEnv"]);
    const tested = new Set(CASES.map((c) => c.name.split(" ")[0]));
    const missing = methods.filter((m) => !tested.has(m) && !multipart.has(m));
    expect(missing).toEqual([]);
  });
});

describe("rotas de upload (multipart)", () => {
  it("deployFromZip envia o ZIP e os campos do app como formulário", async () => {
    const { client, calls } = makeClient();
    await client.apps.deployFromZip({
      file: new Uint8Array([80, 75, 3, 4]),
      name: "meu-bot",
      runtime: "node",
      memoryMB: 512,
      subdomain: "meu-bot",
    });
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(`${BASE}/apps/deploy`);
    const form = calls[0]!.body as FormData;
    expect(form.get("name")).toBe("meu-bot");
    expect(form.get("runtime")).toBe("node");
    expect(form.get("memoryMB")).toBe("512");
    expect(form.get("startupCommand")).toBe("auto");
    expect(form.get("subdomain")).toBe("meu-bot");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("inspectEnv envia só o arquivo", async () => {
    const { client, calls } = makeClient();
    await client.apps.inspectEnv(new Uint8Array([1, 2, 3]), "projeto.zip");
    expect(calls[0]!.url).toBe(`${BASE}/apps/inspect-env`);
    expect((calls[0]!.body as FormData).get("file")).toBeInstanceOf(Blob);
  });

  it("recusa um tipo de arquivo que não dá para enviar", async () => {
    const { client } = makeClient();
    await expect(
      client.apps.deployFromZip({ file: "texto" as never, name: "x", runtime: "node", memoryMB: 256 }),
    ).rejects.toThrow(/Unsupported file type/);
  });
});

describe("ids com caracteres especiais", () => {
  it("são codificados na URL, nunca viram outro caminho", async () => {
    const { client, calls } = makeClient();
    await client.apps.deploymentLogs("a/../b", "d?x=1");
    expect(calls[0]!.url).toBe(`${BASE}/apps/a%2F..%2Fb/deployments/d%3Fx%3D1/logs`);
  });
});
