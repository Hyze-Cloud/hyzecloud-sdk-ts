/**
 * Framework deploy smoke — the "does Hyze identify my project and boot it" test.
 *
 * For every zip in tests/frameworks it:
 *   1. POSTs it to inspect-env and asserts the detected kind matches the manifest;
 *   2. deploys it with startupCommand "auto" (platform detection);
 *   3. waits for the container to reach "running";
 *   4. hits the app over HTTP and asserts the expected marker;
 *   5. deletes the app (unless --keep).
 *
 *   bun run frameworks:inspect   # detection only (no deploys)
 *   bun run frameworks:smoke     # full deploy + HTTP check
 *   bun run frameworks:smoke -- --only vite,next --timeout 900
 *   HYZE_FRAMEWORKS_BASE_DOMAIN=hyzecloud.app bun run frameworks:smoke
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HyzeCloud, HyzeError } from "../../src/index";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(here, "../../tests/frameworks");

type ManifestEntry = {
  id: string;
  name: string;
  file: string;
  runtime: string;
  expectedKind: string;
  exposePort: number;
  memoryMB: number;
  path: string;
  marker: string;
};

type InspectResult = {
  success?: boolean;
  kind?: string;
  confidence?: string;
  label?: string;
  runtime?: string;
  startCommand?: string;
  exposePort?: number | null;
  reasons?: string[];
};

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const inspectOnly = args.includes("--inspect-only");
const keepResources = args.includes("--keep");
const onlyArg =
  args.find((a) => a.startsWith("--only=")) ??
  (args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined);
const onlyIds = onlyArg?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
const timeoutArg =
  args.find((a) => a.startsWith("--timeout=")) ??
  (args.includes("--timeout") ? args[args.indexOf("--timeout") + 1] : undefined);
const timeoutSec = Math.max(60, Number(timeoutArg) || 600);
const httpTimeoutArg =
  args.find((a) => a.startsWith("--http-timeout=")) ??
  (args.includes("--http-timeout") ? args[args.indexOf("--http-timeout") + 1] : undefined);
const httpTimeoutMs = Math.max(30, Number(httpTimeoutArg) || 240) * 1000;

const apiKey = process.env.HYZE_API_KEY?.trim();
const baseUrl = process.env.HYZE_API_URL?.trim();
const workspaceId = process.env.HYZE_WORKSPACE_ID?.trim();
const baseDomain = (
  process.env.HYZE_FRAMEWORKS_BASE_DOMAIN ??
  process.env.APPS_BASE_DOMAIN ??
  "localtest.me"
)
  .trim()
  .toLowerCase()
  .replace(/^\.+/, "")
  .replace(/\.+$/, "");

if (!apiKey) {
  console.error("HYZE_API_KEY is required");
  process.exit(1);
}

const hyze = new HyzeCloud({
  apiKey,
  ...(baseUrl ? { baseUrl } : {}),
  ...(workspaceId ? { workspaceId } : {}),
});

// ── Colors / helpers ─────────────────────────────────────────────────────────

const green = (t: string) => `\x1b[32m${t}\x1b[0m`;
const red = (t: string) => `\x1b[31m${t}\x1b[0m`;
const cyan = (t: string) => `\x1b[36m${t}\x1b[0m`;
const dim = (t: string) => `\x1b[2m${t}\x1b[0m`;
const yellow = (t: string) => `\x1b[33m${t}\x1b[0m`;

const line = "─".repeat(64);
const stamp = Date.now().toString(36);

/** Deploy endpoint is rate-limited to 8/min per client — space deploys out. */
let deployCount = 0;

// ── Per-framework run ────────────────────────────────────────────────────────

type FrameworkReport = {
  id: string;
  name: string;
  detect: { ok: boolean; detail: string };
  deploy: { ok: boolean; detail: string };
  http: { ok: boolean; detail: string };
};

async function waitRunning(appId: string, timeoutMs: number): Promise<{ status: string; publishedPort?: number; publicUrl?: string }> {
  const deadline = Date.now() + timeoutMs;
  let last: string | null = null;
  while (Date.now() < deadline) {
    try {
      const res = await hyze.apps.get(appId);
      last = String(res.container.status ?? "unknown");
      if (last === "running" || last === "stopped" || last === "error" || last === "exited") {
        return {
          status: last,
          publishedPort: res.container.publishedPort,
          publicUrl: res.container.publicUrl,
        };
      }
    } catch {
      // keep polling
    }
    await Bun.sleep(4_000);
  }
  return { status: last ?? "unknown" };
}

