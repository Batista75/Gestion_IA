import { readPacket, type AnswerPacket } from "@/domain/answer-packet";
import { readUnderstanding, type UnderstandingCard } from "@/domain/completeness";
import { stampProvenance } from "@/domain/provenance";
import { uniqueNameMatch } from "@/domain/knowledge";
import { readStoredProposalCard, type ProposalCard } from "@/domain/proposal-scope";
import { prisma } from "@/lib/db";
import { THREAD_MESSAGE_LIMIT, type ThreadSummary } from "@/domain/thread";
import { proposedThreadTitle } from "@/domain/thread-title";

export type StoredTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: string;
  steps: string[];
  proposal: ProposalCard | null;
  sources: Array<{ label: string; title: string }>;
  understanding: UnderstandingCard | null;
  packet: AnswerPacket | null;
  modelVersion: string;
};

const ID_RE = /^[\w-]{8,80}$/;

export const SHOWN_MESSAGES = THREAD_MESSAGE_LIMIT;

const threadListSelect = {
  id: true,
  title: true,
  archivedAt: true,
  updatedAt: true,
  projectId: true,
  project: { select: { name: true } },
  _count: { select: { messages: true } },
  messages: {
    where: { role: "user" },
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: { content: true },
  },
};

function summarizeThread(row: {
  id: string;
  title: string;
  archivedAt: Date | null;
  updatedAt: Date;
  projectId: string | null;
  project: { name: string } | null;
  _count: { messages: number };
  messages: Array<{ content: string }>;
}): ThreadSummary {
  const title = row.title.trim() || "Fil sans titre";
  const suggested = row.messages[0] ? proposedThreadTitle(row.messages[0].content) : "";
  const when = row.archivedAt ?? row.updatedAt;
  return {
    id: row.id,
    title,
    suggested: suggested && suggested !== title ? suggested : "",
    updatedAt: when.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
    count: row._count.messages,
    projectId: row.projectId ?? "",
    projectName: row.project?.name ?? "",
  };
}

async function listedThreads(
  where: { projectId?: string; archivedAt: null } | { projectId?: string; archivedAt: { not: null } },
  orderBy: { updatedAt: "desc" } | { archivedAt: "desc" },
): Promise<ThreadSummary[]> {
  const rows = await prisma.conversation.findMany({
    where,
    orderBy,
    take: 20,
    select: threadListSelect,
  });
  return rows.map(summarizeThread);
}

export async function projectConversations(projectId: string): Promise<ThreadSummary[]> {
  return listedThreads({ projectId, archivedAt: null }, { updatedAt: "desc" });
}

export async function archivedProjectConversations(projectId: string): Promise<ThreadSummary[]> {
  return listedThreads({ projectId, archivedAt: { not: null } }, { archivedAt: "desc" });
}

export async function recentConversations(): Promise<ThreadSummary[]> {
  return listedThreads({ archivedAt: null }, { updatedAt: "desc" });
}

export async function archivedConversations(): Promise<ThreadSummary[]> {
  return listedThreads({ archivedAt: { not: null } }, { archivedAt: "desc" });
}

export function isConversationId(value: string): boolean {
  return ID_RE.test(value);
}

export function conversationIdOrNew(value: unknown): string {
  return typeof value === "string" && isConversationId(value) ? value : crypto.randomUUID();
}

export async function rememberTurn(input: {
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  steps?: string[];
  proposal?: ProposalCard | null;
  sources?: Array<{ label: string; title: string }>;
  understanding?: UnderstandingCard | null;
  packet?: AnswerPacket | null;
  linkText?: string;
  modelVersion?: string;
}): Promise<void> {
  const content = input.content.trim();
  if (!content && (input.steps?.length ?? 0) === 0) return;
  const title = input.role === "user" ? proposedThreadTitle(content) : "";
  const existing = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    select: { title: true },
  });
  if (!existing) {
    await prisma.conversation.create({
      data: { id: input.conversationId, title: input.role === "user" ? title : "" },
    });
  } else if (!existing.title && input.role === "user" && title) {
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { title },
    });
  } else {
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });
  }
  await prisma.conversationMessage.create({
    data: {
      conversationId: input.conversationId,
      role: input.role,
      content,
      source: input.source ?? "",
      steps: input.steps ?? [],
      proposal: storedProposal(input.proposal, input.understanding, input.packet),
      sources: input.sources ?? [],
      ...stampProvenance(messageVersion(input), input.proposal?.fields ?? []),
    },
  });
  if (input.linkText) await linkConversation(input.conversationId, input.linkText);
}

