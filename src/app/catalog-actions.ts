"use server";

import { revalidatePath } from "next/cache";
import { withChangeSource } from "@/lib/change-source";
import { draftFromForm, saveClientDraft } from "@/lib/client-proposals";
import {
  saveProductForm,
  saveQuoteForm,
  saveSupplierForm,
} from "@/lib/catalog-store";
import {
  removeClient,
  removeInbox,
  removeProduct,
  removeProject,
  removeQuote,
  removeStoredFile,
  removeSupplier,
  updateInboxNote,
  updateProject,
} from "@/lib/record-admin";

export type FormState = { message: string | null; ok: boolean };

export async function createClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => saveClientDraft(draftFromForm(formData)));
}

export async function updateClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => saveClientDraft(draftFromForm(formData), { id: idFromForm(formData) }));
}

export async function createSupplierAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => saveSupplierForm(null, partyFromForm(formData)));
}

export async function updateSupplierAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => saveSupplierForm(idFromForm(formData), partyFromForm(formData)));
}

export async function createProductAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => saveProductForm(null, productFromForm(formData)));
}

export async function updateProductAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => saveProductForm(idFromForm(formData), productFromForm(formData)));
}

export async function createQuoteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() =>
    saveQuoteForm({
      title: String(formData.get("title") ?? ""),
      productsText: String(formData.get("products") ?? ""),
      supplierName: String(formData.get("supplierName") ?? ""),
    }),
  );
}

export async function deleteClientAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => removeClient(requiredId(formData)), true);
}

export async function deleteSupplierAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => removeSupplier(requiredId(formData)), true);
}

export async function deleteProductAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => removeProduct(requiredId(formData)), true);
}

export async function deleteQuoteAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => removeQuote(requiredId(formData)), true);
}

export async function updateProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(
    () =>
      updateProject({
        id: requiredId(formData),
        name: String(formData.get("name") ?? ""),
        clientId: String(formData.get("clientId") ?? ""),
        status: String(formData.get("status") ?? ""),
        purpose: String(formData.get("purpose") ?? ""),
        nextAction: String(formData.get("nextAction") ?? ""),
      }),
    true,
  );
}

export async function deleteProjectAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return traced(() => removeProject(requiredId(formData)), true);
}

export async function updateInboxAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return done(await updateInboxNote(requiredId(formData), String(formData.get("body") ?? "")));
}

export async function deleteInboxAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return done(await removeInbox(requiredId(formData)));
}

export async function deleteFileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return done(await removeStoredFile(requiredId(formData)));
}

const REFRESH = ["/", "/projets", "/clients", "/fournisseurs", "/produits", "/repertoire"];

function done(result: { ok: boolean; summary: string }): FormState {
  for (const path of REFRESH) revalidatePath(path);
  return { message: result.summary, ok: result.ok };
}

function requiredId(formData: FormData): string {
  return String(formData.get("id") ?? "").trim();
}

function traced(
  work: () => Promise<{ ok: boolean; summary: string }>,
  refresh = false,
): Promise<FormState> {
  return withChangeSource("formulaire", async () => {
    const result = await work();
    if (refresh) {
      for (const path of REFRESH) revalidatePath(path);
    }
    return { message: result.summary, ok: result.ok };
  });
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
