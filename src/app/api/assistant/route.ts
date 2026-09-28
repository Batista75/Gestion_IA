import { isEmbedOnlyModel, isRerankModel } from "@/domain/agent";
import { parseCatalogCommand, type CatalogCommand } from "@/domain/catalog";
import {
  asksToEnrichRecord,
  identifyClient,
  isNewClientBrief,
  proposalFields,
  readConfirmation,
  reviseDraft,
} from "@/domain/client-file";
import { bareNameQuestion, renderKnowledge, sourceLabel, understandIntent } from "@/domain/knowledge";
import {
  asksModelToComputeMoney,
  MONEY_RULE_REPLY,
} from "@/domain/ollama-endpoint";
import { parseBusinessBrief, planIsEmpty } from "@/domain/business-brief";
import { applyBusinessPlan } from "@/lib/business-records";
import { withChangeSource } from "@/lib/change-source";
import { confirmLatestWrite, openCatalogProposal, rejectLatestWrite } from "@/lib/catalog-proposals";
import {
  currentProposal,
  openClientProposal,
  proposeChangeFromMessage,
  proposeFromParty,
  type ProposalView,
} from "@/lib/client-proposals";
import { streamDirect, streamModel } from "@/lib/assistant-stream";
import { conversationIdOrNew, rememberTurn } from "@/lib/conversations";
import type { UIMessage } from "ai";
import { withGpuLane } from "@/lib/gpu-lane";
import { mentionedNames } from "@/domain/knowledge";
import {
  readCardCorrection,
  understandingCard,
  type FieldOverrides,
  type UnderstandingCard,
} from "@/domain/completeness";
import { contextBrief, contextLine, readHint, type ContextSnapshot } from "@/domain/context-envelope";
import {
  interpretationLine,
  interpreterEffect,
  plainQuestion,
  type Interpretation,
} from "@/domain/interpreter";
import { readModelInterpretation } from "@/lib/interpreter";
import { simulateWrite } from "@/domain/simulation";
import { absentReply, decideFree, intentCatalog, type IntentDecision, type IntentId } from "@/domain/intent-catalog";
import {
  nextOverrides,
  pathLine,
  resumeKind,
  taskSteps,
  type StoredTask,
} from "@/domain/task-path";
import { loadTask, saveTask } from "@/lib/task-path";
import {
  documentKey,
  documentLabel,
  memoryNotice,
  type DocumentMemory,
} from "@/domain/document-memory";
import { loadDocumentMemory, saveDocumentMemory } from "@/lib/document-memory";
import { factsForNames } from "@/lib/document-facts";
import { attachConversationProject, resolveContext } from "@/lib/context-envelope";
import { asksHybridQuote } from "@/domain/hybrid-quote";
import type { AnswerPacket } from "@/domain/answer-packet";
import { resolveMeasure } from "@/lib/measure-reply";
import { resolveContract } from "@/lib/contract-reply";
import { resolveIntervention } from "@/lib/intervention-reply";
import { resolveEquipment } from "@/lib/equipment-reply";
import { resolvePurchase } from "@/lib/purchase-reply";
import { resolveClaim } from "@/lib/claim-reply";
import { prepareHybridQuote } from "@/lib/hybrid-quote";
import { asksTradeWorkflow, projectTradeReply, tradeRuleReply } from "@/domain/trade-workflow";
import { searchKnowledge } from "@/lib/knowledge-store";
import { listProjectSteps } from "@/lib/trade-steps";
import { getOllamaStatus } from "@/lib/ollama";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 40;
const MAX_CHARS = 12_000;