async function httpCheck(
  subdomain: string,
  port: number | undefined,
  publicUrl: string | undefined,
  pathname: string,
  marker: string,
  timeoutMs: number,
): Promise<{ ok: boolean; detail: string }> {
  const attempts = [
    publicUrl ? { url: `${publicUrl.replace(/\/+$/, "")}${pathname}`, label: "publicUrl" } : null,
    port ? { url: `http://127.0.0.1:${port}${pathname}`, label: `127.0.0.1:${port}` } : null,
    port && subdomain ? { url: `http://${subdomain}:${port}${pathname}`, label: `${subdomain}:${port}` } : null,
  ].filter(Boolean) as Array<{ url: string; label: string }>;

  // "running" can be reported while the app is still booting (build-in-start
  // commands like Nuxt/Remix/SvelteKit re-build on boot) — poll until the app
  // actually answers, not just until the container is up.
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of attempts) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12_000);
        const res = await fetch(candidate.url, { signal: controller.signal });
        clearTimeout(timer);
        const body = await res.text();
        if (res.status === 200 && body.includes(marker)) {
          return { ok: true, detail: `${res.status} · "${marker}" (${candidate.label})` };
        }
        if (res.status === 200) {
          return { ok: false, detail: `${candidate.label}: 200 but marker "${marker}" not found` };
        }
      } catch {
        // try next candidate
      }
    }
    await Bun.sleep(5_000);
  }

  return { ok: false, detail: `no reachable endpoint after ${Math.round(timeoutMs / 1000)}s (publicUrl=${publicUrl ?? "—"}, port=${port ?? "—"})` };
}

