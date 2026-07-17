# @hyzecloud/sdk

Official **Node.js / Bun** SDK for the [Hyze Cloud API](https://docs.hyzecloud.app).

- Zero runtime dependencies (uses native `fetch`)
- Works on **Node 18+** and **Bun**
- Typed helpers for apps, databases, API keys, invoices, GitHub, plans
- Consistent `HyzeError` with status / code / `Retry-After`

## Install

```bash
npm install @hyzecloud/sdk
# or
bun add @hyzecloud/sdk
```

## Quickstart

```ts
import { HyzeCloud, HyzeError } from "@hyzecloud/sdk";

const hyze = new HyzeCloud({
  apiKey: process.env.HYZE_API_KEY, // hyze_...
  // baseUrl: "https://api.hyzecloud.com/api", // default
  // workspaceId: "org_...", // optional
});

const { apps } = await hyze.apps.list();
console.log(apps.map((a) => `${a.name} (${a.status})`));

try {
  await hyze.apps.restart("app_001");
} catch (err) {
  if (err instanceof HyzeError) {
    console.error(err.status, err.code, err.message);
    if (err.isRateLimited) console.error("retry after", err.retryAfterSeconds);
  }
  throw err;
}
```

## Apps

```ts
// List / get (typed public shapes)
const list = await hyze.apps.list();
// list.apps[0]: id, name, workspaceId, runtime, status, ramMB, domain, ...

const detail = await hyze.apps.get("app_001");
// detail.container: id (app id), publicUrl, stats, sourceRepo*, no Docker image

// Lifecycle
await hyze.apps.start("app_001");
await hyze.apps.stop("app_001");
await hyze.apps.restart("app_001");

// Logs & env
await hyze.apps.logs("app_001", { tail: 200, timestamps: true });
await hyze.apps.getEnv("app_001");
await hyze.apps.setEnv("app_001", { NODE_ENV: "production" });

// Deploy from ZIP (Node / Bun)
import { readFileSync } from "node:fs";

await hyze.apps.deployFromZip({
  file: readFileSync("./app.zip"),
  name: "my-api",
  runtime: "node",
  memoryMB: 512,
  startupCommand: "node server.js",
  exposePort: 3000,
  subdomain: "my-api",
});

// Deploy from GitHub
await hyze.apps.deployFromRepo({
  name: "my-api",
  runtime: "bun",
  memoryMB: 512,
  startupCommand: "bun run src/index.ts",
  repository: {
    id: 123,
    owner: "acme",
    name: "api",
    branch: "main",
  },
});
```

## Databases

```ts
await hyze.databases.create({
  name: "prod-postgres",
  engine: "postgresql",
  memoryMB: 1024,
  storageGB: 20,
});

await hyze.databases.list();
await hyze.databases.start("db_001");
await hyze.databases.createBackup("db_001");
```

## API keys, invoices, GitHub, plans

```ts
const { keys } = await hyze.apiKeys.list();
const created = await hyze.apiKeys.create({ name: "ci" });
// created.key.key is the one-time secret

const { invoices } = await hyze.invoices.list();
// list items: no PIX / provider internals
const pix = await hyze.invoices.createPix({ planId: "pro", interval: "month" });
// pix.invoice.brCode / brCodeBase64 for checkout

await hyze.github.status();
await hyze.github.repos();

const current = await hyze.plans.current();
// current.plan + current.usage (no nested apps/databases arrays)
```

## Low-level access

```ts
// Any path under the API base
await hyze.get("/apps/");
await hyze.post("/apps/app_001/restart");
await hyze.request("/apps/", { method: "GET", query: { workspaceId: "org_1" } });
```

## Environment

| Variable | Description |
| --- | --- |
| `HYZE_API_KEY` | Default API key if `apiKey` is omitted |
| `HYZE_API_URL` | Override base URL (default `https://api.hyzecloud.com/api`) |
| `HYZE_WORKSPACE_ID` | Optional workspace scope for smoke / client |

## Live smoke test (API real)

Read-only (list/get/logs). Prints full JSON body per step (secrets redacted).

```bash
cd hyzecloud-sdk

# PowerShell
$env:HYZE_API_KEY="hyze_sua_chave"
bun run smoke

# bash
HYZE_API_KEY=hyze_sua_chave bun run smoke

# local API
HYZE_API_KEY=hyze_xxx HYZE_API_URL=http://127.0.0.1:3001/api bun run smoke

# compact (one line only)
HYZE_SMOKE_COMPACT=1 bun run smoke

# larger body dump (default 4000 chars)
HYZE_SMOKE_MAX_CHARS=12000 bun run smoke
```

Script: `scripts/live-smoke.ts`

## Docs

- [Hyze Cloud Docs](https://docs.hyzecloud.app)
- [API introduction](https://docs.hyzecloud.app/api-reference/introduction)
- [Rate limits](https://docs.hyzecloud.app/en/concepts/rate-limits)

## License

MIT
