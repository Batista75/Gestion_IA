export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; inlines: Inline[] }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "list"; items: Inline[][] }
  | { type: "code"; text: string };

const INLINE =
  /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

export function parseManual(markdown: string): Block[] {
  const lines = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").startsWith("```")) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        inlines: parseInlines(heading[2]),
      });
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: Inline[][] = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("- ")) {
        items.push(parseInlines((lines[index] ?? "").slice(2)));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() !== "" &&
      !isBlockStart(lines[index] ?? "")
    ) {
      paragraph.push((lines[index] ?? "").trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", inlines: parseInlines(paragraph.join(" ")) });
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return line.startsWith("```") || line.startsWith("- ") || /^#{1,3} /.test(line);
}

export function parseInlines(source: string): Inline[] {
  const inlines: Inline[] = [];
  let cursor = 0;
  for (const match of source.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      inlines.push({ type: "text", text: source.slice(cursor, start) });
    }
    inlines.push(parseToken(match[0]));
    cursor = start + match[0].length;
  }
  if (cursor < source.length) {
    inlines.push({ type: "text", text: source.slice(cursor) });
  }
  return inlines;
}

function parseToken(token: string): Inline {
  if (token.startsWith("`") && token.endsWith("`")) {
    return { type: "code", text: token.slice(1, -1) };
  }
  if (token.startsWith("**") && token.endsWith("**")) {
    return { type: "strong", text: token.slice(2, -2) };
  }
  const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
  if (link && isSafeHref(link[2])) {
    return { type: "link", text: link[1], href: link[2] };
  }
  return { type: "text", text: token };
}

function isSafeHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}
