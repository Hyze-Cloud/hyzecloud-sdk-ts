import type { HyzeCloud } from "../client.js";
import type {
  CreatePixInvoiceInput,
  InvoiceDetailResponse,
  InvoicesListResponse,
} from "../types.js";

export class InvoicesResource {
  constructor(private readonly client: HyzeCloud) {}

  list(query?: { limit?: number }) {
    return this.client.get<InvoicesListResponse>("/invoices/", query);
  }

  createPix(input: CreatePixInvoiceInput) {
    return this.client.post<InvoiceDetailResponse>("/invoices/pix", input);
  }

  status(invoiceId: string, query?: { includePix?: boolean }) {
    return this.client.get<InvoiceDetailResponse>(
      `/invoices/${encodeURIComponent(invoiceId)}/status`,
      query,
    );
  }
}