type SourceRef = { label: string; title: string };
type DirectReply = {
  reply: string;
  model: null;
  source: "ollama" | "regle-metier" | "action" | "proposition" | "dossier";
  proposal?: ProposalView["proposal"];
  sources?: SourceRef[];
  packet?: AnswerPacket;
};

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Message illisible." }, { status: 400 });
  }

  const parsed = parsePayload(payload);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const conversationId = conversationIdOrNew(
    payload && typeof payload === "object" && "id" in payload ? payload.id : "",
  );
  await rememberTurn({
    conversationId,
    role: "user",
    content: parsed.text,
    linkText: parsed.text,
  });
  const hint = readHint(payload && typeof payload === "object" && "context" in payload ? payload.context : null);
  let snapshot = await resolveContext(hint);
  await attachConversationProject(conversationId, snapshot.projectId);

  const correction = readCardCorrection(parsed.text);
  const baseText = correction ? await earlierUserText(conversationId) : parsed.text;
  if (correction && !baseText) {
    return streamDirect({
      conversationId,
      reply: prefixFacts("Aucune demande à corriger. Écrivez d’abord ce qu’il faut faire.", await pieceFacts(snapshot)),
      source: "regle-metier",
      step: "Fiche",
    });
  }

  const stored = await loadTask(conversationId);
  if (!correction && stored?.status === "suspendue" && intentCatalog.some((item) => item.id === stored.intent)) {
    const kind = resumeKind(parsed.text);
    const moved = kind ? nextOverrides(stored.overrides, stored.valeurs, stored.field, kind, parsed.text, stored.proposed) : null;
    const accept = Boolean(moved?.kept);
    const refuse = kind === "non" && Boolean(stored.proposed);
    if (moved && (accept || refuse)) {
      snapshot = await resumeSnapshot(snapshot, stored);
      const kept = accept ? moved : null;
      return publishBlocked({
        conversationId,
        request: stored.request,
        decision: { id: stored.intent as IntentId, execution: "absente", missing: [] },
        snapshot,
        view: hint.view.startsWith("/projets/") ? hint.view : stored.view,
        overrides: fieldOverrides(kept ? kept.overrides : stored.overrides, kept ? kept.valeurs : stored.valeurs),
        preface: kept
          ? `Parcours repris. La réponse « ${kept.accepted} » continue la même demande.`
          : "Ce point n’est pas retenu.",
        prior: stored,
        learned: kept ? learnedField(stored.field, kept.accepted) : null,
      });
    }
  }

  if (!correction) {
    const direct = await answerDirectly(parsed.text);
    if (direct) {
      return streamDirect({
        conversationId,
        reply: direct.packet ? direct.reply : prefixFacts(direct.reply, await pieceFacts(snapshot)),
        source: direct.source,
        step: stepFor(direct.source),
        proposal: direct.proposal,
        sources: direct.sources,
        packet: direct.packet,
      });
    }
  }

  const free = decideFree(baseText);
  if (correction && free.execution !== "absente") {
    return streamDirect({
      conversationId,
      reply: prefixFacts("Cette demande n’a pas de fiche à corriger.", await pieceFacts(snapshot)),
      source: "regle-metier",
      step: "Fiche",
    });
  }
  if (free.execution === "absente" && free.id) {
    const label = documentLabel(snapshot);
    const samePiece =
      Boolean(correction) ||
      !label ||
      Boolean(stored?.attachments.some((name) => documentKey(name) === documentKey(label)));
    const carried = samePiece ? stored : null;
    const memory = label ? await loadDocumentMemory(label) : null;
    const learned = learnedFromCorrection(correction);
    return publishBlocked({
      conversationId,
      request: baseText,
      decision: free,
      snapshot,
      view: hint.view,
      overrides: withMemory(
        fieldOverrides(
          {
            projet: correction?.projet || carried?.overrides.projet || "",
            type: correction?.type || carried?.overrides.type || "",
            societe: correction?.société || carried?.overrides.societe || "",
          },
          { ...(carried?.valeurs ?? {}), ...(correction?.valeurs ?? {}) },
        ),
        memory,
      ),
      preface: [
        learned ? "" : memory ? memoryNotice(memory) : "",
        correction && stored?.status === "suspendue" ? "Parcours repris. La fiche continue la même demande." : "",
      ]
        .filter(Boolean)
        .join("\n"),
      prior: stored,
      learned,
    });
  }

  const interpreted = plainQuestion(baseText) ?? (await modelInterpretation(baseText, snapshot));
  if (interpreted && interpreterEffect(interpreted) === "ecrire") {
    return publishBlocked({
      conversationId,
      request: baseText,
      decision: { id: interpreted.intent, execution: "absente", missing: [] },
      snapshot,
      view: hint.view,
      overrides: correction,
      preface: interpretationLine(interpreted),
      prior: null,
      learned: null,
    });
  }
  if (free.execution === "absente") {
    return streamDirect({
      conversationId,
      reply: prefixFacts(`${absentReply(free)}\n${contextLine(snapshot)}`, await pieceFacts(snapshot)),
      source: "regle-metier",
      step: "Catalogue",
    });
  }

  const status = await getOllamaStatus();
  if (!status.ok || !status.defaultModel) {
    return streamDirect({
      conversationId,
      reply: prefixFacts(
        `${status.error ?? "Ollama est indisponible."} Une recherche dans les fiches, par exemple « que sait-on de Marie Dupont », fonctionne sans le modèle.`,
        await pieceFacts(snapshot),
      ),
      source: "dossier",
      step: "Serveur injoignable",
    });
  }
  const model = parsed.model ?? status.defaultModel;
  if (!status.models.includes(model) || isEmbedOnlyModel(model) || isRerankModel(model)) {
    return streamDirect({
      conversationId,
      reply: prefixFacts(
        "Ce modèle ne sert pas à la conversation. Choisissez-le dans Configuration.",
        await pieceFacts(snapshot),
      ),
      source: "dossier",
      step: "Modèle inadapté",
    });
  }

  return streamModel({
    conversationId,
    text: parsed.text,
    messages: parsed.uiMessages,
    model,
    context: interpreted
      ? `${contextBrief(snapshot)} ${interpretationLine(interpreted)}`
      : contextBrief(snapshot),
  });
}

