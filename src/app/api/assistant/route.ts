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
import { absentReply, decideFree, intentCatalog, type IntentDecision } from "@/domain/intent-catalog";
import { attachConversationProject, resolveContext } from "@/lib/context-envelope";
import { asksHybridQuote } from "@/domain/hybrid-quote";
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
  const snapshot = await resolveContext(
    readHint(payload && typeof payload === "object" && "context" in payload ? payload.context : null),
  );
  await attachConversationProject(conversationId, snapshot.projectId);

  const correction = readCardCorrection(parsed.text);
  const baseText = correction ? await earlierUserText(conversationId) : parsed.text;
  if (correction && !baseText) {
    return streamDirect({
      conversationId,
      reply: "Aucune demande à corriger. Écrivez d’abord ce qu’il faut faire.",
      source: "regle-metier",
      step: "Fiche",
    });
  }

  if (!correction) {
    const direct = await answerDirectly(parsed.text);
    if (direct) {
      return streamDirect({
        conversationId,
        reply: direct.reply,
        source: direct.source,
        step: stepFor(direct.source),
        proposal: direct.proposal,
        sources: direct.sources,
      });
    }
  }

  const free = decideFree(baseText);
  if (correction && free.execution !== "absente") {
    return streamDirect({
      conversationId,
      reply: "Cette demande n’a pas de fiche à corriger.",
      source: "regle-metier",
      step: "Fiche",
    });
  }
  if (free.execution === "absente" && free.id) {
    const blocked = await blockedTurn(baseText, free, snapshot, correction);
    return streamDirect({
      conversationId,
      reply: blockedReply(free, blocked, snapshot),
      source: "regle-metier",
      step: blocked.card ? "Fiche" : "Catalogue",
      understanding: blocked.card,
    });
  }

  const interpreted = plainQuestion(baseText) ?? (await modelInterpretation(baseText, snapshot));
  if (interpreted && interpreterEffect(interpreted) === "ecrire") {
    const blocked = await blockedTurn(
      baseText,
      { id: interpreted.intent, execution: "absente", missing: [] },
      snapshot,
      correction,
    );
    return streamDirect({
      conversationId,
      reply: blockedReply(
        { id: interpreted.intent, execution: "absente", missing: [] },
        blocked,
        snapshot,
        interpretationLine(interpreted),
      ),
      source: "regle-metier",
      step: "Interprétation",
      understanding: blocked.card,
    });
  }
  if (free.execution === "absente") {
    return streamDirect({
      conversationId,
      reply: `${absentReply(free)}\n${contextLine(snapshot)}`,
      source: "regle-metier",
      step: "Catalogue",
    });
  }

  const status = await getOllamaStatus();
  if (!status.ok || !status.defaultModel) {
    return streamDirect({
      conversationId,
      reply: `${status.error ?? "Ollama est indisponible."} Une recherche dans les fiches, par exemple « que sait-on de Marie Dupont », fonctionne sans le modèle.`,
      source: "dossier",
      step: "Serveur injoignable",
    });
  }
  const model = parsed.model ?? status.defaultModel;
  if (!status.models.includes(model) || isEmbedOnlyModel(model) || isRerankModel(model)) {
    return streamDirect({
      conversationId,
      reply: "Ce modèle ne sert pas à la conversation. Choisissez-le dans Configuration.",
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

function blockedReply(
  decision: IntentDecision,
  blocked: { question: string | null; card: { action: string } | null },
  snapshot: ContextSnapshot,
  preface = "",
): string {
  const body = blocked.question
    ? `${blocked.question}\nRien n’est écrit.`
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
  return { question: card.confirm ? `${row.label}. ${card.confirm}` : null, card };
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
