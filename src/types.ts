export type Runtime = "node" | "bun" | "python";
export type DatabaseEngine = "postgresql" | "mysql" | "mongodb" | "redis";

export type AppListStatus =
  | "running"
  | "stopped"
  | "paused"
  | "restarting"
  | "error"
  | "exited"
  | "created"
  | "unknown"
  | string;

export type DatabaseStatus =
  | "provisioning"
  | "running"
  | "stopped"
  | "failed"
  | "deleting"
  | "restoring"
  | string;

export type InvoiceStatus =
  | "PENDING"
  | "PAID"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED"
  | "FAILED"
  | string;

export type BillingInterval = "month" | "quarter" | "semiannual" | "year";

export type HyzeClientOptions = {
  /** API key (`hyze_...`). Required unless you pass a custom fetch with cookies. */
  apiKey?: string;
  /** Default: `https://api.hyzecloud.com/api` */
  baseUrl?: string;
  /** Optional workspace/org scope for multi-workspace keys */
  workspaceId?: string;
  /** Optional AbortSignal applied to every request unless overridden */
  signal?: AbortSignal;
  /** Custom fetch (defaults to global fetch) */
  fetch?: typeof fetch;
  /** Extra headers on every request */
  headers?: Record<string, string>;
};

export type RequestOptions = {
  method?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** When true, do not JSON-stringify body (FormData / Blob) */
  rawBody?: boolean;
  signal?: AbortSignal;
};

// ── Apps ────────────────────────────────────────────────────────────────────