function stepFor(source: DirectReply["source"]): string {
  if (source === "dossier") return "Lecture des fiches";
  if (source === "regle-metier") return "Règle métier";
  if (source === "proposition") return "Proposition à confirmer";
  if (source === "action") return "Enregistrement";
  return "Réponse";
}

async function answerDirectly(text: string): Promise<DirectReply | null> {
  const plan = parseBusinessBrief(text);
  if (!planIsEmpty(plan)) {
    const saved = await withChangeSource("assistant", () => applyBusinessPlan(plan));
    return { reply: saved.summary, model: null, source: "action" as const };
  }

  const measured = await resolveMeasure(text);
  if (measured) {
    return { reply: measured.reply, model: null, source: "regle-metier" as const, packet: measured.packet };
  }

  const contract = await resolveContract(text);
  if (contract) {
    return {
      reply: contract.reply,
      model: null,
      source: contract.source,
      packet: contract.packet,
      proposal: contract.proposal,
    };
  }

  const intervention = await resolveIntervention(text);
  if (intervention) {
    return {
      reply: intervention.reply,
      model: null,
      source: intervention.source,
      packet: intervention.packet,
      proposal: intervention.proposal,
    };
  }

  const equipment = await resolveEquipment(text);
  if (equipment) {
    return {
      reply: equipment.reply,
      model: null,
      source: equipment.source,
      packet: equipment.packet,
      proposal: equipment.proposal,
    };
  }

  const purchase = await resolvePurchase(text);
  if (purchase) {
    return {
      reply: purchase.reply,
      model: null,
      source: purchase.source,
      packet: purchase.packet,
      proposal: purchase.proposal,
    };
  }

  const claim = await resolveClaim(text);
  if (claim) {
    return {
      reply: claim.reply,
      model: null,
      source: claim.source,
      packet: claim.packet,
      proposal: claim.proposal,
    };
  }

  const brief = isNewClientBrief(text) || Boolean(identifyClient(text));
  if (asksModelToComputeMoney(text) && !brief) {
    return { reply: MONEY_RULE_REPLY, model: null, source: "regle-metier" as const };
  }

  const verdict = readConfirmation(text);
  const pending = await currentProposal();
  if (verdict === "confirm") {
    const saved = await confirmLatestWrite();
    return {
      reply: saved.summary,
      model: null,
      source: saved.ok ? ("action" as const) : ("proposition" as const),
    };
  }
  if (verdict === "reject") {
    const rejected = await rejectLatestWrite();
    return {
      reply: rejected?.reply ?? "Il n’y a pas de fiche en attente.",
      model: null,
      source: "proposition" as const,
      proposal: rejected?.proposal,
    };
  }

  if (asksHybridQuote(text) && !parseCatalogCommand(text)) {
    const prepared = await prepareHybridQuote(text);
    return {
      reply: prepared.reply,
      model: null,
      source: prepared.wrote ? ("action" as const) : ("dossier" as const),
      sources: prepared.sources,
      packet: prepared.packet,
    };
  }

  const command = parseCatalogCommand(text);
  const clientCommand =
    command && (command.type === "create_client" || command.type === "update_client")
      ? command
      : null;
  if (asksTradeWorkflow(text)) {
    const trade = await answerTrade(text);
    if (trade) return trade;
  }

  const intent = understandIntent(text);
  if (intent === "lookup" || intent === "directory") {
    return withGpuLane(() => answerFromDossier(text, intent));
  }

  if (asksToEnrichRecord(text) || intent === "change") {
    const changed = await proposeChangeFromMessage(text);
    if (changed) {
      return {
        reply: changed.reply,
        model: null,
        source: changed.proposal ? ("proposition" as const) : ("dossier" as const),
        proposal: changed.proposal,
        sources: changed.sources,
      };
    }
  }

  if (clientCommand) {
    const identified = identifyClient(text);
    if (identified) return proposalResponse(await openClientProposal(identified));
    return proposalFromCommand(clientCommand);
  }
  if (!pending || isNewClientBrief(text)) {
    const identified = identifyClient(text);
    if (identified) return proposalResponse(await openClientProposal(identified));
  }
  if (command) {
    const opened = await openCatalogProposal(command);
    if ("clarify" in opened) {
      return { reply: opened.clarify, model: null, source: "dossier" as const };
    }
    return proposalResponse(opened);
  }

  const names = await directoryNames();
  const question = bareNameQuestion(text, names);
  if (question) {
    return { reply: question, model: null, source: "dossier" as const };
  }

  if (pending && !isNewClientBrief(text)) {
    const revised = reviseDraft(pending, text);
    if (!revised.changed) {
      return {
        reply:
          "Je n’ai pas identifié de champ à corriger. Précisez-le, par exemple « le téléphone est le 06 98 76 54 32 ».",
        model: null,
        source: "proposition" as const,
        proposal: { fields: proposalFields(pending) },
      };
    }
    return proposalResponse(await openClientProposal(revised.draft));
  }

  return null;
}

