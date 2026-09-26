import { assignSuppliers, type SaleKind } from "@/domain/sale-line";
import {
  centsFromStated,
  formatCents,
  saleLineFigures,
  saleOperationTotals,
  type SaleLineDraft,
} from "@/domain/pricing";
import { prisma } from "@/lib/db";

type StoredLine = SaleLineDraft & {
  id: string;
  name: string;
  kind: string;
  supplierName: string;
};

async function trace(projectId: string, kind: string, body: string) {
  await prisma.projectEvent.create({ data: { projectId, kind, body } });
}

function snapshot(line: StoredLine) {
  return {
    kind: line.kind === "service" ? "service" : "produit",
    name: line.name,
    supplierName: line.supplierName,
    quantity: line.quantity,
    costCents: line.costCents,
    markupPercent: line.markupPercent,
    discountPercent: line.discountPercent,
  };
}

function figuresOf(line: SaleLineDraft) {
  return saleLineFigures(line);
}

export async function addProjectLine(input: {
  projectId: string;
  productId: string;
  name: string;
  kind: string;
  supplierName: string;
  quantity: number;
  costCents: number | null;
  markupPercent: number;
  discountPercent: number;
}): Promise<string> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new Error("Ce projet est introuvable.");
  let name = input.name.trim().replace(/\s+/g, " ");
  let kind = input.kind === "service" ? "service" : "produit";
  let supplierName = input.supplierName.trim().replace(/\s+/g, " ");
  let costCents = input.costCents;
  const product = input.productId
    ? await prisma.product.findUnique({ where: { id: input.productId }, include: { supplier: true } })
    : null;
  if (input.productId && !product) throw new Error("Ce produit du catalogue est introuvable.");
  if (product) {
    if (!name) name = product.name;
    if (product.kind === "service") kind = "service";
    if (!supplierName) supplierName = product.supplier?.name ?? "";
    if (costCents === null && product.costStated) costCents = centsFromStated(product.costStated);
  }
  if (name.length < 2) throw new Error("Indiquez le nom du produit ou du service.");
  figuresOf({
    quantity: input.quantity,
    costCents,
    markupPercent: input.markupPercent,
    discountPercent: input.discountPercent,
  });
  await prisma.projectLine.create({
    data: {
      projectId: project.id,
      productId: product?.id,
      kind,
      name: name.slice(0, 120),
      supplierName: supplierName.slice(0, 120),
      quantity: input.quantity,
      costCents,
      markupPercent: input.markupPercent,
      discountPercent: input.discountPercent,
    },
  });
  const priced = figuresOf({
    quantity: input.quantity,
    costCents,
    markupPercent: input.markupPercent,
    discountPercent: input.discountPercent,
  });
  await trace(
    project.id,
    "ligne",
    `${kind === "service" ? "Service" : "Produit"} ajouté : ${name}. Prix de vente HT ${formatCents(priced.lineNetCents)}, marge ${formatCents(priced.lineMarginCents)}.`,
  );
  return `${name} est ajouté au projet.`;
}

export async function updateProjectLines(
  projectId: string,
  rows: Array<StoredLine>,
): Promise<string> {
  const current = await prisma.projectLine.findMany({ where: { projectId } });
  const byId = new Map(current.map((line) => [line.id, line]));
  let changed = 0;
  for (const row of rows) {
    const line = byId.get(row.id);
    if (!line) continue;
    figuresOf(row);
    const same =
      line.quantity === row.quantity &&
      line.costCents === row.costCents &&
      line.markupPercent === row.markupPercent &&
      line.discountPercent === row.discountPercent &&
      line.supplierName === row.supplierName.trim();
    if (same) continue;
    await prisma.projectLine.update({
      where: { id: line.id },
      data: {
        quantity: row.quantity,
        costCents: row.costCents,
        markupPercent: row.markupPercent,
        discountPercent: row.discountPercent,
        supplierName: row.supplierName.trim().slice(0, 120),
        confirmedAt: null,
      },
    });
    changed += 1;
  }
  if (changed === 0) return "Aucun chiffre n’a changé.";
  await trace(projectId, "chiffres", `Chiffres actualisés sur ${changed} ligne${changed > 1 ? "s" : ""}.`);
  return `Chiffres actualisés sur ${changed} ligne${changed > 1 ? "s" : ""}. La confirmation précédente est levée.`;
}

