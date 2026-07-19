import type { HyzeCloud } from "../client";
import type {
  AppDetailResponse,
  AppEnvResponse,
  AppLogsResponse,
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

  builds(appId: string) {
    return this.client.get(`/apps/${encodeURIComponent(appId)}/builds`);
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

    return this.client.request("/apps/deploy", {
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