async function proposalFromCommand(
  command: Extract<CatalogCommand, { type: "create_client" | "update_client" }>,
) {
  const opened = await proposeFromParty(command);
  if ("clarify" in opened) {
    return { reply: opened.clarify, model: null, source: "dossier" as const };
  }
  return proposalResponse(opened);
}

async function answerTrade(text: string): Promise<DirectReply | null> {
  const projects = await prisma.project.findMany({ select: { id: true, name: true }, take: 500 });
  const names = mentionedNames(text, projects.map((project) => project.name));
  if (names.length > 1) {
    return {
      reply: `Plusieurs dossiers correspondent : ${names.join(", ")}. Précisez le nom complet.`,
      model: null,
      source: "dossier",
    };
  }
  if (names.length === 1) {
    const project = projects.find((item) => item.name === names[0]);
    if (!project) return null;
    const steps = await listProjectSteps(project.id);
    return {
      reply: projectTradeReply(project.name, steps),
      model: null,
      source: "dossier",
      sources: [{ label: "Projet", title: project.name }],
    };
  }
  return { reply: tradeRuleReply(text), model: null, source: "dossier" };
}

async function answerFromDossier(text: string, intent: "lookup" | "directory") {
  const docs = await searchKnowledge(text, intent);
  return {
    reply: renderKnowledge(docs, intent),
    model: null,
    source: "dossier" as const,
    sources: docs.map((doc) => ({ label: sourceLabel(doc.sourceType), title: doc.title })),
  };
}

function proposalResponse(opened: ProposalView) {
  return {
    reply: opened.reply,
    model: null,
    source: "proposition" as const,
    proposal: opened.proposal,
  };
}

function fieldOverrides(
  overrides: { projet: string; type: string; societe: string },
  valeurs: Record<string, string>,
): FieldOverrides {
  const next = { ...valeurs };
  if (overrides.projet) next.projet = overrides.projet;
  if (overrides.type) next.type = overrides.type;
  if (overrides.societe) next["société"] = overrides.societe;
  return { projet: overrides.projet, type: overrides.type, société: overrides.societe, valeurs: next };
}

async function resumeSnapshot(snapshot: ContextSnapshot, task: StoredTask): Promise<ContextSnapshot> {
  let next = snapshot;
  if (!next.projectId && task.view.startsWith("/projets/")) {
    const saved = await resolveContext({ view: task.view, attachments: task.attachments });
    if (saved.projectId) next = saved;
  }
  if (next.attachments.length === 0 && task.attachments.length > 0) {
    next = { ...next, attachments: task.attachments };
  }
  return next;
}

function learnedField(field: string, value: string): { projet: string; type: string; societe: string } | null {
  const kept = value.trim();
  if (!kept) return null;
  if (field === "projet") return { projet: kept, type: "", societe: "" };
  if (field === "type") return { projet: "", type: kept, societe: "" };
  if (field === "société") return { projet: "", type: "", societe: kept };
  return null;
}

