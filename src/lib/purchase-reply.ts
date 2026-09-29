import { revalidatePath } from "next/cache";
import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import { uniqueNameMatch } from "@/domain/knowledge";
import { stampProvenance } from "@/domain/provenance";
import { pendingInThread } from "@/domain/proposal-scope";
import {
  DELIVERIES,
  PURCHASE_FAMILIES,
  REMAINDERS,
  directPacket,
  gapPacket,
  hasDollars,
  overduePacket,
  outstandingPacket,
  periodGapPacket,
  purchaseFields,
  purchaseGapMessage,
  purchaseGapPacket,
  purchasePayload,
  purchaseProposalPacket,
  readPurchaseEntry,
  readPurchaseQuestion,
  readSupplierTerms,
  subcontractPacket,
  termsFields,
  termsGapMessage,
  termsGapPacket,
  termsPayload,
  termsProposalPacket,
  todayIso,
  volumePacket,
  yearWindow,
  type Delivery,
  type PurchaseFamily,
  type PurchasePayload,
  type Remainder,
  type StoredPurchase,
  type SupplierTerms,
  type SupplierTermsPayload,
} from "@/domain/purchases";
import { withChangeSource } from "@/lib/change-source";
import { prisma } from "@/lib/db";

export type PurchaseReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier" | "proposition";
  proposal?: { fields: Array<{ label: string; value: string }> };
};

