import {
  inboxStatusFromProposals,
  inboxStatusWrite,
  readInboxItemId,
  resumeInboxStatus,
  type InboxProposal,
} from "@/domain/inbox-entry";
import { prisma } from "@/lib/db";

export async function refreshInboxStatus(inboxItemId: string | null | undefined): Promise<void> {
  if (!inboxItemId) return;
  const item = await prisma.inboxItem.findUnique({
    where: { id: inboxItemId },
    select: {
      status: true,
      businessPlanProposals: { select: { status: true } },
      documentProposals: { select: { status: true } },
    },
  });
  if (!item) return;
  const next = inboxStatusFromProposals(item.status, linkedProposals(item));
  const write = inboxStatusWrite(item.status, item.status, next);
  if (!write) return;
  await prisma.inboxItem.updateMany({
    where: { id: inboxItemId, status: item.status },
    data: { status: write },
  });
}

export async function claimInboxItem(
  inboxItemId: string,
  conversationId: string,
): Promise<{ accepted: true; inboxItemId: string; documentCount: number } | { accepted: false }> {
  const id = readInboxItemId(inboxItemId);
  const current = conversationId.trim();
  if (!id || !current) return { accepted: false };
  const claimed = await prisma.inboxItem.updateMany({
    where: { id, conversationId: null },
    data: { conversationId: current },
  });
  if (claimed.count === 1) {
    const documents = await prisma.documentProposal.count({ where: { inboxItemId: id } });
    return { accepted: true, inboxItemId: id, documentCount: documents };
  }
  const row = await prisma.inboxItem.findUnique({
    where: { id },
    select: { conversationId: true, _count: { select: { documentProposals: true } } },
  });
  if (!row || row.conversationId !== current) return { accepted: false };
  return { accepted: true, inboxItemId: id, documentCount: row._count.documentProposals };
}

export async function ignoreInbox(id: string): Promise<void> {
  const readable = readInboxItemId(id);
  if (!readable) return;
  await prisma.inboxItem.updateMany({
    where: { id: readable, status: { in: ["a_traiter", "proposee"] } },
    data: { status: "ignoree" },
  });
}

export async function resumeInbox(id: string): Promise<void> {
  const readable = readInboxItemId(id);
  if (!readable) return;
  const item = await prisma.inboxItem.findUnique({
    where: { id: readable },
    select: {
      status: true,
      businessPlanProposals: { select: { status: true } },
      documentProposals: { select: { status: true } },
    },
  });
  if (!item || item.status !== "ignoree") return;
  await prisma.inboxItem.update({
    where: { id: readable },
    data: { status: resumeInboxStatus(linkedProposals(item)) },
  });
}

function linkedProposals(item: {
  businessPlanProposals: Array<{ status: string }>;
  documentProposals: Array<{ status: string }>;
}): InboxProposal[] {
  return [
    ...item.businessPlanProposals.map((proposal) => ({ kind: "business" as const, status: proposal.status })),
    ...item.documentProposals.map((proposal) => ({ kind: "document" as const, status: proposal.status })),
  ];
}
