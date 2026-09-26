"use server";

import { revalidatePath } from "next/cache";
import { saveTechnicalConfig } from "@/lib/technical-settings";

export type ConfigurationState = { message: string | null; ok: boolean };

export async function saveConfigurationAction(
  _previous: ConfigurationState,
  formData: FormData,
): Promise<ConfigurationState> {
  const saved = await saveTechnicalConfig({
    serverUrl: String(formData.get("serverUrl") ?? ""),
    chatModel: String(formData.get("chatModel") ?? ""),
    embedModel: String(formData.get("embedModel") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    clearKey: formData.get("clearKey") === "on",
  });
  revalidatePath("/configuration");
  revalidatePath("/");
  if (!saved.ok) return { message: saved.error, ok: false };
  return { message: saved.summary, ok: true };
}
