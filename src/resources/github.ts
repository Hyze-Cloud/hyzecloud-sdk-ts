import type { HyzeCloud } from "../client";
import type { GithubStatusResponse } from "../types";

export class GithubResource {
  constructor(private readonly client: HyzeCloud) {}

  status() {
    return this.client.get<GithubStatusResponse>("/integrations/github/status");
  }

  installUrl() {
    return this.client.get<{ success: true; url: string }>(
      "/integrations/github/install-url",
    );
  }

  disconnect() {
    return this.client.delete("/integrations/github/connection");
  }

  repos() {
    return this.client.get("/integrations/github/repos");
  }

  branches(owner: string, repo: string) {
    return this.client.get(
      `/integrations/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
    );
  }

  detectRuntime(owner: string, repo: string, query?: { branch?: string; path?: string }) {
    return this.client.get(
      `/integrations/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runtime`,
      query,
    );
  }
}
