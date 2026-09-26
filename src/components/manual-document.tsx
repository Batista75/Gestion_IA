import type { Block, Inline } from "@/lib/manual-markdown";

export function MarkdownArticle({ blocks }: { blocks: Block[] }) {
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

export function InlineText({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        const key = `${inline.type}-${index}`;
        if (inline.type === "strong") {
          return <strong key={key}>{inline.text}</strong>;
        }
        if (inline.type === "code") {
          return (
            <code
              key={key}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
            >
              {inline.text}
            </code>
          );
        }
        if (inline.type === "link") {
          return (
            <a
              key={key}
              href={inline.href}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {inline.text}
            </a>
          );
        }
        return <span key={key}>{inline.text}</span>;
      })}
    </>
  );
}
