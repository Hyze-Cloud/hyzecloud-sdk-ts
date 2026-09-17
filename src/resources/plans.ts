import type { HyzeCloud } from "../client.js";
import type { CurrentPlanResponse, PlansListResponse } from "../types.js";

export class PlansResource {
  constructor(private readonly client: HyzeCloud) {}

  /** Current user plan + usage summary (no nested apps/databases lists). */
  current() {
    return this.client.get<CurrentPlanResponse>("/plans/current");
  }

  list() {
    return this.client.get<PlansListResponse>("/plans/");
  }
}
