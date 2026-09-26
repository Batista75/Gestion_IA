import { readFile } from "node:fs/promises";
import path from "node:path";
import { MarkdownArticle } from "@/components/manual-document";
import { parseManual } from "@/lib/manual-markdown";

export const dynamic = "force-dynamic";

export default async function TradeInstructionPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "instructions/metiers/achat-revente-technologies.md"),
    "utf8",
  );
  return <MarkdownArticle blocks={parseManual(markdown)} />;
}
