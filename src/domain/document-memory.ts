export type DocumentMemory = {
  document: string;
  projet: string;
  type: string;
  societe: string;
};

export type MemoryPatch = {
  document: string;
  projet: string;
  type: string;
  societe: string;
};

/** Nom de fichier seul, sans chemin. Deux pièces différentes ne partagent pas une clé. */
export function documentKey(name: string): string {
  const base = name.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

export function documentLabel(input: { selectedKind: string; selectedLabel: string; attachments: string[] }): string {
  if (input.selectedKind === "document" && input.selectedLabel.trim()) return input.selectedLabel.trim();
  return input.attachments.find((name) => name.trim())?.trim() ?? "";
}

export function mergeMemory(current: DocumentMemory | null, patch: MemoryPatch): DocumentMemory | null {
  const document = documentKey(patch.document);
  if (!document) return null;
  const same = current && current.document === document ? current : null;
  const projet = patch.projet.trim() || same?.projet || "";
  const type = patch.type.trim() || same?.type || "";
  const societe = patch.societe.trim() || same?.societe || "";
  if (!projet && !type && !societe) return null;
  return { document, projet, type, societe };
}

export function memoryApplies(memory: DocumentMemory, document: string): boolean {
  const key = documentKey(document);
  return Boolean(key) && key === memory.document;
}

export function memoryNotice(memory: DocumentMemory): string {
  const parts = [
    memory.projet ? `projet ${memory.projet}` : "",
    memory.type ? `type ${memory.type}` : "",
    memory.societe ? `société ${memory.societe}` : "",
  ].filter(Boolean);
  const detail = parts.length ? ` : ${parts.join(", ")}` : "";
  return `Correction retenue pour ${memory.document}${detail}. Elle ne devient pas une règle.`;
}
