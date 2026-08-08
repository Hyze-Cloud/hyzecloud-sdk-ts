/**
 * Live smoke test against the real Hyze Cloud API.
 *
 * Usage:
 *   HYZE_API_KEY=hyze_xxx bun run smoke
 *
 * Optional:
 *   HYZE_API_URL=https://api.hyzecloud.com/api
 *   HYZE_WORKSPACE_ID=org_xxx
 *   HYZE_SMOKE_MAX_CHARS=4000
 *   HYZE_SMOKE_COMPACT=1
 *   HYZE_SMOKE_READ_ONLY=1     # skip create/deploy/mutate (lists only)
 *   HYZE_SMOKE_KEEP=1          # do not delete resources created by smoke
 *   HYZE_SMOKE_ENGINE=redis    # postgresql | mysql | mongodb | redis (default redis)
 *   HYZE_SMOKE_MEMORY_MB=256
 *   HYZE_SMOKE_BASE_DOMAIN=hyzecloud.app  # FQDN suffix for public apps
 */

import { HyzeCloud, HyzeError } from "../src/index";
import type { DatabaseEngine, DatabaseItem, DatabaseStatus } from "../src/types";

const apiKey = process.env.HYZE_API_KEY?.trim();
const baseUrl = process.env.HYZE_API_URL?.trim();
const workspaceId = process.env.HYZE_WORKSPACE_ID?.trim();
const compact =
  process.env.HYZE_SMOKE_COMPACT === "1" || process.env.HYZE_SMOKE_COMPACT === "true";
const readOnly =
  process.env.HYZE_SMOKE_READ_ONLY === "1" || process.env.HYZE_SMOKE_READ_ONLY === "true";
const keepResources =
  process.env.HYZE_SMOKE_KEEP === "1" || process.env.HYZE_SMOKE_KEEP === "true";
const maxChars = Math.max(500, Number(process.env.HYZE_SMOKE_MAX_CHARS ?? 4000) || 4000);
const memoryMB = Math.max(256, Number(process.env.HYZE_SMOKE_MEMORY_MB ?? 256) || 256);
const baseDomain = (
  process.env.HYZE_SMOKE_BASE_DOMAIN ??
  process.env.APPS_BASE_DOMAIN ??
  "hyzecloud.app"
)
  .trim()
  .toLowerCase()
  .replace(/^\.+/, "")
  .replace(/\.+$/, "");
const engineRaw = (process.env.HYZE_SMOKE_ENGINE ?? "redis").trim().toLowerCase();
const engines: DatabaseEngine[] = ["postgresql", "mysql", "mongodb", "redis"];
const engine = (engines.includes(engineRaw as DatabaseEngine)
  ? engineRaw
  : "redis") as DatabaseEngine;

