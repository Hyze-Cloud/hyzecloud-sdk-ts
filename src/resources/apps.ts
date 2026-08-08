import { setTimeout as sleep } from "node:timers/promises";
import type { HyzeCloud } from "../client";
import type {
  AppBuildProgressResponse,
  AppDeploymentsResponse,
  AppDeployment,
  AppDeployResponse,
  AppDetailResponse,
  AppEnvResponse,
  AppLogsResponse,
  AppRebuildResponse,
  AppsListResponse,
  DeployFromRepoInput,
  DeployFromZipInput,
  UpdateAppSettingsInput,
} from "../types";

function toBlobPart(file: DeployFromZipInput["file"], filename: string): Blob {
  if (typeof Blob !== "undefined" && file instanceof Blob) {
    return file;
  }

  if (file instanceof ArrayBuffer) {
    return new Blob([file], { type: "application/zip" });
  }

  if (file instanceof Uint8Array) {
    // Copy into a plain ArrayBuffer slice for DOM Blob typing compatibility
    const copy = new Uint8Array(file.byteLength);
    copy.set(file);
    return new Blob([copy.buffer], { type: "application/zip" });
  }

  // Node Buffer is a Uint8Array subclass in practice
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(file)) {
    const copy = new Uint8Array(file.byteLength);
    copy.set(file);
    return new Blob([copy.buffer], { type: "application/zip" });
  }

  throw new Error(`Unsupported file type for deploy: ${typeof file} (${filename})`);
}

export class AppsResource {
  constructor(private readonly client: HyzeCloud) {}

  list(query?: { workspaceId?: string; organizationId?: string }) {
    return this.client.get<AppsListResponse>("/apps/", query);
  }

  get(appId: string) {
    return this.client.get<AppDetailResponse>(`/apps/${encodeURIComponent(appId)}`);
  }

  delete(appId: string) {
    return this.client.delete<{ success: boolean }>(`/apps/${encodeURIComponent(appId)}`);
  }

  start(appId: string) {
    return this.client.post(`/apps/${encodeURIComponent(appId)}/start`);
  }

  stop(appId: string) {
    return this.client.post(`/apps/${encodeURIComponent(appId)}/stop`);
  }

  restart(appId: string) {
    return this.client.post(`/apps/${encodeURIComponent(appId)}/restart`);
  }

  logs(
    appId: string,
    query?: {
      tail?: number;
      timestamps?: boolean;
      since?: string | number;
      until?: string | number;
    },
  ) {
    return this.client.get<AppLogsResponse>(`/apps/${encodeURIComponent(appId)}/logs`, query);
  }
  deployments(appId: string) {
    return this.client.get<AppDeploymentsResponse>(`/apps/${encodeURIComponent(appId)}/deployments`);
  }

  buildProgress(appId: string) {
    return this.client.get<AppBuildProgressResponse>(`/apps/${encodeURIComponent(appId)}/build-progress`);
  }

  redeployFromZip(appId: string, file: DeployFromZipInput["file"], filename = "app.zip") {
    const form = new FormData();
    form.append("file", toBlobPart(file, filename), filename);
    return this.client.request<AppDeployResponse>(`/apps/${encodeURIComponent(appId)}/files`, {
      method: "PUT",
      body: form,
      rawBody: true,
    });
  }

  rebuild(appId: string) {
    return this.client.post<AppRebuildResponse>(`/apps/${encodeURIComponent(appId)}/rebuild`);
  }

  async waitForDeployment(appId: string, deploymentId: string, options: { timeoutMs?: number; pollMs?: number } = {}): Promise<AppDeployment> {
    const timeoutMs = options.timeoutMs ?? 720_000;
    const pollMs = options.pollMs ?? 1_000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await this.deployments(appId);
      const deployment = result.deployments.find((item) => item.id === deploymentId);
      if (deployment?.status === "success") return deployment;
      if (deployment?.status === "failed") throw new Error(deployment.error || `Deployment ${deploymentId} failed`);
      await sleep(pollMs);
    }
    throw new Error(`Timed out waiting for deployment ${deploymentId}`);
  }

  async waitForRunning(appId: string, options: { timeoutMs?: number; pollMs?: number } = {}): Promise<AppDetailResponse["container"]> {
    const timeoutMs = options.timeoutMs ?? 720_000;
    const pollMs = options.pollMs ?? 1_000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await this.get(appId);
      if (result.container.status === "running") return result.container;
      await sleep(pollMs);
    }
    throw new Error(`Timed out waiting for app ${appId} to be running`);
  }

  getEnv(appId: string) {
    return this.client.get<AppEnvResponse>(`/apps/${encodeURIComponent(appId)}/env`);
  }

  setEnv(appId: string, envVars: Record<string, string>) {
    return this.client.put(`/apps/${encodeURIComponent(appId)}/env`, { envVars });
  }

  updateSettings(appId: string, settings: UpdateAppSettingsInput) {
    return this.client.put(`/apps/${encodeURIComponent(appId)}/settings`, settings);
  }

  /** Deploy from a ZIP file (multipart). */
  async deployFromZip(input: DeployFromZipInput) {
    const form = new FormData();
    const filename = input.filename ?? "app.zip";
    form.append("file", toBlobPart(input.file, filename), filename);
    form.append("name", input.name);
    form.append("runtime", input.runtime);
    form.append("memoryMB", String(input.memoryMB));
    // Default "auto" — platform detects start command from the project.
    form.append(
      "startupCommand",
      input.startupCommand?.trim() ? input.startupCommand.trim() : "auto",
    );

    if (input.envVars !== undefined) {
      form.append(
        "envVars",
        typeof input.envVars === "string" ? input.envVars : JSON.stringify(input.envVars),
      );
    }
    if (input.exposePort !== undefined) form.append("exposePort", String(input.exposePort));
    if (input.subdomain !== undefined) form.append("subdomain", input.subdomain);
    if (input.autoRestart !== undefined) form.append("autoRestart", String(input.autoRestart));
    if (input.machineId !== undefined) form.append("machineId", input.machineId);
    if (input.workspaceId !== undefined) form.append("workspaceId", input.workspaceId);

    return this.client.request<AppDeployResponse>("/apps/deploy", {
      method: "POST",
      body: form,
      rawBody: true,
    });
  }

  deployFromRepo(input: DeployFromRepoInput) {
    return this.client.post("/apps/deploy-from-repo", input);
  }

  /** Detect env vars from a ZIP without deploying. */
  async inspectEnv(file: DeployFromZipInput["file"], filename = "app.zip") {
    const form = new FormData();
    form.append("file", toBlobPart(file, filename), filename);
    return this.client.request("/apps/inspect-env", {
      method: "POST",
      body: form,
      rawBody: true,
    });
  }

  createBackup(appId: string) {
    return this.client.post(`/apps/${encodeURIComponent(appId)}/backup`);
  }

  listBackups(appId: string) {
    return this.client.get(`/apps/${encodeURIComponent(appId)}/backups`);
  }

  deleteBackups(appId: string) {
    return this.client.delete(`/apps/${encodeURIComponent(appId)}/backups`);
  }

  restoreBackup(appId: string, backupId: string) {
    return this.client.post(`/apps/${encodeURIComponent(appId)}/backups/restore`, {
      backupId,
    });
  }

  downloadBackup(appId: string, backupId: string) {
    return this.client.get(
      `/apps/${encodeURIComponent(appId)}/backups/${encodeURIComponent(backupId)}/download`,
    );
  }
}
