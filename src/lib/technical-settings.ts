import {
  cleanModelName,
  nextApiKey,
  type TechnicalDraft,
} from "@/domain/technical-settings";
import { resolveOllamaBaseUrl } from "@/domain/ollama-endpoint";
import { prisma } from "@/lib/db";

const LOCAL_ID = "local";

export type TechnicalConfig = TechnicalDraft & {
  hasSavedKey: boolean;
  fromScreen: boolean;
};

export async function loadTechnicalConfig(): Promise<TechnicalConfig> {
  const row = await prisma.appSetting.findUnique({ where: { id: LOCAL_ID } });
  if (!row) {
    return {
      serverUrl: process.env.OLLAMA_BASE_URL?.trim() || "",
      chatModel: process.env.OLLAMA_MODEL?.trim() || "",
      embedModel: process.env.OLLAMA_EMBED_MODEL?.trim() || "",
      rerankModel: process.env.OLLAMA_RERANK_MODEL?.trim() || "",
      apiKey: "",
      hasSavedKey: false,
      fromScreen: false,
    };
  }
  return {
    serverUrl: row.serverUrl,
    chatModel: row.chatModel,
    embedModel: row.embedModel,
    rerankModel: row.rerankModel,
    apiKey: row.apiKey,
    hasSavedKey: Boolean(row.apiKey),
    fromScreen: true,
  };
}

export async function saveTechnicalConfig(input: {
  serverUrl: string;
  chatModel: string;
  embedModel: string;
  rerankModel: string;
  apiKey: string;
  clearKey: boolean;
}): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  let serverUrl: string;
  try {
    serverUrl = resolveOllamaBaseUrl(input.serverUrl);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Adresse du serveur invalide." };
  }
  const chat = cleanModelName(input.chatModel);
  if (!chat.ok) return chat;
  const embed = cleanModelName(input.embedModel);
  if (!embed.ok) return embed;
  const rerank = cleanModelName(input.rerankModel);
  if (!rerank.ok) return rerank;
  const current = await prisma.appSetting.findUnique({ where: { id: LOCAL_ID } });
  const key = nextApiKey(current?.apiKey ?? "", input.apiKey, input.clearKey);
  if (!key.ok) return key;
  await prisma.appSetting.upsert({
    where: { id: LOCAL_ID },
    create: {
      id: LOCAL_ID,
      serverUrl,
      chatModel: chat.value,
      embedModel: embed.value,
      rerankModel: rerank.value,
      apiKey: key.value,
    },
    update: {
      serverUrl,
      chatModel: chat.value,
      embedModel: embed.value,
      rerankModel: rerank.value,
      apiKey: key.value,
    },
  });
  const keyNote = key.value ? "La clé est enregistrée sur cette machine." : "Aucune clé n’est enregistrée.";
  return { ok: true, summary: `Configuration enregistrée. ${keyNote}` };
}
