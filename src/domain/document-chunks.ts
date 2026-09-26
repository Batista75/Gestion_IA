const PASSAGE_CHARS = 1_600;
const PASSAGE_LIMIT = 48;
const READING_MARKER = /^<!-- lecture:(docling|repli|vide) -->\n?/;
const PASSAGES_MARKER = "<!-- gestion-ia-passages -->";
const PASSAGE_SPLIT = "<!-- gestion-ia-passage -->";

const DOCLING_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "xlsm",
  "html",
  "htm",
  "png",
  "jpg",
  "jpeg",
  "tif",
  "tiff",
  "bmp",
]);

export type PieceSource = {
  id: string;
  originalName: string;
  kind: string;
  enrichment: string;
  extractedText: string;
};

export type PiecePassage = {
  sourceId: string;
  title: string;
  summary: string;
  body: string;
};

export function doclingExtension(name: string, mime = ""): string | null {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const fromName = match?.[1] ?? "";
  if (DOCLING_EXTENSIONS.has(fromName)) return fromName;
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("presentationml")) return "pptx";
  if (mime.includes("spreadsheetml")) return "xlsx";
  if (mime === "text/html") return "html";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/tiff") return "tiff";
  if (mime === "image/bmp") return "bmp";
  return null;
}

export function pieceIdentity(sourceId: string): string {
  const cut = sourceId.indexOf("#");
  return cut === -1 ? sourceId : sourceId.slice(0, cut);
}

export function documentBody(extracted: string): string {
  const stripped = stripReadingMarker(extracted);
  const cut = stripped.indexOf(PASSAGES_MARKER);
  return (cut === -1 ? stripped : stripped.slice(0, cut)).trim();
}

export function composeExtraction(
  markdown: string,
  chunks: string[],
  engine: "docling" | "repli" | "vide",
): string {
  const body = markdown.trim();
  const passages = chunks.map((chunk) => chunk.trim()).filter(Boolean).slice(0, PASSAGE_LIMIT);
  if (engine !== "docling" || passages.length === 0) {
    const kind = engine === "docling" ? (body ? "docling" : "vide") : engine;
    return `<!-- lecture:${kind} -->\n${body}`.trim();
  }
  return [
    "<!-- lecture:docling -->",
    body,
    PASSAGES_MARKER,
    passages.join(`\n${PASSAGE_SPLIT}\n`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function retrievalParts(extracted: string): string[] {
  const stripped = stripReadingMarker(extracted).trim();
  const cut = stripped.indexOf(PASSAGES_MARKER);
  if (cut >= 0) {
    return stripped
      .slice(cut + PASSAGES_MARKER.length)
      .split(PASSAGE_SPLIT)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, PASSAGE_LIMIT);
  }
  return chunkDocumentText(stripped);
}

export function chunkDocumentText(text: string, maxChars = PASSAGE_CHARS): string[] {
  const clean = stripReadingMarker(text).replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let heading = "";
  let current: string[] = [];
  let size = 0;

  const flush = () => {
    const body = current.join("\n\n").trim();
    current = [];
    size = 0;
    if (!body) return;
    chunks.push(heading && !body.startsWith(heading) ? `${heading}\n\n${body}` : body);
  };

  for (const block of blocksOf(clean)) {
    if (block.kind === "heading") heading = block.text;
    const pieces = block.text.length > maxChars ? splitLong(block.text, maxChars) : [block.text];
    for (const piece of pieces) {
      const adding = piece.length + 2;
      if (size > 0 && size + adding > maxChars) {
        const onlyHeading = current.length === 1 && current[0] === heading;
        if (onlyHeading) {
          current = [];
          size = 0;
        } else {
          flush();
        }
      }
      if (current.length === 0 && heading && block.kind !== "heading" && !piece.startsWith(heading)) {
        current.push(heading);
        size += heading.length + 2;
      }
      current.push(piece);
      size += adding;
      if (piece.length > maxChars) flush();
    }
  }
  flush();
  return chunks.slice(0, PASSAGE_LIMIT);
}

export function piecePassages(file: PieceSource): PiecePassage[] {
  const name = file.originalName.trim() || "Pièce";
  const parts = retrievalParts(file.extractedText);
  const passages: PiecePassage[] = [];
  const enrichment = file.enrichment.trim();
  if (enrichment) {
    passages.push({
      sourceId: `${file.id}#meta`,
      title: name,
      summary: file.kind,
      body: `Pièce ${name}\n\n${enrichment}`,
    });
  }
  parts.forEach((part, index) => {
    passages.push({
      sourceId: `${file.id}#${index}`,
      title: parts.length > 1 ? `${name} · extrait ${index + 1}` : name,
      summary: file.kind,
      body: `Pièce ${name}\n\n${part}`,
    });
  });
  if (passages.length === 0) {
    passages.push({
      sourceId: `${file.id}#0`,
      title: name,
      summary: file.kind,
      body: `Pièce ${name}\n\nFichier conservé.`,
    });
  }
  return passages;
}

function stripReadingMarker(text: string): string {
  return text.replace(READING_MARKER, "");
}

type Block = { kind: "heading" | "table" | "text"; text: string };

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let mode: "text" | "table" | "code" | null = null;

  const flush = () => {
    const value = buffer.join("\n").trim();
    buffer = [];
    const current = mode;
    mode = null;
    if (!value) return;
    if (current === "table") blocks.push({ kind: "table", text: value });
    else blocks.push({ kind: "text", text: value });
  };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (mode === "code") {
        buffer.push(line);
        flush();
      } else {
        flush();
        mode = "code";
        buffer.push(line);
      }
      continue;
    }
    if (mode === "code") {
      buffer.push(line);
      continue;
    }
    if (isTableLine(trimmed)) {
      if (mode !== "table") flush();
      mode = "table";
      buffer.push(line);
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    if (/^#{1,6}\s+\S/.test(trimmed)) {
      flush();
      blocks.push({ kind: "heading", text: trimmed });
      continue;
    }
    if (mode !== "text") flush();
    mode = "text";
    buffer.push(line);
  }
  flush();
  return blocks;
}

function isTableLine(line: string): boolean {
  return /^\|.+\|$/.test(line) || /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function splitLong(text: string, maxChars: number): string[] {
  const lines = text.split("\n");
  if (lines.length > 2 && lines.every((line) => !line.trim() || isTableLine(line.trim()))) {
    const header = lines.slice(0, 2);
    const rows = lines.slice(2);
    const parts: string[] = [];
    let current = [...header];
    for (const row of rows) {
      const next = [...current, row].join("\n");
      if (next.length > maxChars && current.length > header.length) {
        parts.push(current.join("\n"));
        current = [...header, row];
      } else {
        current.push(row);
      }
    }
    if (current.length > header.length || parts.length === 0) parts.push(current.join("\n"));
    return parts.flatMap((part) => (part.length > maxChars ? hardWrap(part, maxChars) : [part]));
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length > 1) {
    const parts: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;
      if (next.length > maxChars && current) {
        parts.push(current);
        current = sentence;
      } else {
        current = next;
      }
    }
    if (current) parts.push(current);
    return parts.flatMap((part) => (part.length > maxChars ? hardWrap(part, maxChars) : [part]));
  }
  return hardWrap(text, maxChars);
}

function hardWrap(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  const overlap = Math.min(120, Math.floor(maxChars / 5));
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + maxChars);
    parts.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return parts.filter(Boolean);
}
