import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { articleFromQuoteLine } from "@/domain/article";
import { centsFromWritten } from "@/domain/pricing";
import { nameKey } from "@/domain/catalog";
import { composeExtraction, doclingExtension, documentBody } from "@/domain/document-chunks";
import { readOfferFile, statedLineQuantity, type OfferLine, type OfferVersion } from "@/domain/offer-versions";
import { convertWithDocling } from "@/lib/docling";
import { prisma } from "@/lib/db";
import { recordSupplierOffer } from "@/lib/supplier-offers";

const execFileAsync = promisify(execFile);

export const PIECES_DIR = path.join(process.cwd(), "data", "pieces");
const MAX_FILES = 8;
const MAX_BYTES = 20 * 1024 * 1024;

export type IncomingFile = {
  name: string;
  type: string;
  bytes: Buffer;
};

export type PieceIntakeResult = {
  ok: boolean;
  message: string;
  inboxItemId?: string;
};

export async function saveInboxPieces(
  body: string,
  files: IncomingFile[],
): Promise<PieceIntakeResult> {
  const note = body.trim();
  if (files.length > MAX_FILES) {
    return { ok: false, message: `Au plus ${MAX_FILES} fichiers à la fois.` };
  }
  const tooBig = files.find((file) => file.bytes.length > MAX_BYTES);
  if (tooBig) {
    return {
      ok: false,
      message: `« ${tooBig.name} » dépasse 20 Mo. Le fichier n’a pas été enregistré.`,
    };
  }
  if (note.length < 3 && files.length === 0) {
    return {
      ok: false,
      message: "Décrivez l’information en quelques mots, ou joignez un fichier.",
    };
  }

  const text =
    note.length > 0
      ? note
      : `Pièces jointes : ${files.map((file) => safeDisplayName(file.name)).join(", ")}`;
  const extractedTexts = await extractIncoming(files);
  const prepared = files.map((file, index) => {
    const extracted = extractedTexts[index] ?? "";
    return {
      file,
      extracted,
      reading: readOfferFile(documentBody(extracted), safeDisplayName(file.name)),
      hash: createHash("sha256").update(file.bytes).digest("hex"),
    };
  });

  const item = await prisma.inboxItem.create({
    data: { body: text, source: "depot", status: "a_traiter" },
  });
  await mkdir(PIECES_DIR, { recursive: true });

  const stored: Array<{
    id: string;
    originalName: string;
    reading: ReturnType<typeof readOfferFile>;
    text: string;
  }> = [];
  for (const entry of prepared) {
    const id = randomUUID();
    const storagePath = `${id}-${safeFileName(entry.file.name)}`;
    const absolute = path.join(PIECES_DIR, storagePath);
    await writeFile(absolute, entry.file.bytes);
    try {
      await prisma.storedFile.create({
        data: {
          id,
          inboxItemId: item.id,
          originalName: safeDisplayName(entry.file.name),
          mimeType: entry.file.type.slice(0, 120),
          sizeBytes: entry.file.bytes.length,
          storagePath,
          extractedText: entry.extracted.slice(0, 200_000),
          kind: entry.reading.kind,
          enrichment: entry.reading.enrichment.slice(0, 20_000),
          contentHash: entry.hash,
        },
      });
    } catch (error) {
      await unlink(absolute).catch(() => undefined);
      throw error;
    }

    stored.push({
      id,
      originalName: safeDisplayName(entry.file.name),
      reading: entry.reading,
      text: entry.extracted,
    });
  }

  const { parseBusinessBrief, planIsEmpty } = await import("@/domain/business-brief");
  const plan = parseBusinessBrief(note);
  if (!planIsEmpty(plan)) {
    const fileNote = files.length === 1 ? "1 fichier enregistré." : `${files.length} fichiers enregistrés.`;
    return {
      ok: true,
      message: `${fileNote} Le plan sera proposé dans le fil. Rien n’est enregistré avant confirmation.`,
      inboxItemId: item.id,
    };
  }

  const { queueDocumentProposals } = await import("@/lib/document-proposals");
  const proposals = await queueDocumentProposals(stored, note, item.id);
  return { ok: true, message: intakeMessage(files.length, proposals), inboxItemId: item.id };
}