export async function resolvePurchase(text: string, conversationId: string, now = new Date()): Promise<PurchaseReply | null> {
  const question = readPurchaseQuestion(text);
  if (question) return answerQuestion(question, text, now);
  const terms = readSupplierTerms(text);
  if (terms) return proposeTerms(text, terms, conversationId);
  const sketch = readPurchaseEntry(text);
  if (!sketch) return null;
  const missing = purchaseGapMessage(sketch, hasDollars(text));
  if (missing || !sketch.family || !sketch.remainder || !sketch.delivery || sketch.orderCents === null) {
    const packet = purchaseGapPacket(missing ?? "Indiquez la famille : serveur, poste, portable, réseau, prestation, autre ou sous-traitance.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const supplierName = uniqueNameMatch(text, suppliers.map((supplier) => supplier.name));
  if (!supplierName) {
    const packet = purchaseGapPacket(supplierMissing(suppliers.length, "L’achat"));
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const supplier = suppliers.find((item) => item.name === supplierName);
  if (!supplier) return null;
  const linked = await linkedProject(text, sketch.dossierName);
  if (linked.missing) {
    const packet = purchaseGapPacket(linked.missing);
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const draft: PurchasePayload = {
    supplierId: supplier.id,
    supplierName: supplier.name,
    projectId: linked.projectId,
    projectName: linked.projectName,
    designation: sketch.designation,
    family: sketch.family,
    orderedOn: sketch.orderedOn,
    orderCents: sketch.orderCents,
    invoiceCents: sketch.invoiceCents,
    remainder: sketch.remainder,
    shipsOn: sketch.shipsOn,
    tracking: sketch.tracking,
    delivery: sketch.delivery,
    invoiceReference: sketch.invoiceReference,
    invoiceOn: sketch.invoiceOn,
  };
  const packet = purchaseProposalPacket(draft);
  const fields = purchaseFields(draft);
  const scope = pendingInThread(conversationId);
  if (!scope) {
    const packet = purchaseGapPacket("Le fil est inconnu. L’achat n’est pas proposé.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  await prisma.purchaseFollowUpProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  await prisma.purchaseFollowUpProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: draft,
      ...stampProvenance("regle", fields),
    },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: { fields } };
}

async function proposeTerms(
  text: string,
  sketch: NonNullable<ReturnType<typeof readSupplierTerms>>,
  conversationId: string,
): Promise<PurchaseReply> {
  const missing = termsGapMessage(sketch, hasDollars(text));
  if (missing || sketch.outstandingCents === null || sketch.paymentDays === null) {
    const packet = termsGapPacket(missing ?? "Indiquez le montant de l’encours.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const supplierName = uniqueNameMatch(text, suppliers.map((supplier) => supplier.name));
  if (!supplierName) {
    const packet = termsGapPacket(supplierMissing(suppliers.length, "L’encours"));
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const supplier = suppliers.find((item) => item.name === supplierName);
  if (!supplier) {
    const packet = termsGapPacket(supplierMissing(suppliers.length, "L’encours"));
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const draft: SupplierTermsPayload = {
    supplierId: supplier.id,
    supplierName: supplier.name,
    outstandingCents: sketch.outstandingCents,
    paymentDays: sketch.paymentDays,
  };
  const packet = termsProposalPacket(draft);
  const fields = termsFields(draft);
  const scope = pendingInThread(conversationId);
  if (!scope) {
    const packet = termsGapPacket("Le fil est inconnu. L’encours n’est pas proposé.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  await prisma.supplierTermsProposal.updateMany({
    where: { status: "en_attente", conversationId: scope.conversationId },
    data: { status: "remplacee" },
  });
  await prisma.supplierTermsProposal.create({
    data: {
      status: "en_attente",
      conversationId: scope.conversationId,
      payload: draft,
      ...stampProvenance("regle", fields),
    },
  });
  return { reply: safeReply(packet), packet, source: "proposition", proposal: { fields } };
}

export async function confirmPurchaseProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingPurchaseProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas d’achat en attente." };
  const draft = purchasePayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition d’achat est illisible." };
  const supplier = await prisma.supplier.findUnique({ where: { id: draft.supplierId }, select: { id: true, name: true } });
  if (!supplier) return { ok: false, summary: "Ce fournisseur est introuvable. L’achat n’est pas enregistré." };
  if (draft.projectId) {
    const project = await prisma.project.findUnique({ where: { id: draft.projectId }, select: { id: true } });
    if (!project) return { ok: false, summary: "Ce dossier est introuvable. L’achat n’est pas enregistré." };
  }
  await withChangeSource("assistant", () =>
    prisma.purchaseFollowUp.create({
      data: {
        supplierId: supplier.id,
        designation: draft.designation,
        family: draft.family,
        orderedOn: draft.orderedOn,
        orderCents: draft.orderCents,
        invoiceCents: draft.invoiceCents,
        remainder: draft.remainder,
        shipsOn: draft.shipsOn,
        tracking: draft.tracking,
        delivery: draft.delivery,
        projectId: draft.projectId || null,
        invoiceReference: draft.invoiceReference,
        invoiceOn: draft.invoiceOn,
        confirmedAt: new Date(),
      },
    }),
  );
  await prisma.purchaseFollowUpProposal.update({
    where: { id: row.id },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { ok: true, summary: `${draft.designation} pour ${supplier.name} enregistré. Validation enregistrée.` };
}

export async function confirmSupplierTermsProposal(conversationId: string): Promise<{ ok: boolean; summary: string }> {
  const row = await pendingSupplierTermsProposal(conversationId);
  if (!row) return { ok: false, summary: "Il n’y a pas d’encours en attente." };
  const draft = termsPayload(row.payload);
  if (!draft) return { ok: false, summary: "Cette proposition d’encours est illisible." };
  const supplier = await prisma.supplier.findUnique({ where: { id: draft.supplierId }, select: { id: true, name: true } });
  if (!supplier) return { ok: false, summary: "Ce fournisseur est introuvable. L’encours n’est pas enregistré." };
  await withChangeSource("assistant", () =>
    prisma.supplier.update({
      where: { id: supplier.id },
      data: { outstandingCents: draft.outstandingCents, paymentDays: draft.paymentDays },
    }),
  );
  await prisma.supplierTermsProposal.update({
    where: { id: row.id },
    data: { status: "confirmee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { ok: true, summary: `Encours de ${supplier.name} enregistré. Validation enregistrée.` };
}

export async function rejectPurchaseProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingPurchaseProposal(conversationId);
  if (!row) return null;
  await prisma.purchaseFollowUpProposal.update({
    where: { id: row.id },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { reply: "L’achat n’est pas enregistré." };
}

export async function rejectSupplierTermsProposal(conversationId: string): Promise<{ reply: string } | null> {
  const row = await pendingSupplierTermsProposal(conversationId);
  if (!row) return null;
  await prisma.supplierTermsProposal.update({
    where: { id: row.id },
    data: { status: "rejetee", validatedAt: new Date() },
  });
  revalidatePath("/");
  return { reply: "L’encours n’est pas enregistré." };
}

export async function pendingPurchaseProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.purchaseFollowUpProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function pendingSupplierTermsProposal(conversationId: string) {
  const scope = pendingInThread(conversationId);
  if (!scope) return null;
  return prisma.supplierTermsProposal.findFirst({
    where: { status: "en_attente", conversationId: scope.conversationId },
    orderBy: { createdAt: "desc" },
  });
}

async function answerQuestion(
  question: NonNullable<ReturnType<typeof readPurchaseQuestion>>,
  text: string,
  now: Date,
): Promise<PurchaseReply> {
  if ((question.kind === "subcontract" || question.kind === "volume") && question.period !== "year") {
    const title = question.kind === "subcontract" ? "Sous-traitance" : "Volume d’achat";
    const packet = periodGapPacket(
      title,
      question.period === "missing" ? "Indiquez la période : depuis le début de l’année." : "Ce montant se demande depuis le début de l’année.",
    );
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "outstanding" && (question.daysConflict || question.days === null)) {
    const packet = termsGapPacket(question.daysConflict ? "Un seul délai en jours." : "Indiquez le délai en jours, par exemple 60 jours.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const [stored, terms, pendingPurchase, pendingTerms] = await Promise.all([
    loadPurchases(),
    loadTerms(),
    prisma.purchaseFollowUpProposal.count({ where: { status: "en_attente" } }),
    prisma.supplierTermsProposal.count({ where: { status: "en_attente" } }),
  ]);
  if (question.kind === "gap") {
    const suppliers = await prisma.supplier.findMany({ select: { name: true } });
    const named = uniqueNameMatch(text, suppliers.map((supplier) => supplier.name));
    const packet = gapPacket({ rows: stored, supplierName: named ?? "", pending: pendingPurchase });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "overdue") {
    const packet = overduePacket({ rows: stored, today: todayIso(now), pending: pendingPurchase });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "direct") {
    const packet = directPacket({ rows: stored, pending: pendingPurchase });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "outstanding" && question.days !== null) {
    const packet = outstandingPacket({ rows: terms, days: question.days, pending: pendingTerms });
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  const window = yearWindow(now);
  const packet =
    question.kind === "subcontract"
      ? subcontractPacket({ rows: stored, ...window, pending: pendingPurchase })
      : volumePacket({ rows: stored, ...window, pending: pendingPurchase });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function loadPurchases(): Promise<StoredPurchase[]> {
  const rows = await prisma.purchaseFollowUp.findMany({
    select: {
      designation: true,
      family: true,
      orderedOn: true,
      orderCents: true,
      invoiceCents: true,
      remainder: true,
      shipsOn: true,
      tracking: true,
      delivery: true,
      supplier: { select: { name: true } },
    },
  });
  return rows.flatMap((row) => {
    if (!isFamily(row.family) || !isRemainder(row.remainder) || !isDelivery(row.delivery)) return [];
    return [
      {
        supplierName: row.supplier.name,
        designation: row.designation,
        family: row.family,
        orderedOn: row.orderedOn,
        orderCents: row.orderCents,
        invoiceCents: row.invoiceCents,
        remainder: row.remainder,
        shipsOn: row.shipsOn,
        tracking: row.tracking,
        delivery: row.delivery,
      },
    ];
  });
}

async function loadTerms(): Promise<SupplierTerms[]> {
  const rows = await prisma.supplier.findMany({
    where: { outstandingCents: { not: null }, paymentDays: { not: null } },
    select: { name: true, outstandingCents: true, paymentDays: true },
  });
  return rows.flatMap((row) => {
    if (row.outstandingCents === null || row.paymentDays === null) return [];
    return [{ supplierName: row.name, outstandingCents: row.outstandingCents, paymentDays: row.paymentDays }];
  });
}

async function linkedProject(
  text: string,
  dossierName: string,
): Promise<{ projectId: string; projectName: string; missing: string }> {
  if (!/\bdossier\b/i.test(text)) return { projectId: "", projectName: "", missing: "" };
  if (dossierName.trim().length < 2) return { projectId: "", projectName: "", missing: "Indiquez le dossier." };
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const name = uniqueNameMatch(dossierName, projects.map((project) => project.name));
  const matches = projects.filter((project) => project.name === name);
  if (!name || matches.length !== 1) return { projectId: "", projectName: "", missing: "Indiquez un seul dossier déjà enregistré." };
  const project = matches[0];
  if (!project) return { projectId: "", projectName: "", missing: "Indiquez un seul dossier déjà enregistré." };
  return { projectId: project.id, projectName: project.name, missing: "" };
}

function supplierMissing(count: number, label: string): string {
  return count === 0
    ? `Aucun fournisseur n’est au répertoire. ${label} n’est pas proposé.`
    : `Nommez un seul fournisseur déjà enregistré. ${label} n’est pas proposé.`;
}

function isFamily(value: string): value is PurchaseFamily {
  return PURCHASE_FAMILIES.includes(value as PurchaseFamily);
}

function isRemainder(value: string): value is Remainder {
  return REMAINDERS.includes(value as Remainder);
}

function isDelivery(value: string): value is Delivery {
  return DELIVERIES.includes(value as Delivery);
}
