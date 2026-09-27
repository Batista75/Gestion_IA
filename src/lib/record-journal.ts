import { prisma } from "@/lib/db";

export type JournalEntry = {
  id: string;
  entityId: string;
  at: string;
  name: string;
  action: string;
  summary: string;
  source: string;
  actor: string;
};

export async function listRecordEvents(entityType: string, take = 20): Promise<JournalEntry[]> {
  const rows = await prisma.recordEvent.findMany({
    where: { entityType },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((row) => ({
    id: row.id,
    entityId: row.entityId,
    at: row.createdAt.toLocaleString("fr-FR"),
    name: row.entityName,
    action: row.action,
    summary: row.summary,
    source: sourceText(row.source),
    actor: row.actor.trim() || "J Smith",
  }));
}

function sourceText(source: string): string {
  if (source === "assistant") return "Assistant";
  if (source === "formulaire") return "Formulaire";
  return "Application";
}
