import { readFile } from "node:fs/promises";
import path from "node:path";
import { MarkdownArticle } from "@/components/manual-document";
import { parseManual } from "@/lib/manual-markdown";

export const dynamic = "force-dynamic";

export default async function HybridQuoteSpecPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "docs/specification-devis-hybride.md"),
    "utf8",
  );
  return <MarkdownArticle blocks={parseManual(markdown)} />;
}