export function resolveStoredPath(storagePath: string): string | null {
  const root = path.resolve(PIECES_DIR);
  const target = path.resolve(root, storagePath);
  if (path.basename(target) !== storagePath) return null;
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

export async function recordOfferVersion(
  offer: OfferVersion,
  fileId: string | null,
  source: "devis" | "tarif" = "devis",
): Promise<boolean> {
  const existing = await prisma.quote.findUnique({
    where: { fingerprint: offer.fingerprint },
  });
  if (existing) return false;
  try {
    await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          title: offer.title.slice(0, 180),
          issuedOn: offer.issuedOn,
          supplierName: offer.supplierName.slice(0, 160),
          versionLabel: offer.versionLabel.slice(0, 160),
          fingerprint: offer.fingerprint,
          fileId: fileId ?? undefined,
          clientName: (offer.clientName ?? "").slice(0, 160),
          currency: (offer.currency ?? "").slice(0, 8),
          vatMention: (offer.vatMention ?? "").slice(0, 500),
          statedTotalHt: (offer.statedTotalHt ?? "").slice(0, 80),
          statedTotalHtCents: centsFromWritten(offer.statedTotalHt ?? ""),
          statedVat: (offer.statedVat ?? "").slice(0, 80),
          statedVatCents: centsFromWritten(offer.statedVat ?? ""),
          statedTotalTtc: (offer.statedTotalTtc ?? "").slice(0, 80),
          statedTotalTtcCents: centsFromWritten(offer.statedTotalTtc ?? ""),
          conditions: (offer.conditions ?? "").slice(0, 500),
        },
      });
      for (const line of offer.lines) {
        const productId = await ensureProduct(tx, line, offer.supplierName, source, fileId);
        await tx.quoteLine.create({
          data: {
            quoteId: quote.id,
            productId,
            statedPrice: line.statedPrice,
            statedPriceCents: centsFromWritten(line.statedPrice),
            quantity: statedLineQuantity(line.conditions),
            conditions: line.conditions.slice(0, 500),
          },
        });
      }
    });
    return true;
  } catch (error) {
    if (isUnique(error)) return false;
    throw error;
  }
}

async function ensureProduct(
  tx: Pick<typeof prisma, "product" | "supplier" | "supplierOffer">,
  line: OfferLine,
  supplierName: string,
  source: "devis" | "tarif",
  fileId: string | null,
): Promise<string> {
  const article = articleFromQuoteLine(line);
  const key = nameKey(article.name);
  const supplierId = await ensureSupplier(tx, supplierName);
  const existing = await tx.product.findUnique({ where: { nameKey: key } });
  const remember = async (productId: string) => {
    await recordSupplierOffer(tx, {
      productId,
      supplierId,
      supplierName,
      supplierReference: article.reference,
      statedCost: article.costStated,
      currency: article.currency,
      sourceFileId: fileId,
    });
  };
  if (existing) {
    const data: {
      reference?: string;
      supplierId?: string;
      kind?: string;
      costStated?: string;
      currency?: string;
    } = {};
    if (!existing.reference && article.reference) data.reference = article.reference;
    if (!existing.supplierId && supplierId) data.supplierId = supplierId;
    if (!existing.costStated && article.costStated) data.costStated = article.costStated;
    if (!existing.currency && article.currency) data.currency = article.currency;
    if (existing.kind !== "service" && article.kind === "service") data.kind = "service";
    if (Object.keys(data).length > 0) {
      await tx.product.update({ where: { id: existing.id }, data });
    }
    await remember(existing.id);
    return existing.id;
  }
  const created = await tx.product.create({
    data: {
      name: article.name,
      nameKey: key,
      reference: article.reference,
      source,
      kind: article.kind,
      costStated: article.costStated,
      currency: article.currency,
      supplierId,
    },
  });
  await remember(created.id);
  return created.id;
}

