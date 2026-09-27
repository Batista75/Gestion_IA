import { notFound } from "next/navigation";
import { MarkdownArticle } from "@/components/manual-document";
import { parseManual } from "@/lib/manual-markdown";
import { readSpecPage } from "@/lib/spec-books";

export const dynamic = "force-dynamic";

export default async function TechnicalSpecSection({ params }: { params: Promise<{ page: string }> }) {
  const markdown = await readSpecPage("technique", (await params).page);
  if (!markdown) notFound();
  return <MarkdownArticle blocks={parseManual(markdown)} />;
}
