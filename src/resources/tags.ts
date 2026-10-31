import type { HyzeCloud } from "../client.js";
import type {
  CreateTagInput,
  SetTagLinksInput,
  TagResponse,
  TagsListResponse,
  UpdateTagInput,
} from "../types.js";

/**
 * Tags do workspace: rótulos para agrupar apps e bancos. Tag não é pasta nem dá acesso: é só filtro.
 */
export class TagsResource {
  constructor(private readonly client: HyzeCloud) {}

  list() {
    return this.client.get<TagsListResponse>("/tags/");
  }

  create(input: CreateTagInput) {
    return this.client.post<TagResponse>("/tags/", input);
  }

  update(tagId: string, input: UpdateTagInput) {
    return this.client.patch<TagResponse>(`/tags/${encodeURIComponent(tagId)}`, input);
  }

  delete(tagId: string) {
    return this.client.delete<{ success: boolean }>(`/tags/${encodeURIComponent(tagId)}`);
  }

  /** Define as tags de um app ou banco: `tagIds` é a lista final, não um acréscimo. */
  setLinks(input: SetTagLinksInput) {
    return this.client.put<TagsListResponse>("/tags/links", input);
  }
}
