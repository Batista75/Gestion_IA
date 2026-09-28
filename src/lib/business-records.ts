import { nameKey } from "@/domain/catalog";
import {
  matchDirectoryName,
  type ArticleBrief,
  type BusinessPlan,
  type ClientBrief,
  type ProjectBrief,
  type QuoteBrief,
} from "@/domain/business-brief";
import { datasheetProduct } from "@/domain/offer-versions";
import {
  centsFromStated,
  centsFromWritten,
  checkAffair,
  vatRule,
  type MoneyCurrency,
  type VatZone,
} from "@/domain/pricing";
import { prisma } from "@/lib/db";

export type AttachedPiece = {
  id: string;
  originalName: string;
  text: string;
};

type SavedProject = {
  id: string;
  name: string;
  purpose: string;
  reference: string;
  created: boolean;
};

export async function ensureSpokenProject(input: {
  name: string;
  primaryClient: string;
  purpose?: string;
  nextAction?: string;
  reference?: string;
  sector?: string;
  budgetStated?: string;
  status?: string;
  lead?: string;
  currency?: string;
}): Promise<{ ok: boolean; summary: string; projectId: string | null }> {
  const names = await prisma.client.findMany({ select: { name: true } });
  const saved = await saveProject(
    {
      reference: input.reference ?? "",
      name: input.name,
      clientRef: "",
      primaryClient: input.primaryClient,
      sector: input.sector ?? "",
      budgetStated: input.budgetStated ?? "",
      status: input.status?.trim() || "À qualifier",
      lead: input.lead ?? "",
      purpose: input.purpose ?? "",
      currency: input.currency || "EUR",
    },
    names.map((client) => client.name),
    input.nextAction,
  );
  if (!saved) {
    return { ok: false, summary: "Indiquez le nom du projet et le client.", projectId: null };
  }
  return { ok: true, summary: saved.summary, projectId: saved.project.id };
}

export async function applyBusinessPlan(
  plan: BusinessPlan,
  attached: AttachedPiece[] = [],
): Promise<{ ok: boolean; summary: string }> {
  const notes: string[] = [];
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, nameKey: true, reference: true, sector: true, currency: true, contactName: true, email: true, country: true },
  });
  const knownNames = clients.map((client) => client.name);
  let clientCount = 0;
  for (const brief of plan.clients) {
    const written = await saveClient(brief);
    if (!written) continue;
    if (!knownNames.includes(written.name)) knownNames.push(written.name);
    if (written.created) clientCount += 1;
  }
  if (clientCount > 0) {
    notes.push(clientCount === 1 ? "1 client enregistré." : `${clientCount} clients enregistrés.`);
  }

  let articleCount = 0;
  for (const article of plan.articles) {
    if (await saveArticle(article)) articleCount += 1;
  }
  if (articleCount > 0) {
    notes.push(
      articleCount === 1
        ? "1 article ajouté au catalogue, au prix indiqué."
        : `${articleCount} articles ajoutés au catalogue, aux prix indiqués.`,
    );
  }

  const projects: SavedProject[] = [];
  for (const brief of plan.projects) {
    const saved = await saveProject(brief, knownNames);
    if (!saved) continue;
    projects.push(saved.project);
    notes.push(saved.summary);
  }

  const quoteNotes: string[] = [];
  let usdUntouched = false;
  let marginMissing = false;
  for (const quote of plan.quotes) {
    const result = await saveQuote(quote, projects, knownNames);
    if (!result) continue;
    quoteNotes.push(result.note);
    if (result.usdUntouched) usdUntouched = true;
    if (result.marginMissing) marginMissing = true;
  }
  notes.push(...quoteNotes);

  const sheetNotes = await attachPieces(attached, projects);
  notes.push(...sheetNotes);

  if (usdUntouched) {
    notes.push("Les montants en dollars restent en dollars : aucun taux vers l’euro n’est indiqué.");
  }
  if (marginMissing) {
    notes.push("La marge brute n’est pas calculée : aucun coût de revient n’est indiqué.");
  }
  if (notes.length === 0) {
    return { ok: false, summary: "Je n’ai pas trouvé d’enregistrement à faire dans ce message." };
  }
  return { ok: true, summary: notes.join(" ") };
}

