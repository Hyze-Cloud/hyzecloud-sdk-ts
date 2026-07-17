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
 *
 * READ-ONLY.
 */

import { HyzeCloud, HyzeError } from "../src/index";

const apiKey = process.env.HYZE_API_KEY?.trim();
const baseUrl = process.env.HYZE_API_URL?.trim();
const workspaceId = process.env.HYZE_WORKSPACE_ID?.trim();
const compact =
  process.env.HYZE_SMOKE_COMPACT === "1" || process.env.HYZE_SMOKE_COMPACT === "true";
const maxChars = Math.max(500, Number(process.env.HYZE_SMOKE_MAX_CHARS ?? 4000) || 4000);

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
  detail?: string;
  status?: number;
  ms?: number;
};

const results: StepResult[] = [];
const line = "─".repeat(64);

const green = (t: string) => `\x1b[32m${t}\x1b[0m`;
const red = (t: string) => `\x1b[31m${t}\x1b[0m`;
const cyan = (t: string) => `\x1b[36m${t}\x1b[0m`;
const dim = (t: string) => `\x1b[2m${t}\x1b[0m`;
const yellow = (t: string) => `\x1b[33m${t}\x1b[0m`;

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
  // Strip Docker multiplex header bytes that show as \u0001(
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

function countByStatus(
  items: Array<{ status?: string }> | undefined,
): string {
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
    const engines = [...new Set(dbs.map((d) => d.engine).filter(Boolean))];
    if (engines.length) bits.push(`engines=${engines.join(",")}`);
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
    );
    if (c.stats && typeof c.stats === "object") {
      const s = c.stats as Record<string, unknown>;
      bits.push(`cpu=${s.cpuPercent}%`, `mem=${s.memoryMB}/${s.memoryLimitMB}MB`);
    }
  }

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

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
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
      console.log(
        `${red("FAIL")}  ${dim(`${ms}ms`)}  ${yellow(String(err.status))} ${err.code ?? ""} · ${err.message}`.trim(),
      );
      if (err.retryAfterSeconds != null) {
        console.log(dim(`retry-after: ${err.retryAfterSeconds}s`));
      }
      if (!compact && err.body !== undefined) {
        console.log(dim("\nerror body:"));
        console.log(formatBody(err.body));
      }
      results.push({
        name,
        ok: false,
        status: err.status,
        ms,
        detail: `${err.status} ${err.code ?? ""} ${err.message}`.trim(),
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

console.log(line);
console.log(cyan("Hyze Cloud SDK — live smoke (read-only)"));
console.log(line);
console.log(`baseUrl      : ${baseUrl ?? "https://api.hyzecloud.com/api (default)"}`);
console.log(`workspaceId  : ${workspaceId ?? "(none)"}`);
console.log(
  `apiKey       : ${apiKey.slice(0, 8)}…${apiKey.slice(-4)} (${apiKey.length} chars)`,
);
console.log(`mode         : ${compact ? "compact" : `full body (max ${maxChars} chars)`}`);
console.log(
  dim(
    "tip: HYZE_SMOKE_COMPACT=1 for short logs · HYZE_SMOKE_MAX_CHARS=8000 for bigger bodies",
  ),
);

const appsList = await step("apps.list", () => hyze.apps.list());

await step("databases.list", () => hyze.databases.list());
await step("apiKeys.list", () => hyze.apiKeys.list());
await step("invoices.list", () => hyze.invoices.list());
await step("plans.current", () => hyze.plans.current());
await step("github.status", () => hyze.github.status());

const preferred =
  appsList?.apps.find((a) => a.status === "running") ?? appsList?.apps.find((a) => a.id);

if (preferred?.id) {
  console.log(
    `\n${dim(`using app for detail checks: ${preferred.name} (${preferred.status})`)}`,
  );
  await step("apps.get", () => hyze.apps.get(preferred.id));
  await step("apps.logs (tail=20)", () => hyze.apps.logs(preferred.id, { tail: 20 }));
  await step("apps.getEnv", () => hyze.apps.getEnv(preferred.id));
} else {
  console.log(`\n${dim("(no apps in workspace — skipped apps.get / logs / env)")}`);
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
const totalMs = results.reduce((sum, r) => sum + (r.ms ?? 0), 0);

console.log(`\n${line}`);
console.log(cyan("SUMMARY"));
console.log(line);

for (const r of results) {
  const mark = r.ok ? green("PASS") : red("FAIL");
  const timing = dim(`${String(r.ms ?? 0).padStart(5)}ms`);
  console.log(
    `${mark}  ${timing}  ${r.name}${r.ok ? "" : `  ${dim(r.detail ?? "")}`}`,
  );
}

console.log(line);
console.log(`${passed} passed · ${failed} failed · ${results.length} steps · ${totalMs}ms`);

if (failed > 0) {
  console.log(red("\nSmoke finished with failures."));
  process.exit(1);
}

console.log(green("\nAll smoke checks passed."));
