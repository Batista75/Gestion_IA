"use server";

import { revalidatePath } from "next/cache";
import { saveCompany } from "@/lib/company-store";
import { saveTechnicalConfig } from "@/lib/technical-settings";

export type ConfigurationState = { message: string | null; ok: boolean };
export type CompanyState = { message: string | null; ok: boolean };

export async function saveCompanyAction(_previous: CompanyState, formData: FormData): Promise<CompanyState> {
  const file = formData.get("logo");
  const logo = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
  const saved = await saveCompany({
    draft: {
      legalName: String(formData.get("legalName") ?? ""),
      address: String(formData.get("address") ?? ""),
      postalCode: String(formData.get("postalCode") ?? ""),
      city: String(formData.get("city") ?? ""),
      country: String(formData.get("country") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      siren: String(formData.get("siren") ?? ""),
      vatNumber: String(formData.get("vatNumber") ?? ""),
    },
    logo,
    clearLogo: formData.get("clearLogo") === "on",
  });
  revalidatePath("/configuration");
  revalidatePath("/projets", "layout");
  if (!saved.ok) return { message: saved.error, ok: false };
  return { message: saved.summary, ok: true };
}

export async function saveConfigurationAction(
  _previous: ConfigurationState,
  formData: FormData,
): Promise<ConfigurationState> {
  const saved = await saveTechnicalConfig({
    serverUrl: String(formData.get("serverUrl") ?? ""),
    chatModel: String(formData.get("chatModel") ?? ""),
    embedModel: String(formData.get("embedModel") ?? ""),
    rerankModel: String(formData.get("rerankModel") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    clearKey: formData.get("clearKey") === "on",
  });
  revalidatePath("/configuration");
  revalidatePath("/");
  if (!saved.ok) return { message: saved.error, ok: false };
  return { message: saved.summary, ok: true };
}
