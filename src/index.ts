export { HyzeCloud } from "./client";
export { HyzeError, looksLikeErrorPayload, parseErrorBody } from "./errors";
export type { HyzeErrorBody } from "./errors";
export type {
  AppBuildProgressResponse,
  AppDeployment,
  AppDeploymentsResponse,
  AppDeploymentStatus,
  AppDeployResponse,
  AppDetail,
  AppDetailResponse,
  AppEnvResponse,
  AppLogsResponse,
  AppRebuildResponse,
  AppsListResponse,
  AppListItem,
  AppListStatus,
  AppSummary,
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
} from "./types";

export { AppsResource } from "./resources/apps";
export { DatabasesResource } from "./resources/databases";
export { ApiKeysResource } from "./resources/api-keys";
export { InvoicesResource } from "./resources/invoices";
export { GithubResource } from "./resources/github";
export { PlansResource } from "./resources/plans";

import { HyzeCloud } from "./client";
import type { HyzeClientOptions } from "./types";

/** Convenience factory */
export function createHyzeClient(options?: HyzeClientOptions) {
  return new HyzeCloud(options);
}
