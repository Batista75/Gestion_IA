"use server";

import { revalidatePath } from "next/cache";
import { readCostCents, readSalePercent, readSaleQuantity } from "@/domain/pricing";
import {
  addProjectLine,
  confirmDocument,
  confirmProjectLines,
  establishQuote,
  markQuoteUnsuccessful,
  openCustomerOrder,
  openSupplierOrders,
  reopenDocument,
  updateDocumentLines,
  updateProjectLines,
} from "@/lib/sale-store";

export type SaleState = { message: string | null; ok: boolean };

const empty: SaleState = { message: null, ok: false };

function done(projectId: string, result: { ok: boolean; summary: string }): SaleState {
  revalidatePath(`/projets/${projectId}`);
  revalidatePath("/projets");
  revalidatePath("/");
  return { message: result.summary, ok: result.ok };
}

async function run(projectId: string, work: () => Promise<string>): Promise<SaleState> {
  try {
    return done(projectId, { ok: true, summary: await work() });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "L’opération n’a pas abouti.",
      ok: false,
    };
  }
}

function projectId(formData: FormData): string {
  return String(formData.get("projectId") ?? "").trim();
}

function lineRows(formData: FormData, ids: string[]) {
  return ids.map((id) => ({
    id,
    name: "",
    kind: "produit",
    supplierName: String(formData.get(`supplier_${id}`) ?? ""),
    quantity: readSaleQuantity(String(formData.get(`qty_${id}`) ?? "")),
    costCents: readCostCents(String(formData.get(`cost_${id}`) ?? "")),
    markupPercent: readSalePercent(String(formData.get(`markup_${id}`) ?? ""), "Le taux de marque"),
    discountPercent: readSalePercent(String(formData.get(`discount_${id}`) ?? ""), "La remise"),
  }));
}

export async function addLineAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  return run(id, () =>
    addProjectLine({
      projectId: id,
      productId: String(formData.get("productId") ?? "").trim(),
      name: String(formData.get("name") ?? ""),
      kind: String(formData.get("kind") ?? ""),
      supplierName: String(formData.get("supplierName") ?? ""),
      quantity: readSaleQuantity(String(formData.get("quantity") ?? "1")),
      costCents: readCostCents(String(formData.get("cost") ?? "")),
      markupPercent: readSalePercent(String(formData.get("markup") ?? "30"), "Le taux de marque"),
      discountPercent: readSalePercent(String(formData.get("discount") ?? "0"), "La remise"),
    }),
  );
}

export async function updateLinesAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  const ids = formData.getAll("existingId").map((value) => String(value));
  return run(id, () => updateProjectLines(id, lineRows(formData, ids)));
}

export async function confirmLinesAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  return run(id, () => confirmProjectLines(id));
}

export async function quoteAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  const lineIds = formData.getAll("lineId").map((value) => String(value));
  return run(id, () => establishQuote(id, lineIds, String(formData.get("title") ?? "")));
}

export async function loseQuoteAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  return run(id, () => markQuoteUnsuccessful(String(formData.get("documentId") ?? "")));
}

export async function customerOrderAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  return run(id, () => openCustomerOrder(String(formData.get("documentId") ?? "")));
}

export async function supplierOrderAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  return run(id, () =>
    openSupplierOrders(String(formData.get("documentId") ?? ""), String(formData.get("supplierName") ?? "")),
  );
}

export async function updateDocumentAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  const ids = formData.getAll("existingId").map((value) => String(value));
  return run(id, () => updateDocumentLines(String(formData.get("documentId") ?? ""), lineRows(formData, ids)));
}

export async function confirmDocumentAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  return run(id, () => confirmDocument(String(formData.get("documentId") ?? "")));
}

export async function reopenDocumentAction(_previous: SaleState, formData: FormData): Promise<SaleState> {
  const id = projectId(formData);
  return run(id, () => reopenDocument(String(formData.get("documentId") ?? "")));
}

export { empty };
