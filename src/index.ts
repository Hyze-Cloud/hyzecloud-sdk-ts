export { HyzeCloud } from "./client.js";
export { HyzeError, looksLikeErrorPayload, parseErrorBody } from "./errors.js";
export type { HyzeErrorBody } from "./errors.js";
export type {
  ApiKeyCreated,
  ApiKeyCreateResponse,
  ApiKeyItem,
  ApiKeysListResponse,
  ApiKeyUpdateResponse,
  AppDeployment,
  AppDeploymentsResponse,
  AppDeploymentStatus,
  AppDetail,
  AppDetailResponse,
  AppEnvResponse,
  AppListItem,
  AppListStatus,
  AppLogsResponse,
  AppsListResponse,
  AppSummary,
  BillingInterval,
  ContainerStats,
  CreateApiKeyInput,
  CreateDatabaseInput,
  CreatePixInvoiceInput,
  CurrentPlanResponse,
  DatabaseEngine,
  DatabaseItem,
  DatabaseResponse,
  DatabasesListResponse,
  DatabaseStatus,
  DeployFromRepoInput,
  DeployFromZipInput,
  GithubStatusResponse,
  HyzeClientOptions,
  InvoiceBilling,
  InvoiceDetail,
  InvoiceDetailResponse,
  InvoiceListItem,
  InvoicePlanSummary,
  InvoicesListResponse,
  InvoiceStatus,
  PlanInfo,
  PlanPriceInfo,
  PlansListResponse,
  PlanUsage,
  RequestOptions,
  Runtime,
  UpdateApiKeyInput,
  UpdateAppSettingsInput,
} from "./types.js";

export { AppsResource } from "./resources/apps.js";
export { DatabasesResource } from "./resources/databases.js";
export { ApiKeysResource } from "./resources/api-keys.js";
export { InvoicesResource } from "./resources/invoices.js";
export { GithubResource } from "./resources/github.js";
export { PlansResource } from "./resources/plans.js";

import { HyzeCloud } from "./client.js";
import type { HyzeClientOptions } from "./types.js";

/** Convenience factory */
export function createHyzeClient(options?: HyzeClientOptions) {
  return new HyzeCloud(options);
}
