export const GPU_SIZING_NOTE =
  "Un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. L’index (nomic-embed-text) puis le modèle de conversation (environ 7 milliards de paramètres) passent l’un après l’autre. Le contexte tient en 4 096 jetons. Évitez un modèle 14B, Mixtral ou bge-m3 en même temps.";

const PREFERRED_CHAT = [
  "qwen-dgfip-multisec-2ep",
  "qwen2.5:7b-instruct",
  "qwen2.5:7b",
  "llama3.1:8b",
];

export function isEmbedOnlyModel(name: string): boolean {
  return /nomic-embed|bge-m|mxbai-embed|all-minilm|snowflake-arctic-embed|embed/i.test(name);
}

export function isOversizedChatModel(name: string): boolean {
  return /\b(14|27|32|34|70)b\b|mixtral/i.test(name);
}

export function pickChatModel(installed: string[], requested?: string | null): string | null {
  const ask = requested?.trim();
  if (ask && installed.includes(ask) && !isEmbedOnlyModel(ask)) return ask;
  for (const base of PREFERRED_CHAT) {
    const found = installed.find((name) => name === base || name.startsWith(`${base}:`));
    if (found) return found;
  }
  return (
    installed.find((name) => !isEmbedOnlyModel(name) && !isOversizedChatModel(name)) ??
    installed.find((name) => !isEmbedOnlyModel(name)) ??
    null
  );
}

export function pickEmbedModel(installed: string[], requested?: string | null): string | null {
  const ask = requested?.trim();
  if (ask && installed.includes(ask)) return ask;
  return installed.find((name) => name === "nomic-embed-text" || name.startsWith("nomic-embed-text:")) ?? null;
}

export const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_records",
    description:
      "Relit les fiches déjà enregistrées (clients, fournisseurs, produits, projets, devis, notes à classer). À utiliser avant de citer une information.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
};