async function saveClient(brief: ClientBrief): Promise<{ name: string; created: boolean } | null> {
  const name = brief.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return null;
  if (brief.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.email)) return null;
  const key = nameKey(name);
  const existing = await prisma.client.findUnique({ where: { nameKey: key } });
  if (existing) {
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        reference: existing.reference || brief.reference,
        sector: existing.sector || brief.sector,
        currency: existing.currency || brief.currency,
        country: existing.country || brief.country,
        contactName: existing.contactName || brief.contactName,
        email: existing.email || brief.email,
        kind: existing.kind || "entreprise",
      },
    });
    return { name: existing.name, created: false };
  }
  await prisma.client.create({
    data: {
      name,
      nameKey: key,
      kind: "entreprise",
      country: brief.country,
      reference: brief.reference,
      sector: brief.sector,
      currency: brief.currency,
      contactName: brief.contactName,
      email: brief.email,
    },
  });
  return { name, created: true };
}

async function saveArticle(article: ArticleBrief): Promise<boolean> {
  const name = article.name.trim().replace(/\s+/g, " ").slice(0, 120);
  if (name.length < 2) return false;
  const key = nameKey(name);
  const stated = article.statedPrice
    ? `${article.statedPrice}${article.currency ? ` ${article.currency}` : ""}`.trim()
    : "";
  const existing =
    (article.reference
      ? await prisma.product.findFirst({ where: { reference: article.reference } })
      : null) ?? (await prisma.product.findUnique({ where: { nameKey: key } }));
  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        reference: existing.reference || article.reference.slice(0, 60),
        unit: existing.unit && existing.unit !== "u" ? existing.unit : article.unit.slice(0, 20) || existing.unit,
        description: existing.description || article.domain.slice(0, 1000),
        kind: article.kind,
        statedPrice: existing.statedPrice || stated.slice(0, 80),
        currency: existing.currency || article.currency,
        vatNote: existing.vatNote || article.vatNote.slice(0, 80),
      },
    });
    return false;
  }
  await prisma.product.create({
    data: {
      name,
      nameKey: key,
      reference: article.reference.slice(0, 60),
      unit: article.unit.slice(0, 20) || "u",
      description: article.domain.slice(0, 1000),
      source: "assistant",
      kind: article.kind,
      statedPrice: stated.slice(0, 80),
      currency: article.currency,
      vatNote: article.vatNote.slice(0, 80),
    },
  });
  return true;
}