async function runFramework(entry: ManifestEntry): Promise<FrameworkReport> {
  const id = entry.id;
  const zip = readFileSync(path.join(fixturesDir, entry.file));
  const subdomain = `${id}-${stamp}.${baseDomain}`;
  const startedAt = Date.now();

  console.log(`\n${line}`);
  console.log(cyan(`▸ ${entry.name}  (${entry.file})`));
  console.log(line);

  // 1) Detection — the "identify the project correctly" contract.
  let inspect: InspectResult | null = null;
  try {
    inspect = (await hyze.apps.inspectEnv(zip, entry.file)) as InspectResult;
  } catch (err) {
    const detail = err instanceof HyzeError ? `${err.status} ${err.code ?? ""} ${err.message}` : String(err);
    console.log(`  ${red("FAIL")} inspect-env: ${detail}`);
    return {
      id,
      name: entry.name,
      detect: { ok: false, detail },
      deploy: { ok: false, detail: "skipped (inspect-env failed)" },
      http: { ok: false, detail: "skipped" },
    };
  }

  const kind = String(inspect.kind ?? "?");
  const conf = String(inspect.confidence ?? "?");
  const label = String(inspect.label ?? "?");
  const startCmd = String(inspect.startCommand ?? "?");
  const reasons = (inspect.reasons ?? []).join(", ");
  console.log(
    `  inspect-env: kind=${kind} · ${conf} · ${label} · runtime=${inspect.runtime ?? "?"} · start=${startCmd}`,
  );
  if (reasons) console.log(`               ${dim(reasons)}`);

  const detectOk = kind === entry.expectedKind;
  console.log(
    detectOk
      ? `  ${green("OK")} detection matches expected kind "${entry.expectedKind}"`
      : `  ${red("FAIL")} expected kind "${entry.expectedKind}" but got "${kind}"`,
  );

  if (inspectOnly) {
    return {
      id,
      name: entry.name,
      detect: { ok: detectOk, detail: `${kind} · ${conf}` },
      deploy: { ok: true, detail: "skipped (--inspect-only)" },
      http: { ok: true, detail: "skipped" },
    };
  }

  // 2) Deploy with platform "auto" start detection.
  let appId: string | null = null;
  let deployDetail = "";
  try {
    if (deployCount > 0) {
      console.log(`  (waiting 8s — deploy rate limit is 8/min)`);
      await Bun.sleep(8_000);
    }
    deployCount++;

    // Worker restarts (dev --watch) can drop the deploy socket — retry a few times.
    const deployed = await (async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await hyze.apps.deployFromZip({
            file: zip,
            filename: entry.file,
            name: `fw-${id}-${stamp}`,
            runtime: entry.runtime as "node" | "bun" | "python",
            memoryMB: entry.memoryMB,
            exposePort: entry.exposePort,
            subdomain,
            autoRestart: true,
            ...(workspaceId ? { workspaceId } : {}),
          });
        } catch (err) {
          const retryable =
            err instanceof HyzeError &&
            (err.status === 503 ||
              err.status === 500 ||
              /socket|network|connect|timed out|Worker request/i.test(err.message));
          if (!retryable || attempt >= 3) throw err;
          console.log(`  ${yellow("RETRY")} deploy attempt ${attempt} failed (${err.message}) — retrying in 10s…`);
          await Bun.sleep(10_000);
        }
      }
    })();
    appId = deployed.appId;
    deployDetail = `appId=${appId} · ${subdomain}`;
    console.log(`  deploy      : ${deployDetail}`);
  } catch (err) {
    const detail = err instanceof HyzeError ? `${err.status} ${err.code ?? ""} ${err.message}` : String(err);
    console.log(`  ${red("FAIL")} deploy: ${detail}`);
    return {
      id,
      name: entry.name,
      detect: { ok: detectOk, detail: `${kind} · ${conf}` },
      deploy: { ok: false, detail },
      http: { ok: false, detail: "skipped" },
    };
  }

  // 3) Wait for running.
  const waitStart = Date.now();
  const container = await waitRunning(appId!, timeoutSec * 1000);
  const waitMs = Date.now() - waitStart;
  const running = container.status === "running";
  console.log(
    `  wait        : ${running ? green(container.status) : red(container.status)} (${waitMs < 10_000 ? `${waitMs}ms` : `${Math.round(waitMs / 1000)}s`})`,
  );

  // 4) HTTP check (only meaningful when the app actually booted).
  let http: { ok: boolean; detail: string } = { ok: false, detail: "skipped (not running)" };
  if (running) {
    const httpStart = Date.now();
    http = await httpCheck(subdomain, container.publishedPort, container.publicUrl, entry.path, entry.marker, httpTimeoutMs);
    const httpMs = Date.now() - httpStart;
    console.log(
      `  http ${entry.path} : ${http.ok ? green("200") : red("FAIL")} ${dim(`(${httpMs < 10_000 ? `${httpMs}ms` : `${Math.round(httpMs / 1000)}s`})`)} ${dim(http.detail)}`,
    );
  } else {
    console.log(`  ${yellow("WARN")} app not running — skipping HTTP check`);
  }

  // 5) Logs (helpful when the app failed to boot).
  try {
    const logs = await hyze.apps.logs(appId!, { tail: 60 });
    const clean = logs.logs.replace(/\u0000/g, "").trim();
    const lines = clean.split("\n").filter(Boolean);
    console.log(`  logs        : ${lines.length} lines`);
    if (!running && lines.length > 0) {
      console.log(dim(lines.slice(-8).join("\n")));
    }
  } catch {
    console.log(`  logs        : unavailable`);
  }

  // 6) Cleanup.
  if (keepResources) {
    console.log(`  ${yellow("keep")} app ${appId} (--keep)`);
  } else {
    try {
      await hyze.apps.delete(appId!);
      console.log(`  cleanup     : deleted ${appId}`);
    } catch (err) {
      console.log(`  ${yellow("WARN")} cleanup delete failed: ${String(err)}`);
    }
  }

  return {
    id,
    name: entry.name,
    detect: { ok: detectOk, detail: `${kind} · ${conf}` },
    deploy: { ok: running && container.status === "running", detail: deployDetail },
    http,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const manifest = JSON.parse(readFileSync(path.join(fixturesDir, "manifest.json"), "utf8")) as {
  frameworks: ManifestEntry[];
};

let frameworks = manifest.frameworks;
if (onlyIds.length > 0) {
  const missing = onlyIds.filter((id) => !frameworks.some((f) => f.id === id));
  if (missing.length > 0) {
    console.error(`Unknown framework ids: ${missing.join(", ")} (available: ${frameworks.map((f) => f.id).join(", ")})`);
    process.exit(1);
  }
  frameworks = frameworks.filter((f) => onlyIds.includes(f.id));
}

console.log(`\nHyze Cloud SDK — framework deploy smoke`);
console.log(`baseUrl      : ${baseUrl ?? "https://api.hyzecloud.com/api (default)"}`);
console.log(`baseDomain   : ${baseDomain}`);
console.log(`mode         : ${inspectOnly ? "inspect-env only (no deploys)" : "inspect + deploy + HTTP check"}`);
console.log(`frameworks   : ${frameworks.map((f) => f.id).join(", ")}`);
console.log(`per-app wait : ${timeoutSec}s`);

const reports: FrameworkReport[] = [];
for (const entry of frameworks) {
  reports.push(await runFramework(entry));
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${line}`);
console.log(cyan("SUMMARY"));
console.log(line);

let failures = 0;
for (const r of reports) {
  const det = r.detect.ok ? green("✓") : red("✗");
  const dep = r.deploy.ok ? green("✓") : red("✗");
  const http = r.http.ok ? green("✓") : red("✗");
  if (!r.detect.ok || !r.deploy.ok || !r.http.ok) failures++;
  console.log(
    `${r.id.padEnd(10)} detect ${det}  deploy ${dep}  http ${http}   ${dim(r.deploy.detail)}`,
  );
}
console.log(line);

if (inspectOnly) {
  const badDetect = reports.filter((r) => !r.detect.ok);
  console.log(`${reports.length - badDetect.length}/${reports.length} frameworks detected correctly.`);
  if (badDetect.length > 0) {
    console.log(red(`\nWrong detection for: ${badDetect.map((r) => r.id).join(", ")}`));
    process.exit(1);
  }
  console.log(green("\nAll framework zips are detected correctly."));
  process.exit(0);
}

console.log(
  `${reports.length - failures}/${reports.length} frameworks deployed and answered.`,
);
if (failures > 0) {
  console.log(red("\nFramework smoke finished with failures."));
  process.exit(1);
}
console.log(green("\nAll frameworks deployed, started and answered correctly."));
