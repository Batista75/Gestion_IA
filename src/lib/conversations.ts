import { readUnderstanding, type UnderstandingCard } from "@/domain/completeness";
import { uniqueNameMatch } from "@/domain/knowledge";
import { prisma } from "@/lib/db";

export type StoredTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: string;
  steps: string[];
  proposal: { fields: Array<{ label: string; value: string }> } | null;
  sources: Array<{ label: string; title: string }>;
  understanding: UnderstandingCard | null;
};

const ID_RE = /^[\w-]{8,80}$/;

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
  proposal?: { fields: Array<{ label: string; value: string }> } | null;
  sources?: Array<{ label: string; title: string }>;
  understanding?: UnderstandingCard | null;
  linkText?: string;
}): Promise<void> {
  const content = input.content.trim();
  if (!content && (input.steps?.length ?? 0) === 0) return;
  const title = content.slice(0, 80);
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
      proposal: storedProposal(input.proposal, input.understanding),
      sources: input.sources ?? [],
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

export async function loadConversation(id: string): Promise<{
  id: string;
  projectName: string;
  messages: StoredTurn[];
} | null> {
  if (!isConversationId(id)) return null;
  const row = await prisma.conversation.findUnique({
    where: { id },
    include: {
      project: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 40 },
    },
  });
  return row ? presentConversation(row) : null;
}

export async function latestProjectConversation(projectId: string): Promise<{
  id: string;
  projectName: string;
  messages: StoredTurn[];
} | null> {
  const row = await prisma.conversation.findFirst({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 40 },
    },
  });
  return row ? presentConversation(row) : null;
}

export async function latestConversation(): Promise<{
  id: string;
  projectName: string;
  messages: StoredTurn[];
} | null> {
  const row = await prisma.conversation.findFirst({
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 40 },
    },
  });
  if (!row) return null;
  return presentConversation(row);
}

function presentConversation(row: {
  id: string;
  project: { name: string } | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    source: string;
    steps: unknown;
    proposal: unknown;
    sources: unknown;
  }>;
}): { id: string; projectName: string; messages: StoredTurn[] } {
  return {
    id: row.id,
    projectName: row.project?.name ?? "",
    messages: row.messages.map((message) => ({
      id: message.id,
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
      source: message.source,
      steps: stringList(message.steps),
      proposal: proposalOf(message.proposal),
      sources: sourceList(message.sources),
      understanding: readUnderstanding(message.proposal),
    })),
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function storedProposal(
  proposal: { fields: Array<{ label: string; value: string }> } | null | undefined,
  understanding: UnderstandingCard | null | undefined,
): { fields?: Array<{ label: string; value: string }>; understanding?: UnderstandingCard } | undefined {
  if (!proposal && !understanding) return undefined;
  return {
    ...(proposal ? { fields: proposal.fields } : {}),
    ...(understanding ? { understanding } : {}),
  };
}

function proposalOf(value: unknown): StoredTurn["proposal"] {
  if (!value || typeof value !== "object" || !("fields" in value)) return null;
  const fields = (value as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return null;
  const rows = fields.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { label?: unknown; value?: unknown };
    return typeof row.label === "string" && typeof row.value === "string"
      ? [{ label: row.label, value: row.value }]
      : [];
  });
  return rows.length > 0 ? { fields: rows } : null;
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
