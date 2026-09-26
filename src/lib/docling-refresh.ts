import { readFile } from "node:fs/promises";
import { doclingExtension, composeExtraction } from "@/domain/document-chunks";
import { convertWithDocling, doclingReady } from "@/lib/docling";
import { prisma } from "@/lib/db";
import { fallbackExtract, resolveStoredPath } from "@/lib/pieces";

let refreshing: Promise<void> | null = null;

export function schedulePieceRefresh(): void {
  if (refreshing) return;
  refreshing = refreshOne()
    .catch(() => undefined)
    .finally(() => {
      refreshing = null;
    });
}

async function refreshOne(): Promise<void> {
  if (!(await doclingReady())) return;
  const rows = await prisma.storedFile.findMany({
    where: { NOT: { extractedText: { contains: "<!-- lecture:" } } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, originalName: true, mimeType: true, storagePath: true },
  });
  const row = rows.find((item) => doclingExtension(item.originalName, item.mimeType));
  if (!row) return;
  const absolute = resolveStoredPath(row.storagePath);
  const extension = doclingExtension(row.originalName, row.mimeType);
  if (!absolute || !extension) return;
  const bytes = await readFile(absolute);
  const file = { name: row.originalName, type: row.mimeType, bytes };
  const converted = await convertWithDocling([{ bytes, extension }]);
  const markdown = converted?.[0]?.markdown ?? "";
  const chunks = converted?.[0]?.chunks ?? [];
  const stored =
    converted && (markdown.trim() || chunks.length > 0)
      ? composeExtraction(markdown, chunks, "docling")
      : composeExtraction(await fallbackExtract(file), [], "repli");
  await prisma.storedFile.update({
    where: { id: row.id },
    data: { extractedText: stored.slice(0, 200_000) },
  });
}