async function saveProject(
  brief: ProjectBrief,
  knownNames: string[],
  nextAction?: string,
): Promise<{ project: SavedProject; summary: string } | null> {
  const name = brief.name.trim().replace(/\s+/g, " ");
  const asked = (brief.primaryClient || brief.clientRef).trim().replace(/\s+/g, " ");
  if (name.length < 2 || asked.length < 2) return null;
  const byReference = /^CLI-/i.test(asked)
    ? await prisma.client.findFirst({ where: { reference: asked } })
    : null;
  const matched = byReference?.name ?? matchDirectoryName(asked, knownNames);
  const primaryClient = matched || asked;
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const existing = projects.find(
    (project) =>
      (brief.reference && project.reference === brief.reference) || nameKey(project.name) === nameKey(name),
  );
  const purpose = brief.purpose.trim();
  const lead = brief.lead.trim();
  const action = nextAction?.trim() || (lead ? `Chef de projet : ${lead}` : "Qualifier le besoin");
  if (existing) {
    if (purpose && !existing.purpose) {
      await prisma.project.update({ where: { id: existing.id }, data: { purpose } });
      await addEvent(existing.id, "objet", `Le projet consiste à ${purpose}.`);
    }
    return {
      project: {
        id: existing.id,
        name: existing.name,
        purpose: existing.purpose || purpose,
        reference: existing.reference,
        created: false,
      },
      summary: `Le projet « ${existing.name} » est déjà ouvert. L’actualité est conservée.`,
    };
  }
  const created = await prisma.project.create({
    data: {
      name,
      primaryClient,
      status: brief.status.trim() || "À qualifier",
      nextAction: action,
      purpose,
      reference: brief.reference.slice(0, 40),
      sector: brief.sector.slice(0, 120),
      currency: brief.currency || "EUR",
      budgetStated: brief.budgetStated.slice(0, 80),
      lead: lead.slice(0, 80),
    },
  });
  const opening = [
    `Projet ouvert pour ${primaryClient}.`,
    purpose ? `Le projet consiste à ${purpose}.` : "",
    brief.budgetStated ? `Budget indiqué : ${brief.budgetStated}.` : "",
    lead ? `Chef de projet indiqué : ${lead}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  await addEvent(created.id, "ouverture", opening);
  const clientNote = matched
    ? `Le client « ${matched} » est déjà au répertoire.`
    : brief.clientRef
      ? ""
      : `La fiche « ${primaryClient} » n’est pas créée : décrivez-la, puis confirmez.`;
  return {
    project: { id: created.id, name, purpose, reference: brief.reference, created: true },
    summary: [`Projet « ${name} » ouvert.`, clientNote, "L’actualité du dossier commence par cette ouverture."]
      .filter(Boolean)
      .join(" "),
  };
}

async function saveQuote(
  quote: QuoteBrief,
  projects: SavedProject[],
  knownNames: string[],
): Promise<{ note: string; usdUntouched: boolean; marginMissing: boolean } | null> {
  const fingerprint = `brief:${quote.reference}`;
  const existing = await prisma.quote.findUnique({ where: { fingerprint } });
  const project = findProject(quote, projects);
  const clientName =
    matchDirectoryName(quote.clientName, knownNames) ||
    quote.clientName ||
    quote.clientRef;
  if (existing) {
    if (project && !existing.projectId) {
      await prisma.quote.update({ where: { id: existing.id }, data: { projectId: project.id } });
    }
    return {
      note: `Le devis ${quote.reference} est déjà enregistré.`,
      usdUntouched: false,
      marginMissing: false,
    };
  }
  const check = checkedQuote(quote);
  const mention = vatRule(quote.vatZone).mention;
  const created = await prisma.quote.create({
    data: {
      title: `Devis ${quote.reference}`,
      versionLabel: quote.reference,
      fingerprint,
      projectId: project?.id,
      clientName: clientName.slice(0, 160),
      currency: quote.currency,
      vatZone: quote.vatZone,
      vatMention: mention,
      statedTotalHt: quote.statedTotalHt.slice(0, 80),
      statedTotalHtCents: centsFromWritten(quote.statedTotalHt),
      statedVat: quote.statedVat.slice(0, 80),
      statedVatCents: centsFromWritten(quote.statedVat),
      statedTotalTtc: quote.statedTotalTtc.slice(0, 80),
      statedTotalTtcCents: centsFromWritten(quote.statedTotalTtc),
      conditions: quote.conditions.slice(0, 500),
    },
  });
  for (const line of quote.lines) {
    const productId = await ensureQuoteProduct(line);
    const discounted = quote.discountReferences.some((reference) => reference === line.reference);
    await prisma.quoteLine.create({
      data: {
        quoteId: created.id,
        productId,
        quantity: `${line.quantity} ${line.unit}`.trim().slice(0, 40),
        statedPrice: line.statedAmount.slice(0, 80),
        statedPriceCents: centsFromWritten(line.statedAmount),
        conditions: [
          discounted && quote.discountRate > 0 ? `Remise indiquée ${Math.round(quote.discountRate * 100)} %.` : "",
          quote.conditions,
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 500),
      },
    });
  }
  const verdict = check.matches
    ? "Le contrôle des lignes confirme les totaux indiqués."
    : "Les totaux indiqués sont conservés tels quels : ils diffèrent du détail des lignes.";
  const body = [
    `Devis ${quote.reference} enregistré en ${quote.currency}.`,
    quote.statedTotalHt ? `Total HT indiqué ${quote.statedTotalHt}.` : "",
    quote.statedVat ? `TVA indiquée ${quote.statedVat}.` : "",
    mention,
    verdict,
  ]
    .filter(Boolean)
    .join(" ");
  if (project) await addEvent(project.id, "devis", body);
  return {
    note: body,
    usdUntouched: quote.currency === "USD",
    marginMissing: true,
  };
}

function checkedQuote(quote: QuoteBrief): { matches: boolean } {
  const lines = quote.lines.map((line) => ({
    amountCents: centsFromStated(line.statedAmount) ?? Number.NaN,
    discountRate: quote.discountReferences.includes(line.reference) ? quote.discountRate : 0,
    costCents: null,
  }));
  if (lines.some((line) => !Number.isFinite(line.amountCents))) return { matches: false };
  const check = checkAffair({
    lines,
    zone: quote.vatZone as VatZone,
    currency: quote.currency as MoneyCurrency,
    eurPerUsd: null,
  });
  const statedHt = centsFromStated(quote.statedTotalHt);
  const statedVat = centsFromStated(quote.statedVat);
  const statedTtc = centsFromStated(quote.statedTotalTtc);
  return {
    matches:
      statedHt === check.netHtCents &&
      statedVat === check.vatCents &&
      statedTtc === check.ttcCents,
  };
}

async function ensureQuoteProduct(line: QuoteBrief["lines"][number]): Promise<string> {
  const existing = await prisma.product.findFirst({ where: { reference: line.reference } });
  if (existing) return existing.id;
  const name = line.name.slice(0, 120);
  const key = nameKey(name);
  const byName = await prisma.product.findUnique({ where: { nameKey: key } });
  if (byName) {
    if (!byName.reference) {
      await prisma.product.update({
        where: { id: byName.id },
        data: { reference: line.reference.slice(0, 60) },
      });
    }
    return byName.id;
  }
  const created = await prisma.product.create({
    data: {
      name,
      nameKey: key,
      reference: line.reference.slice(0, 60),
      unit: line.unit.slice(0, 20) || "u",
      source: "devis",
      kind: line.reference.startsWith("SRV") ? "service" : "produit",
    },
  });
  return created.id;
}

function findProject(quote: QuoteBrief, projects: SavedProject[]): SavedProject | null {
  const byRef = projects.find((project) => quote.projectRef && project.reference === quote.projectRef);
  if (byRef) return byRef;
  const byName = projects.find((project) => nameKey(project.name) === nameKey(quote.projectName));
  if (byName) return byName;
  return null;
}

async function attachPieces(attached: AttachedPiece[], projects: SavedProject[]): Promise<string[]> {
  const notes: string[] = [];
  for (const piece of attached) {
    const sheet = datasheetProduct(`${piece.originalName}\n${piece.text}`);
    const targets = projectsForPiece(projects, sheet !== null);
    if (sheet) {
      await saveDatasheetProduct(sheet);
    }
    if (targets.length === 0) {
      notes.push(
        sheet
          ? `Documentation technique ${sheet.reference} enregistrée, sans projet désigné dans le message.`
          : "",
      );
      continue;
    }
    for (const project of targets) {
      const body = sheet
        ? `Documentation technique « ${piece.originalName} » rattachée. ${sheet.name}, référence ${sheet.reference}${sheet.ordering ? `, commande ${sheet.ordering}` : ""}. Aucun prix n’est indiqué sur cette fiche.`
        : `Pièce « ${piece.originalName} » rattachée au projet.`;
      await addEvent(project.id, "piece", body, piece.id);
      notes.push(body);
    }
  }
  return notes.filter(Boolean);
}

function projectsForPiece(projects: SavedProject[], datasheet: boolean): SavedProject[] {
  if (projects.length === 1) return projects;
  if (!datasheet) return [];
  return projects.filter((project) => /kit|develop|carte/i.test(`${project.name} ${project.purpose}`));
}

async function saveDatasheetProduct(sheet: { reference: string; name: string }): Promise<void> {
  const existing = await prisma.product.findFirst({ where: { reference: sheet.reference } });
  if (existing) return;
  const key = nameKey(sheet.name);
  const byName = await prisma.product.findUnique({ where: { nameKey: key } });
  if (byName) return;
  await prisma.product.create({
    data: {
      name: sheet.name.slice(0, 120),
      nameKey: key,
      reference: sheet.reference.slice(0, 60),
      unit: "Unité",
      source: "fiche",
      kind: "produit",
      description: "Kit décrit par la fiche technique. Aucun prix n’est indiqué.",
    },
  });
}

async function addEvent(projectId: string, kind: string, body: string, fileId = ""): Promise<void> {
  await prisma.projectEvent.create({
    data: { projectId, kind, body: body.slice(0, 2000), fileId },
  });
}
