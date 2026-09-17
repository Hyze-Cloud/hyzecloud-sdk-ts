import type { HyzeCloud } from "../client.js";
import type {
  ApiKeyCreateResponse,
  ApiKeysListResponse,
  ApiKeyUpdateResponse,
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from "../types.js";

export class ApiKeysResource {
  constructor(private readonly client: HyzeCloud) {}

  list() {
    return this.client.get<ApiKeysListResponse>("/api-keys/");
  }

  create(input: CreateApiKeyInput) {
    return this.client.post<ApiKeyCreateResponse>("/api-keys/", input);
  }

  update(keyId: string, input: UpdateApiKeyInput) {
    return this.client.put<ApiKeyUpdateResponse>(
      `/api-keys/${encodeURIComponent(keyId)}`,
      input,
    );
  }

  delete(keyId: string) {
    return this.client.delete<{ success: boolean }>(
      `/api-keys/${encodeURIComponent(keyId)}`,
    );
  }
}
