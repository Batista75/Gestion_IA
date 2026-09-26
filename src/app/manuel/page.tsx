import { readFile } from "node:fs/promises";
import path from "node:path";
import { InlineText } from "@/components/manual-document";
import { parseManual } from "@/lib/manual-markdown";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "docs/manuel-utilisateur.md"),
    "utf8",
  );
  const blocks = parseManual(markdown);

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-4">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading" && block.level === 1) {
          return (
            <h1 key={key} className="text-2xl font-semibold tracking-tight">
              <InlineText inlines={block.inlines} />
            </h1>
          );
        }
        if (block.type === "heading" && block.level === 2) {
          return (
            <h2 key={key} className="pt-2 text-lg font-semibold">
              <InlineText inlines={block.inlines} />
            </h2>
          );
        }
        if (block.type === "heading") {
          return (
            <h3 key={key} className="font-semibold">
              <InlineText inlines={block.inlines} />
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={key} className="grid list-disc gap-2 pl-5 text-sm leading-6">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>
                  <InlineText inlines={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "code") {
          return (
            <pre
              key={key}
              className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs leading-5"
            >
              {block.text}
            </pre>
          );
        }
        return (
          <p key={key} className="text-sm leading-6 text-muted-foreground">
            <InlineText inlines={block.inlines} />
          </p>
        );
      })}
    </article>
  );
}
