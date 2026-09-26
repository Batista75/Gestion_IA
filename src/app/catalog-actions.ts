"use server";

import { draftFromForm, saveClientDraft } from "@/lib/client-proposals";
import {
  saveProductForm,
  saveQuoteForm,
  saveSupplierForm,
} from "@/lib/catalog-store";

export type FormState = { message: string | null; ok: boolean };

export async function createClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return toState(await saveClientDraft(draftFromForm(formData)));
}

export async function updateClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return toState(
    await saveClientDraft(draftFromForm(formData), { id: idFromForm(formData) }),
  );
}

export async function createSupplierAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return toState(await saveSupplierForm(null, partyFromForm(formData)));
}

export async function updateSupplierAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return toState(
    await saveSupplierForm(idFromForm(formData), partyFromForm(formData)),
  );
}

export async function createProductAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return toState(await saveProductForm(null, productFromForm(formData)));
}

export async function updateProductAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return toState(
    await saveProductForm(idFromForm(formData), productFromForm(formData)),
  );
}

export async function createQuoteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return toState(
    await saveQuoteForm({
      title: String(formData.get("title") ?? ""),
      productsText: String(formData.get("products") ?? ""),
      supplierName: String(formData.get("supplierName") ?? ""),
    }),
  );
}

function toState(result: { ok: boolean; summary: string }): FormState {
  return { message: result.summary, ok: result.ok };
}

function idFromForm(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return id || null;
}

function partyFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    siren: String(formData.get("siren") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function productFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    reference: String(formData.get("reference") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    description: String(formData.get("description") ?? ""),
    supplierName: String(formData.get("supplierName") ?? ""),
  };
}