function learnedFromCorrection(
  correction: FieldOverrides | null,
): { projet: string; type: string; societe: string } | null {
  if (!correction) return null;
  const projet = correction.projet.trim();
  const type = correction.type.trim();
  const societe = correction.société.trim();
  if (!projet && !type && !societe) return null;
  return { projet, type, societe };
}

function withMemory(base: FieldOverrides, memory: DocumentMemory | null): FieldOverrides {
  if (!memory) return base;
  return fieldOverrides(
    {
      projet: base.projet || memory.projet,
      type: base.type || memory.type,
      societe: base.société || memory.societe,
    },
    base.valeurs ?? {},
  );
}

async function publishBlocked(input: {
  conversationId: string;
  request: string;
  decision: IntentDecision;
  snapshot: ContextSnapshot;
  view: string;
  overrides: FieldOverrides | null;
  preface: string;
  prior: StoredTask | null;
  learned?: { projet: string; type: string; societe: string } | null;
}): Promise<Response> {
  const learned = input.learned ?? null;
  const label = documentLabel(input.snapshot);
  let preface = input.preface;
  if (learned && (learned.projet || learned.type || learned.societe)) {
    if (label) {
      const saved = await saveDocumentMemory(label, learned);
      if (saved && !preface.includes("ne devient pas une règle")) {
        preface = [preface, memoryNotice(saved)].filter(Boolean).join("\n");
      }
    } else if (!preface.includes("Aucune pièce")) {
      preface = [preface, "Aucune pièce n’est nommée : la correction reste sur cette demande."].filter(Boolean).join("\n");
    }
  }
  const blocked = await blockedTurn(input.request, input.decision, input.snapshot, input.overrides);
  const ready = blocked.card?.confirm === "";
  const steps = taskSteps({ ready, simulated: Boolean(blocked.card?.simulation) });
  const path = blocked.card ? pathLine(steps) : "";
  const card = blocked.card ? { ...blocked.card, path } : null;
  if (input.decision.id && card) {
    const overrides = input.overrides ?? { projet: "", type: "", société: "" };
    await saveTask(input.conversationId, {
      intent: input.decision.id,
      action: card.action,
      request: input.request,
      field: card.field,
      question: card.confirm,
      proposed: card.proposed,
      status: ready ? "prete" : "suspendue",
      steps,
      overrides: {
        projet: overrides.projet,
        type: overrides.type,
        societe: overrides.société,
      },
      valeurs: overrides.valeurs ?? {},
      attachments: input.snapshot.attachments.length ? input.snapshot.attachments : (input.prior?.attachments ?? []),
      view: input.view.startsWith("/projets/") ? input.view : input.prior?.view || input.view || "/",
    });
  }
  return streamDirect({
    conversationId: input.conversationId,
    reply: prefixFacts(
      blockedReply(input.decision, { question: blocked.question, card }, input.snapshot, [preface, path].filter(Boolean).join("\n")),
      await pieceFacts(input.snapshot),
    ),
    source: "regle-metier",
    step: card ? "Parcours" : "Catalogue",
    understanding: card,
  });
}

function blockedReply(
  decision: IntentDecision,
  blocked: { question: string | null; card: UnderstandingCard | null },
  snapshot: ContextSnapshot,
  preface = "",
): string {
  const simulation = blocked.card?.simulation ?? "";
  const body = blocked.question
    ? `${blocked.question}\nRien n’est écrit.`
    : simulation
      ? simulation
      : blocked.card
        ? `${blocked.card.action}. Les champs de la fiche sont remplis. Cette action n’est pas encore exécutée.\nRien n’est écrit.`
        : absentReply(decision);
  return `${preface ? `${preface}\n` : ""}${body}\n${contextLine(snapshot)}`;
}

async function modelInterpretation(text: string, snapshot: ContextSnapshot): Promise<Interpretation | null> {
  const status = await getOllamaStatus();
  if (!status.ok || !status.defaultModel) return null;
  return readModelInterpretation({
    model: status.defaultModel,
    text,
    context: contextBrief(snapshot),
  });
}