if (!apiKey) {
  console.error(
    [
      "Missing HYZE_API_KEY.",
      "",
      "PowerShell:",
      '  $env:HYZE_API_KEY="hyze_xxx"',
      "  bun run smoke",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const hyze = new HyzeCloud({
  apiKey,
  ...(baseUrl ? { baseUrl } : {}),
  ...(workspaceId ? { workspaceId } : {}),
});

type StepResult = {
  name: string;
  ok: boolean;
  /** Soft failure (known limitation) — does not fail the smoke exit code */
  soft?: boolean;
  detail?: string;
  status?: number;
  ms?: number;
};

type StepOptions = {
  /** HTTP statuses treated as soft pass (e.g. session-only endpoints under API key) */
  softStatuses?: number[];
  softNote?: string;
};

const results: StepResult[] = [];
const line = "─".repeat(64);
const stamp = Date.now().toString(36);
const smokeDbName = `smoke-db-${stamp}`;
const smokeAppName = `smoke-app-${stamp}`;
/** API expects full host: `prefix.hyzecloud.app`, not just the label. */
const smokeSubdomain = `smoke-${stamp}.${baseDomain}`;

const green = (t: string) => `\x1b[32m${t}\x1b[0m`;
const red = (t: string) => `\x1b[31m${t}\x1b[0m`;
const cyan = (t: string) => `\x1b[36m${t}\x1b[0m`;
const dim = (t: string) => `\x1b[2m${t}\x1b[0m`;
const yellow = (t: string) => `\x1b[33m${t}\x1b[0m`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Minimal ZIP (store / no compression) for deployFromZip ───────────────────

function crc32(data: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!;
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Build an in-memory ZIP with stored (uncompressed) entries. */
function zipStore(files: Array<{ name: string; content: string | Uint8Array }>): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data =
      typeof file.content === "string"
        ? new TextEncoder().encode(file.content)
        : file.content;
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concat(centrals);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...locals, centralDir, end]);
}

function buildSmokeAppZip(): Uint8Array {
  return zipStore([
    {
      name: "package.json",
      content: JSON.stringify(
        {
          name: "hyze-smoke-app",
          version: "0.0.1",
          private: true,
          main: "server.js",
        },
        null,
        2,
      ),
    },
    {
      name: "server.js",
      content: [
        'const http = require("http");',
        "const port = Number(process.env.PORT || process.env.EXPOSE_PORT || 3000);",
        "const server = http.createServer((req, res) => {",
        '  res.writeHead(200, { "Content-Type": "text/plain" });',
        '  res.end("hyze smoke ok\\n");',
        "});",
        "server.listen(port, () => {",
        '  console.log("smoke listening on", port);',
        "});",
        "",
      ].join("\n"),
    },
  ]);
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function redactSecrets(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (
      /password|secret|token|authorization|connectionstring|apikey|api_key|brcode|brcodebase64/i.test(
        key,
      )
    ) {
      if (typeof item === "string" && item.length > 0) {
        out[key] =
          item.length <= 8 ? "[redacted]" : `${item.slice(0, 4)}…[redacted] (${item.length} chars)`;
      } else {
        out[key] = "[redacted]";
      }
      continue;
    }
    out[key] = redactSecrets(item);
  }
  return out;
}

function cleanDockerLogs(raw: string): string {
  return raw
    .replace(/[\u0001\u0002\u0003]./g, "")
    .replace(/\r/g, "")
    .trim();
}

function formatBody(data: unknown): string {
  try {
    let value = redactSecrets(data);
    if (
      value &&
      typeof value === "object" &&
      typeof (value as { logs?: unknown }).logs === "string"
    ) {
      value = {
        ...(value as object),
        logs: cleanDockerLogs((value as { logs: string }).logs),
      };
    }
    const pretty = JSON.stringify(value, null, 2);
    if (pretty.length <= maxChars) return pretty;
    return `${pretty.slice(0, maxChars)}\n… truncated (${pretty.length} chars · HYZE_SMOKE_MAX_CHARS=${maxChars})`;
  } catch {
    return String(data);
  }
}

function countByStatus(items: Array<{ status?: string }> | undefined): string {
  if (!items?.length) return "0";
  const map = new Map<string, number>();
  for (const item of items) {
    const s = String(item.status ?? "unknown");
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([status, n]) => `${status}=${n}`)
    .join(", ");
}

function oneLineSummary(data: unknown): string {
  if (data === null || data === undefined) return "null";
  if (typeof data === "string") return JSON.stringify(data);
  if (typeof data !== "object") return String(data);

  const obj = data as Record<string, unknown>;
  const bits: string[] = [];

  if ("success" in obj) bits.push(`success=${String(obj.success)}`);

  if (Array.isArray(obj.apps)) {
    const apps = obj.apps as Array<{ status?: string; name?: string }>;
    bits.push(`apps=${apps.length}`);
    bits.push(countByStatus(apps));
  }

  if (Array.isArray(obj.databases)) {
    const dbs = obj.databases as Array<{ status?: string; engine?: string; name?: string }>;
    bits.push(`databases=${dbs.length}`);
    bits.push(countByStatus(dbs));
    const enginesSeen = [...new Set(dbs.map((d) => d.engine).filter(Boolean))];
    if (enginesSeen.length) bits.push(`engines=${enginesSeen.join(",")}`);
  }

  if (obj.database && typeof obj.database === "object") {
    const db = obj.database as Record<string, unknown>;
    bits.push(
      `db=${String(db.name ?? db.id ?? "?")}`,
      `engine=${String(db.engine ?? "?")}`,
      `status=${String(db.status ?? "?")}`,
      db.memoryMB != null ? `mem=${db.memoryMB}MB` : "",
      db.host ? `host=${db.host}` : "",
      db.port != null ? `port=${db.port}` : "",
    );
  }

  if (Array.isArray(obj.backups)) {
    bits.push(`backups=${obj.backups.length}`);
    bits.push(countByStatus(obj.backups as Array<{ status?: string }>));
  }

  if (obj.backup && typeof obj.backup === "object") {
    const b = obj.backup as Record<string, unknown>;
    bits.push(
      `backup=${String(b.id ?? "?")}`,
      b.status != null ? `status=${b.status}` : "",
      b.sizeBytes != null ? `size=${b.sizeBytes}B` : "",
    );
  }

  if (Array.isArray(obj.invoices)) {
    const inv = obj.invoices as Array<{ status?: string; amount?: number; planId?: string }>;
    bits.push(`invoices=${inv.length}`);
    bits.push(countByStatus(inv));
    const paid = inv.filter((i) => String(i.status).toUpperCase() === "PAID");
    if (paid.length) {
      const cents = paid.reduce((s, i) => s + Number(i.amount ?? 0), 0);
      bits.push(`paidTotal=R$${(cents / 100).toFixed(2)}`);
    }
  }

  if (Array.isArray(obj.apiKeys)) bits.push(`apiKeys=${obj.apiKeys.length}`);
  if (Array.isArray(obj.keys)) bits.push(`keys=${obj.keys.length}`);

  if (obj.plan && typeof obj.plan === "object") {
    const plan = obj.plan as Record<string, unknown>;
    bits.push(`plan=${String(plan.name ?? plan.id ?? "?")}`);
    if (plan.totalRAM != null) bits.push(`totalRAM=${plan.totalRAM}MB`);
  }
  if (obj.usage && typeof obj.usage === "object") {
    const usage = obj.usage as Record<string, unknown>;
    if (usage.usedRAM != null && usage.availableRAM != null) {
      bits.push(`RAM ${usage.usedRAM}/${Number(usage.usedRAM) + Number(usage.availableRAM)}MB`);
    } else if (usage.usedRAM != null) {
      bits.push(`usedRAM=${usage.usedRAM}MB`);
    }
    if (usage.ramPercentage != null) bits.push(`${usage.ramPercentage}%`);
  }

  if (obj.container && typeof obj.container === "object") {
    const c = obj.container as Record<string, unknown>;
    bits.push(
      `container=${String(c.name ?? c.id ?? "?")}`,
      `status=${String(c.status ?? "?")}`,
      c.publishedPort != null ? `port=${c.publishedPort}` : "",
      c.publicUrl ? `url=${c.publicUrl}` : "",
      c.runtime ? `runtime=${c.runtime}` : "",
    );
    if (c.stats && typeof c.stats === "object") {
      const s = c.stats as Record<string, unknown>;
      bits.push(`cpu=${s.cpuPercent}%`, `mem=${s.memoryMB}/${s.memoryLimitMB}MB`);
    }
  }

  if (typeof obj.appId === "string") bits.push(`appId=${obj.appId}`);
  if (typeof obj.publicUrl === "string") bits.push(`publicUrl=${obj.publicUrl}`);
  if (obj.publishedPort != null) bits.push(`publishedPort=${obj.publishedPort}`);

  if (typeof obj.logs === "string") {
    const cleaned = cleanDockerLogs(obj.logs);
    const lines = cleaned.split("\n").filter(Boolean);
    bits.push(`logs=${lines.length} lines`);
    if (lines[0]) bits.push(`last="${lines[lines.length - 1]!.slice(0, 60)}"`);
  }

  if (obj.envVars && typeof obj.envVars === "object") {
    const keys = Object.keys(obj.envVars as object);
    bits.push(`envKeys=${keys.length}`);
    if (keys.length && keys.length <= 8) bits.push(`env=[${keys.join(", ")}]`);
  }

  if (obj.connected !== undefined) bits.push(`connected=${String(obj.connected)}`);
  if (obj.accountLogin) bits.push(`github=${String(obj.accountLogin)}`);
  if (obj.installationId) bits.push(`install=${String(obj.installationId)}`);
  if (obj.provider) bits.push(`provider=${String(obj.provider)}`);

  if (obj.meta && typeof obj.meta === "object" && "total" in (obj.meta as object)) {
    bits.push(`meta.total=${String((obj.meta as { total: unknown }).total)}`);
  }

  const filtered = bits.filter(Boolean);
  if (filtered.length === 0) {
    return `keys=[${Object.keys(obj).slice(0, 10).join(", ")}]`;
  }
  return filtered.join(" · ");
}

function extractAppId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.appId === "string" && obj.appId) return obj.appId;
  if (obj.container && typeof obj.container === "object") {
    const id = (obj.container as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  if (typeof obj.id === "string" && obj.id) return obj.id;
  return null;
}

function extractDatabase(data: unknown): DatabaseItem | null {
  if (!data || typeof data !== "object") return null;
  const db = (data as { database?: DatabaseItem }).database;
  return db?.id ? db : null;
}

async function step<T>(
  name: string,
  fn: () => Promise<T>,
  options: StepOptions = {},
): Promise<T | null> {
  console.log(`\n${line}`);
  console.log(cyan(`STEP  ${name}`));
  console.log(line);

  const started = Date.now();
  try {
    const data = await fn();
    const ms = Date.now() - started;
    const summary = oneLineSummary(data);

    console.log(`${green("OK")}  ${dim(`${ms}ms`)}  ${summary}`);

    if (!compact) {
      console.log(dim("\nresponse body:"));
      console.log(formatBody(data));
    }

    results.push({ name, ok: true, detail: summary, ms });
    return data;
  } catch (err) {
    const ms = Date.now() - started;

    if (err instanceof HyzeError) {
      const soft =
        options.softStatuses?.includes(err.status) === true;
      const mark = soft ? yellow("SOFT") : red("FAIL");
      console.log(
        `${mark}  ${dim(`${ms}ms`)}  ${yellow(String(err.status))} ${err.code ?? ""} · ${err.message}`.trim(),
      );
      if (soft && options.softNote) {
        console.log(dim(`note: ${options.softNote}`));
      }
      if (err.retryAfterSeconds != null) {
        console.log(dim(`retry-after: ${err.retryAfterSeconds}s`));
      }
      if (!compact && err.body !== undefined) {
        console.log(dim("\nerror body:"));
        console.log(formatBody(err.body));
      }
      results.push({
        name,
        ok: soft,
        soft,
        status: err.status,
        ms,
        detail: soft
          ? `soft ${err.status}: ${options.softNote ?? err.message}`
          : `${err.status} ${err.code ?? ""} ${err.message}`.trim(),
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${red("FAIL")}  ${dim(`${ms}ms`)}  ${message}`);
      if (!compact && err instanceof Error && err.stack) {
        console.log(dim(err.stack));
      }
      results.push({ name, ok: false, ms, detail: message });
    }

    return null;
  }
}

async function waitForDatabaseStatus(
  databaseId: string,
  wanted: DatabaseStatus[],
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<DatabaseItem | null> {
  const timeoutMs = opts?.timeoutMs ?? 90_000;
  const intervalMs = opts?.intervalMs ?? 3_000;
  const started = Date.now();
  let last: DatabaseItem | null = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await hyze.databases.get(databaseId);
      last = res.database;
      if (wanted.includes(res.database.status as DatabaseStatus)) {
        return res.database;
      }
      if (res.database.status === "failed") {
        return res.database;
      }
    } catch {
      // keep polling
    }
    await sleep(intervalMs);
  }

  return last;
}

async function waitForAppReady(
  appId: string,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<string | null> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const intervalMs = opts?.intervalMs ?? 4_000;
  const started = Date.now();
  let lastStatus: string | null = null;

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await hyze.apps.get(appId);
      lastStatus = String(res.container.status ?? "unknown");
      if (lastStatus === "running" || lastStatus === "stopped" || lastStatus === "error") {
        return lastStatus;
      }
    } catch {
      // keep polling
    }
    await sleep(intervalMs);
  }

  return lastStatus;
}

// ── Run ──────────────────────────────────────────────────────────────────────

console.log(line);
console.log(cyan("Hyze Cloud SDK — live smoke"));
console.log(line);
console.log(`baseUrl      : ${baseUrl ?? "https://api.hyzecloud.com/api (default)"}`);
console.log(`workspaceId  : ${workspaceId ?? "(none)"}`);
console.log(
  `apiKey       : ${apiKey.slice(0, 8)}…${apiKey.slice(-4)} (${apiKey.length} chars)`,
);
console.log(`mode         : ${readOnly ? "read-only" : "read + write"}`);
console.log(`cleanup      : ${readOnly ? "n/a" : keepResources ? "keep resources" : "delete created"}`);
console.log(`engine       : ${engine} · memoryMB=${memoryMB}`);
console.log(`app host     : ${smokeSubdomain}`);
console.log(`mode dump    : ${compact ? "compact" : `full body (max ${maxChars} chars)`}`);
console.log(
  dim(
    "tip: HYZE_SMOKE_READ_ONLY=1 · HYZE_SMOKE_KEEP=1 · HYZE_SMOKE_COMPACT=1 · HYZE_SMOKE_ENGINE=postgresql",
  ),
);

// ── Read-only baseline ───────────────────────────────────────────────────────

console.log(`\n${cyan("▸ READ")}`);

const appsList = await step("apps.list", () => hyze.apps.list());
await step("databases.list", () => hyze.databases.list());
// better-auth listApiKeys uses the session from request headers; Bearer API keys
// pass our route auth but often get 401 from the better-auth list call itself.
await step("apiKeys.list", () => hyze.apiKeys.list(), {
  softStatuses: [401],
  softNote:
    "api-keys list may require session cookie; Bearer API key auth often returns 401 from better-auth listApiKeys",
});
await step("invoices.list", () => hyze.invoices.list());
await step("plans.current", () => hyze.plans.current());
await step("github.status", () => hyze.github.status());

const preferred =
  appsList?.apps.find((a) => a.status === "running") ?? appsList?.apps.find((a) => a.id);

if (preferred?.id) {
  console.log(
    `\n${dim(`using existing app for detail checks: ${preferred.name} (${preferred.status})`)}`,
  );
  await step("apps.get (existing)", () => hyze.apps.get(preferred.id));
  await step("apps.logs (existing, tail=20)", () =>
    hyze.apps.logs(preferred.id, { tail: 20 }),
  );
  await step("apps.getEnv (existing)", () => hyze.apps.getEnv(preferred.id));
} else {
  console.log(`\n${dim("(no existing apps — skipped detail checks on list item)")}`);
}

// ── Write: database ──────────────────────────────────────────────────────────

let createdDbId: string | null = null;
let createdAppId: string | null = null;

if (!readOnly) {
  console.log(`\n${cyan("▸ WRITE · database")}`);

  const createdDb = await step("databases.create", () =>
    hyze.databases.create({
      name: smokeDbName,
      engine,
      memoryMB,
      storageGB: 1,
      ...(workspaceId ? { workspaceId } : {}),
    }),
  );

  createdDbId = extractDatabase(createdDb)?.id ?? null;

  if (createdDbId) {
    await step("databases.get (status)", () => hyze.databases.get(createdDbId!));

    const ready = await step("databases.wait (running|failed)", async () => {
      const db = await waitForDatabaseStatus(createdDbId!, ["running", "failed"]);
      if (!db) throw new Error("timeout waiting for database status");
      return { success: true as const, database: db };
    });

    const dbStatus = ready?.database.status;
    if (dbStatus === "running") {
      await step("databases.stats", () => hyze.databases.stats(createdDbId!));
      await step("databases.logs (tail=20)", () =>
        hyze.databases.logs(createdDbId!, { tail: 20 }),
      );
      await step("databases.operations", () => hyze.databases.operations(createdDbId!));

      await step("databases.createBackup", () => hyze.databases.createBackup(createdDbId!));
      await step("databases.listBackups", () => hyze.databases.listBackups(createdDbId!));
    } else {
      console.log(
        dim(
          `\n(database status=${dbStatus ?? "unknown"} — skipped stats/logs/backup)`,
        ),
      );
    }
  } else {
    console.log(dim("\n(databases.create failed — skipped db follow-ups)"));
  }

  // ── Write: app ─────────────────────────────────────────────────────────────

  console.log(`\n${cyan("▸ WRITE · app")}`);

  const zip = buildSmokeAppZip();
  console.log(dim(`deploy zip size: ${zip.byteLength} bytes · subdomain=${smokeSubdomain}`));

  const deployed = await step("apps.deployFromZip", () =>
    hyze.apps.deployFromZip({
      file: zip,
      filename: "smoke-app.zip",
      name: smokeAppName,
      runtime: "node",
      memoryMB,
      startupCommand: "node server.js",
      exposePort: 3000,
      subdomain: smokeSubdomain,
      autoRestart: true,
      // NODE_ENV / PORT / PATH / HYZE_* etc. are forbidden by the API
      envVars: {
        SMOKE: "1",
        SMOKE_MARKER: "deploy",
      },
      ...(workspaceId ? { workspaceId } : {}),
    }),
  );

  createdAppId = extractAppId(deployed);

  if (createdAppId) {
    await step("apps.get (after deploy)", () => hyze.apps.get(createdAppId!));

    const appStatus = await step("apps.wait (running|stopped|error)", async () => {
      const status = await waitForAppReady(createdAppId!);
      if (!status) throw new Error("timeout waiting for app status");
      return { success: true as const, status };
    });

    const status = (appStatus as { status?: string } | null)?.status;

    await step("apps.logs (tail=30)", () => hyze.apps.logs(createdAppId!, { tail: 30 }));
    await step("apps.getEnv", () => hyze.apps.getEnv(createdAppId!));
    const envUpdated = await step("apps.setEnv", () =>
      hyze.apps.setEnv(createdAppId!, {
        SMOKE: "1",
        SMOKE_MARKER: "updated",
        SMOKE_UPDATED_AT: new Date().toISOString(),
      }),
    );
    const beforeRedeployContainerId = envUpdated?.container?.id;
    await step("apps.getEnv (after set)", () => hyze.apps.getEnv(createdAppId!));
    await step("apps.deployments", () => hyze.apps.deployments(createdAppId!));
    const redeployed = await step("apps.redeployFromZip", () =>
      hyze.apps.redeployFromZip(createdAppId!, zip, "smoke-redeploy.zip"),
    );
    await step("apps.waitForRunning (redeploy)", () => hyze.apps.waitForRunning(createdAppId!));
    if (beforeRedeployContainerId && redeployed?.containerId === beforeRedeployContainerId) {
      throw new Error("Immutable redeploy did not produce a new container id");
    }
    if (!redeployed?.success || redeployed.appId !== createdAppId) {
      throw new Error("ZIP redeploy returned an invalid success response");
    }
    const rebuild = await step("apps.rebuild", () => hyze.apps.rebuild(createdAppId!));
    if (!rebuild?.deploymentId) throw new Error("Rebuild did not return deploymentId");
    await step("apps.waitForDeployment", () => hyze.apps.waitForDeployment(createdAppId!, rebuild.deploymentId));
    await step("apps.waitForRunning (rebuild)", () => hyze.apps.waitForRunning(createdAppId!));
    await step("apps.updateSettings", () =>
      hyze.apps.updateSettings(createdAppId!, {
        name: `${smokeAppName}-renamed`,
        autoRestart: true,
      }),
    );

    if (status === "running") {
      await step("apps.restart", () => hyze.apps.restart(createdAppId!));
      await sleep(2_000);
      await step("apps.get (after restart)", () => hyze.apps.get(createdAppId!));

      await step("apps.stop", () => hyze.apps.stop(createdAppId!));
      await sleep(2_000);
      await step("apps.get (after stop)", () => hyze.apps.get(createdAppId!));

      await step("apps.start", () => hyze.apps.start(createdAppId!));
      await sleep(2_000);
      await step("apps.get (after start)", () => hyze.apps.get(createdAppId!));

      await step("apps.createBackup", () => hyze.apps.createBackup(createdAppId!));
      await step("apps.listBackups", () => hyze.apps.listBackups(createdAppId!));
    } else {
      console.log(
        dim(
          `\n(app status=${status ?? "unknown"} — skipped restart/stop/start/backup lifecycle)`,
        ),
      );
      // still try backup list if container exists
      await step("apps.listBackups", () => hyze.apps.listBackups(createdAppId!));
    }
  } else {
    console.log(dim("\n(apps.deployFromZip failed — skipped app follow-ups)"));
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  console.log(`\n${cyan("▸ CLEANUP")}`);

  if (keepResources) {
    console.log(
      dim(
        `keeping resources (HYZE_SMOKE_KEEP=1):\n  db=${createdDbId ?? "—"}\n  app=${createdAppId ?? "—"}`,
      ),
    );
  } else {
    if (createdAppId) {
      await step("apps.delete (cleanup)", () => hyze.apps.delete(createdAppId!));
    } else {
      console.log(dim("(no app to delete)"));
    }
    if (createdDbId) {
      await step("databases.delete (cleanup)", () => hyze.databases.delete(createdDbId!));
    } else {
      console.log(dim("(no database to delete)"));
    }
  }
} else {
  console.log(`\n${dim("write steps skipped (HYZE_SMOKE_READ_ONLY=1)")}`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok && !r.soft).length;
const soft = results.filter((r) => r.soft).length;
const failed = results.filter((r) => !r.ok).length;
const totalMs = results.reduce((sum, r) => sum + (r.ms ?? 0), 0);

console.log(`\n${line}`);
console.log(cyan("SUMMARY"));
console.log(line);

for (const r of results) {
  const mark = r.soft ? yellow("SOFT") : r.ok ? green("PASS") : red("FAIL");
  const timing = dim(`${String(r.ms ?? 0).padStart(5)}ms`);
  console.log(
    `${mark}  ${timing}  ${r.name}${r.ok && !r.soft ? "" : `  ${dim(r.detail ?? "")}`}`,
  );
}

console.log(line);
console.log(
  `${passed} passed · ${soft} soft · ${failed} failed · ${results.length} steps · ${totalMs}ms`,
);

if (!readOnly && !keepResources) {
  console.log(
    dim(
      `created then cleaned: db=${createdDbId ?? "—"} · app=${createdAppId ?? "—"}`,
    ),
  );
}

if (failed > 0) {
  console.log(red("\nSmoke finished with failures."));
  process.exit(1);
}

console.log(green("\nAll smoke checks passed."));
