import { safeReply, type AnswerPacket } from "@/domain/answer-packet";
import {
  dossierGapPacket,
  profitPacket,
  projectIsOpen,
  readDossierQuestion,
  receivedPacket,
  stockPacket,
  unrecoveredPacket,
  type ProfitHour,
} from "@/domain/dossier";
import { uniqueNameMatch } from "@/domain/knowledge";
import { centsFromStated } from "@/domain/pricing";
import { prisma } from "@/lib/db";

export type DossierReply = {
  reply: string;
  packet: AnswerPacket;
  source: "regle-metier";
};

const HOUR_LABEL: Record<string, string> = {
  assistance: "Assistance",
  intervention: "Intervention",
  integration: "Intégration réseau",
  panne: "Panne",
};

export async function resolveDossier(text: string, now = new Date()): Promise<DossierReply | null> {
  const question = readDossierQuestion(text);
  if (!question) return null;
  if (question.kind === "stock") return answerStock();
  if (question.kind === "received") return answerReceived(now);
  const project = await namedProject(text);
  const title = question.kind === "profit" ? "Rentabilité du dossier" : "Achats non repris";
  if (!project) {
    const packet = dossierGapPacket(title, "Indiquez un seul dossier déjà enregistré.");
    return { reply: safeReply(packet), packet, source: "regle-metier" };
  }
  if (question.kind === "profit") return answerProfit(project);
  return answerUnrecovered(project);
}

async function answerProfit(project: { id: string; name: string }): Promise<DossierReply> {
  const [documents, purchases, interventions, unconfirmedQuotes] = await Promise.all([
    prisma.saleDocument.findMany({
      where: { projectId: project.id, kind: "commande_client", confirmedAt: { not: null } },
      include: { lines: true },
    }),
    prisma.purchaseFollowUp.findMany({ where: { projectId: project.id }, select: { designation: true, orderCents: true } }),
    prisma.intervention.findMany({
      where: { projectId: project.id },
      select: { kind: true, occurredOn: true, durationMinutes: true, rateUnit: true, rateCents: true },
    }),
    prisma.saleDocument.count({ where: { projectId: project.id, kind: "devis", confirmedAt: null } }),
  ]);
  const packet = profitPacket({
    projectName: project.name,
    sales: documents.flatMap((document) =>
      document.lines.map((line) => ({
        name: line.name,
        family: line.family,
        kind: line.kind,
        quantity: line.quantity,
        saleUnitCents: line.saleUnitCents,
      })),
    ),
    purchases,
    hours: interventions.flatMap((row) => {
      if (row.rateUnit !== "horaire" && row.rateUnit !== "journalier") return [];
      const hour: ProfitHour = {
        label: HOUR_LABEL[row.kind] ?? row.kind,
        occurredOn: row.occurredOn,
        durationMinutes: row.durationMinutes,
        rateUnit: row.rateUnit,
        rateCents: row.rateCents,
      };
      return [hour];
    }),
    unconfirmedQuotes,
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function answerStock(): Promise<DossierReply> {
  const [products, lines] = await Promise.all([
    prisma.product.findMany({ select: { name: true, stockQty: true, costStated: true } }),
    prisma.projectLine.findMany({ select: { quantity: true, project: { select: { name: true, status: true } } } }),
  ]);
  const packet = stockPacket({
    products: products.map((product) => ({
      name: product.name,
      stockQty: product.stockQty,
      costCents: product.stockQty === null ? null : centsFromStated(product.costStated),
    })),
    lines: lines.map((line) => ({
      projectName: line.project.name,
      open: projectIsOpen(line.project.status),
      quantity: line.quantity,
    })),
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function answerReceived(now: Date): Promise<DossierReply> {
  const [purchases, interventions] = await Promise.all([
    prisma.purchaseFollowUp.findMany({
      select: { designation: true, projectId: true, remainder: true, project: { select: { name: true } } },
    }),
    prisma.intervention.findMany({ select: { projectId: true, occurredOn: true } }),
  ]);
  const packet = receivedPacket({
    purchases: purchases.map((row) => ({
      designation: row.designation,
      projectId: row.projectId ?? "",
      projectName: row.project?.name ?? "",
      remainder: row.remainder,
    })),
    interventions,
    today: now.toISOString().slice(0, 10),
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function answerUnrecovered(project: { id: string; name: string }): Promise<DossierReply> {
  const [purchases, quotes, pieces] = await Promise.all([
    prisma.purchaseFollowUp.findMany({ where: { projectId: project.id }, select: { designation: true } }),
    prisma.saleDocument.findMany({
      where: { projectId: project.id, kind: "devis" },
      include: { lines: { include: { product: { select: { name: true, reference: true } } } } },
    }),
    prisma.notedPiece.findMany({ where: { projectId: project.id }, select: { reference: true } }),
  ]);
  const quoteNames = quotes.flatMap((quote) =>
    quote.lines.flatMap((line) => [line.name, line.product?.name ?? "", line.product?.reference ?? ""]),
  );
  const packet = unrecoveredPacket({
    projectName: project.name,
    purchases,
    quoteNames,
    notedReferences: pieces.map((piece) => piece.reference),
  });
  return { reply: safeReply(packet), packet, source: "regle-metier" };
}

async function namedProject(text: string): Promise<{ id: string; name: string } | null> {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const name = uniqueNameMatch(text, projects.map((project) => project.name));
  const matches = projects.filter((project) => project.name === name);
  if (!name || matches.length !== 1) return null;
  return matches[0] ?? null;
}