async function earlierUserText(conversationId: string): Promise<string> {
  const rows = await prisma.conversationMessage.findMany({
    where: { conversationId, role: "user" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { content: true },
  });
  for (const row of rows) {
    if (!readCardCorrection(row.content)) return row.content;
  }
  return "";
}

async function blockedTurn(
  text: string,
  decision: IntentDecision,
  snapshot: ContextSnapshot,
  correction: FieldOverrides | null,
): Promise<{ question: string | null; card: UnderstandingCard | null }> {
  const row = intentCatalog.find((item) => item.id === decision.id);
  if (!row) return { question: null, card: null };
  const [projects, suppliers] = await Promise.all([
    prisma.project.findMany({ select: { name: true }, take: 200 }),
    prisma.supplier.findMany({ select: { name: true }, take: 200 }),
  ]);
  const names = projects.map((project) => project.name);
  const card = understandingCard({
    action: row.label,
    required: row.required,
    text,
    projectName: snapshot.projectName,
    projectClient: snapshot.projectClient,
    attachments: snapshot.attachments,
    selectedLabel: snapshot.selectedLabel,
    selectedKind: snapshot.selectedKind,
    projectChoices: mentionedNames(text, names),
    projectOptions: names,
    supplierOptions: suppliers.map((supplier) => supplier.name),
    overrides: correction ?? undefined,
  });
  const ready = card.confirm === "";
  const simulation = simulateWrite({
    action: row.label,
    risk: row.risk,
    ready,
    document: snapshot.selectedKind === "document" ? snapshot.selectedLabel : (snapshot.attachments[0] ?? ""),
    documentType: card.documentType,
    project: card.project,
    supplier: card.supplier,
    client: card.understood.some((line) => line.startsWith("Le client facturé")) ? snapshot.projectClient : "",
  });
  return { question: ready ? null : `${row.label}. ${card.confirm}`, card: { ...card, simulation } };
}

async function pieceFacts(snapshot: ContextSnapshot): Promise<string> {
  const names = [
    ...snapshot.attachments,
    snapshot.selectedKind === "document" ? snapshot.selectedLabel : "",
  ];
  if (!names.some((name) => name.trim())) return "";
  return factsForNames(names, await directoryNames());
}

function prefixFacts(reply: string, facts: string): string {
  if (!facts.trim()) return reply;
  if (reply.includes("lus sans la phrase") || reply.includes("Aucun fait n’est tiré de la phrase")) return reply;
  return `${facts}\n${reply}`;
}

async function directoryNames(): Promise<string[]> {
  const [clients, suppliers, products, projects] = await Promise.all([
    prisma.client.findMany({ select: { name: true }, take: 500 }),
    prisma.supplier.findMany({ select: { name: true }, take: 500 }),
    prisma.product.findMany({ select: { name: true }, take: 500 }),
    prisma.project.findMany({ select: { name: true }, take: 500 }),
  ]);
  return [...clients, ...suppliers, ...products, ...projects].map((row) => row.name);
}

function parsePayload(
  payload: unknown,
):
  | { ok: true; text: string; uiMessages: UIMessage[]; model: string | null }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Message illisible." };
  }

  const body = payload as { messages?: unknown; model?: unknown };
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: "Écrivez un message avant d’envoyer." };
  }
  if (body.messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      error: "La conversation est trop longue. Ouvrez un nouveau fil.",
    };
  }

  const messages: UIMessage[] = [];
  for (const item of body.messages) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Message illisible." };
    }
    const message = item as { id?: unknown; role?: unknown; content?: unknown; parts?: unknown };
    if (message.role !== "user" && message.role !== "assistant") {
      return { ok: false, error: "Message illisible." };
    }
    const content = messageText(message);
    if (!content) {
      return { ok: false, error: "Le message est vide." };
    }
    if (content.length > MAX_CHARS) {
      return { ok: false, error: "Le message dépasse 12 000 caractères." };
    }
    messages.push({
      id: typeof message.id === "string" && message.id.trim() ? message.id : crypto.randomUUID(),
      role: message.role,
      parts: [{ type: "text", text: content }],
    });
  }

  const text = messageText(messages.at(-1) ?? {});
  if (messages.at(-1)?.role !== "user" || !text) {
    return { ok: false, error: "Le dernier message doit venir de vous." };
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : null;
  if (model && !/^[\w./:-]{1,120}$/.test(model)) {
    return { ok: false, error: "Nom de modèle invalide." };
  }

  return { ok: true, text, uiMessages: messages, model };
}

function messageText(message: { content?: unknown; parts?: unknown }): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const row = part as { type?: unknown; text?: unknown };
      return row.type === "text" && typeof row.text === "string" ? [row.text] : [];
    })
    .join("\n")
    .trim();
}
