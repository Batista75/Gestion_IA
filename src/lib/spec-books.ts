import { readFile } from "node:fs/promises";
import path from "node:path";

export const functionalPages = ["index", "chaine", "catalogue", "perimetre", "realisations"] as const;
export const technicalPages = ["index", "dat", "dct", "orchestration", "devis-hybride", "recherche", "donnees", "modelisation", "ecrans", "ecart", "realisations"] as const;

export type SpecBook = "fonctionnel" | "technique";

export function rewriteSpecLinks(markdown: string, book: "v2" | "technique"): string {
  return markdown.replace(/\]\(([^)\s]+?\.md)(#[^)\s]+)?\)/g, (_, file: string, hash: string = "") => {
    const slug = path.basename(String(file)).replace(/\.md$/, "");
    const href = slug === "index" ? `/documentation/${book}` : `/documentation/${book}/${slug}`;
    return `](${href}${hash})`;
  });
}

export async function readSpecPage(book: SpecBook, slug: string): Promise<string | null> {
  const allowed: readonly string[] = book === "fonctionnel" ? functionalPages : technicalPages;
  if (!allowed.includes(slug)) return null;
  const markdown = await readFile(path.join(process.cwd(), "docs", book, "docs", `${slug}.md`), "utf8");
  return rewriteSpecLinks(markdown, book === "fonctionnel" ? "v2" : "technique");
}
