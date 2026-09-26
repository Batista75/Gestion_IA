export const GPU_SIZING_NOTE =
  "Un utilisateur, 16 Go de mémoire graphique et 32 Go de RAM. S’ils sont installés, les modèles par défaut sont Qwen2.5-14B-Instruct en Q4_K_M, bge-m3 et bge-reranker-v2-m3. Embeddings, reranker, puis conversation passent l’un après l’autre. Le contexte tient en 4 096 jetons.";

const PREFERRED_CHAT = [
  "qwen-dgfip-multisec-2ep",
  "qwen2.5:7b-instruct",
  "qwen2.5:7b",
  "llama3.1:8b",
];

export type ModelRole = "chat" | "embed" | "rerank";

export function isRerankModel(name: string): boolean {
  return /rerank/i.test(name);
}

export function isEmbedOnlyModel(name: string): boolean {
  if (isRerankModel(name)) return false;
  return /nomic-embed|bge-m3|mxbai-embed|all-minilm|snowflake-arctic-embed|\bembed/i.test(name);
}

export function modelRole(name: string): ModelRole {
  if (isRerankModel(name)) return "rerank";
  if (isEmbedOnlyModel(name)) return "embed";
  return "chat";
}

export function modelsForRole(installed: string[], role: ModelRole): string[] {
  return installed.filter((name) => modelRole(name) === role);
}

export function isOversizedChatModel(name: string): boolean {
  return /\b(27|32|34|70|72)b\b|mixtral/i.test(name);
}

function foldModel(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function qwen14Score(name: string): number {
  const raw = name.toLowerCase();
  const folded = foldModel(name);
  if (!folded.includes("qwen") || !folded.includes("14b")) return 0;
  if (folded.includes("qwen3") && !raw.includes("2.5") && !folded.includes("qwen25")) return 0;
  let score = 10;
  if (raw.includes("2.5") || folded.includes("qwen25")) score += 20;
  if (folded.includes("instruct")) score += 8;
  if (folded.includes("q4km")) score += 40;
  const short = raw.replace(/:latest$/, "");
  if (short === "qwen2.5:14b" || short === "qwen2.5:14b-instruct") score += 30;
  return score;
}

export function pickChatModel(installed: string[], requested?: string | null): string | null {
  const ask = requested?.trim();
  if (ask && installed.includes(ask) && modelRole(ask) === "chat") return ask;
  const preferred = installed
    .map((name) => ({ name, score: qwen14Score(name) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  if (preferred[0]) return preferred[0].name;
  for (const base of PREFERRED_CHAT) {
    const found = installed.find((name) => name === base || name.startsWith(`${base}:`));
    if (found) return found;
  }
  return (
    installed.find((name) => modelRole(name) === "chat" && !isOversizedChatModel(name)) ??
    installed.find((name) => modelRole(name) === "chat") ??
    null
  );
}

export function pickEmbedModel(installed: string[], requested?: string | null): string | null {
  const ask = requested?.trim();
  if (ask && installed.includes(ask) && modelRole(ask) === "embed") return ask;
  return (
    installed.find((name) => modelRole(name) === "embed" && foldModel(name).includes("bgem3")) ??
    installed.find((name) => name === "nomic-embed-text" || name.startsWith("nomic-embed-text:")) ??
    installed.find((name) => modelRole(name) === "embed") ??
    null
  );
}

export function pickRerankModel(installed: string[], requested?: string | null): string | null {
  const ask = requested?.trim();
  if (ask && installed.includes(ask) && modelRole(ask) === "rerank") return ask;
  return (
    installed.find((name) => modelRole(name) === "rerank" && foldModel(name).includes("bgererankerv2m3")) ??
    installed.find((name) => modelRole(name) === "rerank") ??
    null
  );
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