/** App row from GET /apps/ */
export type AppListItem = {
  id: string;
  name: string;
  workspaceId: string;
  runtime: Runtime | string;
  status: AppListStatus;
  ramMB: number;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated Prefer AppListItem */
export type AppSummary = AppListItem;

export type ContainerStats = {
  cpuPercent: number;
  memoryMB: number;
  memoryLimitMB: number;
  pids: number;
  networkRxBytes: number;
  networkTxBytes: number;
};

/** App detail from GET /apps/:id (public shape; no Docker image/install internals). */
export type AppDetail = {
  id: string;
  name: string;
  status: string;
  createdAt?: string;
  runtime: Runtime | string;
  startupCommand?: string;
  exposePort?: number;
  subdomain?: string;
  publishedPort?: number;
  publicUrl?: string;
  autoRestart?: boolean;
  sourceType?: "zip" | "github" | string;
  sourceRepoOwner?: string;
  sourceRepoName?: string;
  sourceBranch?: string;
  sourcePath?: string;
  autoDeploy?: boolean;
  autoBackup?: boolean;
  lastAutoBackupAt?: string;
  lastDeployedCommitSha?: string;
  stats?: ContainerStats;
};

export type AppsListResponse = {
  success: true;
  apps: AppListItem[];
  meta: { total: number };
};

export type AppDetailResponse = {
  success: true;
  container: AppDetail;
};

export type AppLogsResponse = {
  success: true;
  logs: string;
};

export type AppEnvResponse = {
  success: true;
  envVars: Record<string, string>;
};

export type DeployFromZipInput = {
  file: Blob | File | Buffer | Uint8Array | ArrayBuffer;
  /** Filename for the ZIP part (default: app.zip) */
  filename?: string;
  name: string;
  runtime: Runtime;
  memoryMB: number;
  /**
   * Optional start command.
   * - Omit or pass `"auto"` → Hyze detects the right command (Vite, Next, Node, static, Python…).
   * - Pass a custom shell command to override.
   */
  startupCommand?: string;
  envVars?: Record<string, string> | string;
  exposePort?: number;
  subdomain?: string;
  autoRestart?: boolean;
  machineId?: string;
  workspaceId?: string;
};

export type DeployFromRepoInput = {
  name: string;
  runtime: Runtime;
  memoryMB: number;
  /**
   * Optional start command.
   * - Omit or pass `"auto"` → Hyze detects the right command.
   * - Pass a custom shell command to override.
   */
  startupCommand?: string;
  envVars?: Record<string, string> | string;
  exposePort?: number;
  subdomain?: string;
  autoDeploy?: boolean;
  machineId?: string;
  workspaceId?: string;
  repository: {
    id: string | number;
    owner: string;
    name: string;
    branch: string;
    path?: string;
    githubInstallationId?: string | number;
  };
};

export type UpdateAppSettingsInput = {
  name?: string;
  runtime?: Runtime;
  memoryMB?: number;
  startupCommand?: string;
  exposePort?: number | null;
  subdomain?: string | null;
  autoRestart?: boolean;
};

// ── Databases ───────────────────────────────────────────────────────────────

/** Public database row — no Docker containerId/volumeName/internal host. */
export type DatabaseItem = {
  id: string;
  name: string;
  engine: DatabaseEngine | string;
  version: string;
  status: DatabaseStatus;
  memoryMB: number;
  storageGB: number;
  /** Public proxy host when available */
  host?: string | null;
  /** Public proxy port when available */
  port?: number | null;
  username: string;
  databaseName: string;
  /** Password masked in connection string */
  connectionString?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DatabasesListResponse = {
  success: true;
  databases: DatabaseItem[];
};

export type DatabaseResponse = {
  success: true;
  database: DatabaseItem;
  operationId?: string;
};

export type CreateDatabaseInput = {
  name: string;
  engine: DatabaseEngine;
  version?: string;
  memoryMB?: number;
  storageGB?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  machineId?: string;
  workspaceId?: string;
};

// ── API keys ────────────────────────────────────────────────────────────────

export type ApiKeyItem = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  enabled: boolean;
  remaining: number | null;
  lastRequest: string | Date | null;
  expiresAt: string | Date | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

/** Present only on create — secret is shown once. */
export type ApiKeyCreated = ApiKeyItem & {
  key?: string;
};

export type ApiKeysListResponse = {
  success: true;
  keys: ApiKeyItem[];
};

export type ApiKeyCreateResponse = {
  success: true;
  key: ApiKeyCreated;
};

export type ApiKeyUpdateResponse = {
  success: true;
  key: ApiKeyItem;
};

export type CreateApiKeyInput = {
  name: string;
  expiresIn?: number | null;
  remaining?: number;
  /** Server forces workspace binding; client metadata is merged safely. */
  metadata?: Record<string, unknown>;
};

export type UpdateApiKeyInput = {
  name?: string;
  enabled?: boolean;
  remaining?: number;
  metadata?: Record<string, unknown>;
};

// ── Invoices ────────────────────────────────────────────────────────────────

export type InvoicePlanSummary = {
  id: string;
  name: string;
  price: number;
};

export type InvoiceBilling = {
  interval: BillingInterval | string;
  months: number;
  discountPercent: number;
  priceCents: number;
  planExpiresAt: string | Date | null;
  planPriceId?: string | null;
};

/** List item — no PIX payload or provider internals. */
export type InvoiceListItem = {
  id: string;
  planId: string;
  method: string;
  amount: number;
  status: InvoiceStatus;
  expiresAt: string | Date | null;
  paidAt: string | Date | null;
  appliedAt: string | Date | null;
  failureReason: string | null;
  createdAt: string | Date;
  billing: InvoiceBilling;
  plan: InvoicePlanSummary | null;
};

/** Checkout / status — PIX fields only when includePix or on create. */
export type InvoiceDetail = InvoiceListItem & {
  brCode: string | null;
  brCodeBase64: string | null;
};

export type InvoicesListResponse = {
  success: true;
  invoices: InvoiceListItem[];
};

export type InvoiceDetailResponse = {
  success: true;
  invoice: InvoiceDetail;
};

export type CreatePixInvoiceInput = {
  planId: string;
  interval?: BillingInterval;
};

// ── Plans ───────────────────────────────────────────────────────────────────

export type PlanPriceInfo = {
  id: string;
  interval: BillingInterval;
  months: number;
  discountPercent: number;
  priceCents: number;
};

export type PlanInfo = {
  id: string;
  name: string;
  price: number;
  /** List endpoints use ramMB; /current uses totalRAM (both accepted). */
  ramMB?: number;
  vcpu?: number;
  totalRAM?: number;
  totalVCPU?: number;
  estimatedProjects: number;
  prices?: PlanPriceInfo[];
};

export type PlanUsage = {
  usedRAM: number;
  availableRAM: number;
  ramPercentage: number;
  totalApps: number;
  totalDatabases: number;
};

export type CurrentPlanResponse = {
  success: true;
  plan: PlanInfo;
  usage: PlanUsage;
  billing: {
    interval: BillingInterval | string;
    months: number;
    planExpiresAt: string | Date | null;
    downgradedToFree: boolean;
  };
};

export type PlansListResponse = {
  success: true;
  plans: PlanInfo[];
};

// ── GitHub ──────────────────────────────────────────────────────────────────

export type GithubStatusResponse = {
  success: true;
  connected: boolean;
  hasRequiredScope: boolean;
  missingScopes: string[];
  provider: "github_app" | null;
  installationId?: string;
  accountLogin?: string;
  appConfigured: boolean;
};
