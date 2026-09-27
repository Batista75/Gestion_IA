import { documentKey, mergeMemory, type DocumentMemory, type MemoryPatch } from "@/domain/document-memory";
import { prisma } from "@/lib/db";

export async function loadDocumentMemory(label: string): Promise<DocumentMemory | null> {
  const key = documentKey(label);
  if (!key) return null;
  const row = await prisma.documentMemory.findUnique({ where: { documentKey: key } });
  if (!row) return null;
  return { document: row.documentKey, projet: row.projet, type: row.type, societe: row.societe };
}

export async function saveDocumentMemory(label: string, patch: Omit<MemoryPatch, "document">): Promise<DocumentMemory | null> {
  const current = await loadDocumentMemory(label);
  const next = mergeMemory(current, { document: label, ...patch });
  if (!next) return null;
  await prisma.documentMemory.upsert({
    where: { documentKey: next.document },
    create: { documentKey: next.document, projet: next.projet, type: next.type, societe: next.societe },
    update: { projet: next.projet, type: next.type, societe: next.societe },
  });
  return next;
}
