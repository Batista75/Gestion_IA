import type { Inline } from "@/lib/manual-markdown";

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
