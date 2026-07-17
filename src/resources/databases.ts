import type { HyzeCloud } from "../client";
import type {
  CreateDatabaseInput,
  DatabaseResponse,
  DatabasesListResponse,
} from "../types";

export class DatabasesResource {
  constructor(private readonly client: HyzeCloud) {}

  list(query?: { workspaceId?: string }) {
    return this.client.get<DatabasesListResponse>("/databases/", query);
  }

  get(databaseId: string) {
    return this.client.get<DatabaseResponse>(`/databases/${encodeURIComponent(databaseId)}`);
  }

  create(input: CreateDatabaseInput) {
    return this.client.post<DatabaseResponse>("/databases/", input);
  }

  delete(databaseId: string) {
    return this.client.delete<{ success: boolean }>(
      `/databases/${encodeURIComponent(databaseId)}`,
    );
  }

  updateSettings(
    databaseId: string,
    settings: { name?: string; memoryMB?: number; storageGB?: number },
  ) {
    return this.client.patch<DatabaseResponse>(
      `/databases/${encodeURIComponent(databaseId)}/settings`,
      settings,
    );
  }

  stats(databaseId: string) {
    return this.client.get(`/databases/${encodeURIComponent(databaseId)}/stats`);
  }

  logs(databaseId: string, query?: { tail?: number; timestamps?: boolean }) {
    return this.client.get(`/databases/${encodeURIComponent(databaseId)}/logs`, query);
  }

  start(databaseId: string) {
    return this.client.post(`/databases/${encodeURIComponent(databaseId)}/start`);
  }

  stop(databaseId: string) {
    return this.client.post(`/databases/${encodeURIComponent(databaseId)}/stop`);
  }

  rotatePassword(databaseId: string, password?: string) {
    return this.client.post(
      `/databases/${encodeURIComponent(databaseId)}/rotate-password`,
      password ? { password } : {},
    );
  }

  createBackup(databaseId: string) {
    return this.client.post(`/databases/${encodeURIComponent(databaseId)}/backups`);
  }

  listBackups(databaseId: string) {
    return this.client.get(`/databases/${encodeURIComponent(databaseId)}/backups`);
  }

  downloadBackup(databaseId: string, backupId: string) {
    return this.client.get(
      `/databases/${encodeURIComponent(databaseId)}/backups/${encodeURIComponent(backupId)}/download`,
    );
  }

  restore(databaseId: string, backupId: string) {
    return this.client.post(`/databases/${encodeURIComponent(databaseId)}/restore`, {
      backupId,
    });
  }

  operations(databaseId: string) {
    return this.client.get(`/databases/${encodeURIComponent(databaseId)}/operations`);
  }
}