async function linkConversation(conversationId: string, text: string): Promise<void> {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    take: 500,
  });
  const name = uniqueNameMatch(text, projects.map((project) => project.name));
  if (!name) return;
  const project = projects.find((item) => item.name === name);
  if (!project) return;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { projectId: project.id },
  });
}

export type LoadedConversation = {
  id: string;
  projectId: string;
  projectName: string;
  messages: StoredTurn[];
  hidden: number;
};

export async function loadConversation(id: string): Promise<LoadedConversation | null> {
  if (!isConversationId(id)) return null;
  const row = await prisma.conversation.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: SHOWN_MESSAGES },
      _count: { select: { messages: true } },
    },
  });
  return row ? presentConversation(row) : null;
}

/** Ouvre un fil demandé par l’adresse. S’il était archivé, il reprend la liste ouverte. */
export async function openConversation(id: string): Promise<LoadedConversation | null> {
  const thread = await loadConversation(id);
  if (!thread) return null;
  const archived = await prisma.conversation.findUnique({
    where: { id },
    select: { archivedAt: true },
  });
  if (archived?.archivedAt) {
    await prisma.conversation.update({ where: { id }, data: { archivedAt: null } });
  }
  return thread;
}

export async function latestProjectConversation(projectId: string): Promise<LoadedConversation | null> {
  const row = await prisma.conversation.findFirst({
    where: { projectId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: SHOWN_MESSAGES },
      _count: { select: { messages: true } },
    },
  });
  return row ? presentConversation(row) : null;
}

export async function latestConversation(): Promise<LoadedConversation | null> {
  const row = await prisma.conversation.findFirst({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: SHOWN_MESSAGES },
      _count: { select: { messages: true } },
    },
  });
  if (!row) return null;
  return presentConversation(row);
}

function presentConversation(row: {
  id: string;
  projectId: string | null;
  project: { name: string } | null;
  _count: { messages: number };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    source: string;
    steps: unknown;
    proposal: unknown;
    sources: unknown;
    modelVersion: string;
  }>;
}): LoadedConversation {
  const latest = [...row.messages].reverse();
  return {
    id: row.id,
    projectId: row.projectId ?? "",
    projectName: row.project?.name ?? "",
    hidden: Math.max(0, row._count.messages - latest.length),
    messages: latest.map((message) => ({
      id: message.id,
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
      source: message.source,
      steps: stringList(message.steps),
      proposal: proposalOf(message.proposal),
      sources: sourceList(message.sources),
      understanding: readUnderstanding(message.proposal),
      packet: readPacket(message.proposal),
      modelVersion: message.modelVersion,
    })),
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function messageVersion(input: { role: string; source?: string; modelVersion?: string }): string {
  if (input.modelVersion?.trim()) return input.modelVersion.trim();
  if (input.role === "user") return "saisie";
  if (input.source === "ollama") return "ollama";
  return "regle";
}

function storedProposal(
  proposal: ProposalCard | null | undefined,
  understanding: UnderstandingCard | null | undefined,
  packet: AnswerPacket | null | undefined,
): {
  id?: string;
  type?: ProposalCard["type"];
  fields?: Array<{ label: string; value: string }>;
  confirmable?: boolean;
  understanding?: UnderstandingCard;
  packet?: AnswerPacket;
} | undefined {
  if (!proposal && !understanding && !packet) return undefined;
  const card = proposal ? readStoredProposalCard(proposal) : null;
  return {
    ...(card
      ? {
          ...(card.id && card.type ? { id: card.id, type: card.type } : {}),
          fields: card.fields,
          ...(card.confirmable === false ? { confirmable: false } : {}),
        }
      : {}),
    ...(understanding ? { understanding } : {}),
    ...(packet ? { packet } : {}),
  };
}

function proposalOf(value: unknown): StoredTurn["proposal"] {
  return readStoredProposalCard(value);
}

function sourceList(value: unknown): Array<{ label: string; title: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { label?: unknown; title?: unknown };
    return typeof row.label === "string" && typeof row.title === "string"
      ? [{ label: row.label, title: row.title }]
      : [];
  });
}