export async function confirmProjectLines(projectId: string): Promise<string> {
  const lines = await prisma.projectLine.findMany({ where: { projectId } });
  if (lines.length === 0) throw new Error("Ajoutez un produit ou un service avant de confirmer.");
  const figures = lines.map((line) => figuresOf(line));
  const totals = saleOperationTotals(figures);
  if (totals.missing > 0) {
    throw new Error("Chaque ligne doit avoir un coût HT avant la confirmation.");
  }
  const now = new Date();
  await prisma.projectLine.updateMany({
    where: { projectId },
    data: { confirmedAt: now },
  });
  await trace(
    projectId,
    "confirmation",
    `Chiffres du dossier confirmés. Prix de vente HT ${formatCents(totals.netCents)}, marge ${formatCents(totals.marginCents)}.`,
  );
  return `Chiffres confirmés. Prix de vente HT ${formatCents(totals.netCents)}, marge ${formatCents(totals.marginCents)}.`;
}

export async function establishQuote(projectId: string, lineIds: string[], title: string): Promise<string> {
  const unique = [...new Set(lineIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) throw new Error("Sélectionnez au moins un produit ou un service.");
  const lines = await prisma.projectLine.findMany({
    where: { projectId, id: { in: unique } },
    orderBy: { createdAt: "asc" },
  });
  if (lines.length !== unique.length) throw new Error("Une ligne sélectionnée ne fait pas partie de ce projet.");
  const label = title.trim().replace(/\s+/g, " ").slice(0, 120) || `Devis du ${new Date().toLocaleDateString("fr-FR")}`;
  const document = await prisma.saleDocument.create({
    data: {
      projectId,
      kind: "devis",
      status: "en_cours",
      title: label,
      lines: { create: lines.map(snapshot) },
    },
  });
  const totals = saleOperationTotals(lines.map((line) => figuresOf(line)));
  await trace(
    projectId,
    "devis",
    `Devis « ${document.title} » établi, ${lines.length} ligne${lines.length > 1 ? "s" : ""}. Prix de vente HT ${formatCents(totals.missing > 0 ? null : totals.netCents)}.`,
  );
  return `Devis « ${document.title} » établi.`;
}

async function loadDocument(id: string) {
  const document = await prisma.saleDocument.findUnique({
    where: { id },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!document) throw new Error("Ce document est introuvable.");
  return document;
}

export async function markQuoteUnsuccessful(documentId: string): Promise<string> {
  const document = await loadDocument(documentId);
  if (document.kind !== "devis" || document.status !== "en_cours") {
    throw new Error("Seul un devis en cours peut être marqué non abouti.");
  }
  await prisma.saleDocument.update({
    where: { id: document.id },
    data: { status: "non_abouti" },
  });
  await trace(document.projectId, "devis", `Devis « ${document.title} » marqué non abouti.`);
  return `Devis « ${document.title} » classé dans les devis non aboutis.`;
}

export async function openCustomerOrder(documentId: string): Promise<string> {
  const document = await loadDocument(documentId);
  if (document.kind !== "devis" || document.status !== "en_cours") {
    throw new Error("La commande client part d’un devis encore en cours.");
  }
  const created = await prisma.saleDocument.create({
    data: {
      projectId: document.projectId,
      kind: "commande_client" satisfies SaleKind,
      status: "en_cours",
      title: `Commande client · ${document.title}`.slice(0, 120),
      sourceId: document.id,
      lines: { create: document.lines.map(snapshot) },
    },
  });
  await prisma.saleDocument.update({
    where: { id: document.id },
    data: { status: "transforme" },
  });
  await trace(document.projectId, "commande", `Commande client « ${created.title} » ouverte depuis le devis « ${document.title} ».`);
  return `Commande client « ${created.title} » ouverte.`;
}

export async function openSupplierOrders(documentId: string, fallbackSupplier: string): Promise<string> {
  const document = await loadDocument(documentId);
  if (document.kind !== "commande_client" || document.status !== "en_cours") {
    throw new Error("La commande fournisseur part d’une commande client en cours.");
  }
  const assigned = assignSuppliers(document.lines, fallbackSupplier);
  if (assigned.groups.length === 0) {
    throw new Error("Indiquez un fournisseur pour établir la commande.");
  }
  for (const group of assigned.groups) {
    await prisma.saleDocument.create({
      data: {
        projectId: document.projectId,
        kind: "commande_fournisseur",
        status: "en_cours",
        title: `Commande fournisseur · ${group.supplierName}`.slice(0, 120),
        supplierName: group.supplierName,
        sourceId: document.id,
        lines: { create: group.lines.map(snapshot) },
      },
    });
  }
  const names = assigned.groups.map((group) => group.supplierName).join(", ");
  await trace(document.projectId, "achat", `Commande fournisseur ouverte : ${names}.`);
  const missing =
    assigned.missing.length > 0
      ? ` ${assigned.missing.length} ligne${assigned.missing.length > 1 ? "s" : ""} sans fournisseur ${assigned.missing.length > 1 ? "restent" : "reste"} hors commande.`
      : "";
  return `Commande fournisseur ouverte pour ${names}.${missing}`;
}

export async function updateDocumentLines(documentId: string, rows: StoredLine[]): Promise<string> {
  const document = await loadDocument(documentId);
  if (document.status !== "en_cours") {
    throw new Error("Ce document n’est plus modifiable.");
  }
  if (document.confirmedAt) {
    throw new Error("Les chiffres sont confirmés. Reprenez-les avant de les modifier.");
  }
  const byId = new Map(document.lines.map((line) => [line.id, line]));
  let changed = 0;
  for (const row of rows) {
    const line = byId.get(row.id);
    if (!line || line.documentId !== document.id) continue;
    figuresOf(row);
    const same =
      line.quantity === row.quantity &&
      line.costCents === row.costCents &&
      line.markupPercent === row.markupPercent &&
      line.discountPercent === row.discountPercent;
    if (same) continue;
    await prisma.saleDocumentLine.update({
      where: { id: line.id },
      data: {
        quantity: row.quantity,
        costCents: row.costCents,
        markupPercent: row.markupPercent,
        discountPercent: row.discountPercent,
      },
    });
    changed += 1;
  }
  if (changed === 0) return "Aucun chiffre n’a changé.";
  await trace(document.projectId, "chiffres", `Chiffres actualisés sur « ${document.title} ».`);
  return `Chiffres actualisés sur « ${document.title} ».`;
}

export async function confirmDocument(documentId: string): Promise<string> {
  const document = await loadDocument(documentId);
  if (document.status !== "en_cours") throw new Error("Ce document n’est plus modifiable.");
  const figures = document.lines.map((line) => figuresOf(line));
  const totals = saleOperationTotals(figures);
  if (document.lines.length === 0 || totals.missing > 0) {
    throw new Error("Chaque ligne doit avoir un coût HT avant la confirmation.");
  }
  await prisma.saleDocument.update({
    where: { id: document.id },
    data: { confirmedAt: new Date() },
  });
  await trace(
    document.projectId,
    "confirmation",
    `Chiffres confirmés sur « ${document.title} ». Prix de vente HT ${formatCents(totals.netCents)}, marge ${formatCents(totals.marginCents)}.`,
  );
  return `Chiffres confirmés sur « ${document.title} ».`;
}

export async function reopenDocument(documentId: string): Promise<string> {
  const document = await loadDocument(documentId);
  if (document.status !== "en_cours" || !document.confirmedAt) {
    throw new Error("Ces chiffres ne sont pas confirmés.");
  }
  await prisma.saleDocument.update({
    where: { id: document.id },
    data: { confirmedAt: null },
  });
  await trace(document.projectId, "chiffres", `Confirmation levée sur « ${document.title} ».`);
  return `Confirmation levée sur « ${document.title} ». Les chiffres peuvent être repris.`;
}
