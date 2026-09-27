import { documentBody } from "@/domain/document-chunks";
import { documentKey } from "@/domain/document-memory";
import { factsPreface, readDocumentFacts } from "@/domain/document-facts";
import { prisma } from "@/lib/db";

/** Relit le texte déjà extrait. La phrase en cours n’entre pas dans cette lecture. */
export async function factsForNames(names: string[], known: string[]): Promise<string> {
  const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 2);
  if (wanted.length === 0) return "";
  const rows = await prisma.storedFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { originalName: true, extractedText: true },
  });
  return wanted
    .map((name) => {
      const key = documentKey(name);
      const row = rows.find((item) => documentKey(item.originalName) === key);
      const text = row ? documentBody(row.extractedText) : "";
      return factsPreface(name, readDocumentFacts(text, name, known).facts);
    })
    .filter(Boolean)
    .join("\n");
}