async function ensureSupplier(
  tx: Pick<typeof prisma, "supplier">,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) return null;
  const key = nameKey(trimmed.slice(0, 160));
  const existing = await tx.supplier.findUnique({ where: { nameKey: key } });
  if (existing) return existing.id;
  const created = await tx.supplier.create({
    data: { name: trimmed.slice(0, 160), nameKey: key },
  });
  return created.id;
}

async function extractIncoming(files: IncomingFile[]): Promise<string[]> {
  const results = files.map(() => "");
  const pending: Array<{ index: number; file: IncomingFile; extension: string }> = [];
  for (const [index, file] of files.entries()) {
    const extension = doclingExtension(file.name, file.type);
    if (!extension) {
      const name = file.name.toLowerCase();
      if (/\.(txt|md|csv|json)$/.test(name) || file.type.startsWith("text/")) {
        results[index] = file.bytes.toString("utf8");
      }
      continue;
    }
    if (extension === "pdf") {
      const plain = await extractPdf(file.bytes);
      if (plain.trim().length >= 400) {
        results[index] = composeExtraction(plain, [], "texte");
        continue;
      }
    }
    pending.push({ index, file, extension });
  }
  if (pending.length === 0) return results;

  const converted = await convertWithDocling(
    pending.map((item) => ({ bytes: item.file.bytes, extension: item.extension })),
  );
  for (const [offset, item] of pending.entries()) {
    if (!converted) {
      results[item.index] = await fallbackExtract(item.file);
      continue;
    }
    const reading = converted[offset] ?? { markdown: "", chunks: [] };
    if (reading.markdown.trim() || reading.chunks.length > 0) {
      results[item.index] = composeExtraction(reading.markdown, reading.chunks, "docling");
      continue;
    }
    const fallback = await fallbackExtract(item.file);
    results[item.index] = composeExtraction(fallback, [], fallback.trim() ? "repli" : "vide");
  }
  return results;
}

export async function fallbackExtract(file: IncomingFile): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    return extractDocx(file.bytes);
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file.bytes);
  }
  if (/\.(txt|md|csv|json|html?)$/.test(name) || file.type.startsWith("text/")) {
    return file.bytes.toString("utf8");
  }
  return "";
}

async function extractDocx(bytes: Buffer): Promise<string> {
  return withTempFile(bytes, "docx", async (file) => {
    const { stdout } = await execFileAsync("unzip", ["-p", file, "word/document.xml"], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout
      .replace(/<w:p[ >]/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
  });
}

async function extractPdf(bytes: Buffer): Promise<string> {
  return withTempFile(bytes, "pdf", async (file) => {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", file, "-"], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout;
  });
}

async function withTempFile(
  bytes: Buffer,
  extension: string,
  read: (file: string) => Promise<string>,
): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "piece-"));
  const file = path.join(dir, `document.${extension}`);
  try {
    await writeFile(file, bytes);
    return await read(file);
  } catch {
    return "";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function intakeMessage(files: number, proposals: number): string {
  if (files === 0) {
    return "Enregistré dans « À classer ». Aucun projet n’a été créé.";
  }
  const parts = [
    files === 1 ? "1 fichier enregistré." : `${files} fichiers enregistrés.`,
  ];
  if (proposals > 0) {
    parts.push(
      proposals === 1
        ? "1 proposition est à confirmer dans À valider."
        : `${proposals} propositions sont à confirmer dans À valider.`,
    );
  } else {
    parts.push("Aucune fiche à créer n’a été reconnue.");
  }
  parts.push("Aucun projet n’a été créé.");
  return parts.join(" ");
}

function safeDisplayName(name: string): string {
  const base = path.basename(name).replace(/[\r\n]/g, " ").trim();
  return (base || "piece").slice(0, 180);
}

function safeFileName(name: string): string {
  const base = path
    .basename(name)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return base || "piece";
}

function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
