import { readView, type ContextHint, type ContextSnapshot } from "@/domain/context-envelope";
import { intentCatalog } from "@/domain/intent-catalog";
import { currentOperatorMark } from "@/domain/operator";
import { saleKindLabel } from "@/domain/sale-line";
import { prisma } from "@/lib/db";

export async function resolveContext(hint: ContextHint): Promise<ContextSnapshot> {
  const view = readView(hint.view);
  const project = view.projectId
    ? await prisma.project.findUnique({
        where: { id: view.projectId },
        select: { id: true, name: true, primaryClient: true },
      })
    : null;
  let selectedKind = "";
  let selectedLabel = "";
  if (project && view.documentId) {
    const document = await prisma.saleDocument.findFirst({
      where: { id: view.documentId, projectId: project.id },
      select: { title: true, kind: true },
    });
    if (document) {
      selectedKind = "document";
      selectedLabel = `${saleKindLabel(document.kind)} ${document.title}`.trim();
    }
  }
  const events = await prisma.recordEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { action: true, entityName: true },
  });
  return {
    viewLabel: project ? view.label : view.projectId ? "Page" : view.label,
    projectId: project?.id ?? "",
    projectName: project?.name ?? "",
    projectClient: project?.primaryClient ?? "",
    selectedKind,
    selectedLabel,
    attachments: hint.attachments,
    recent: events
      .map((event) => [event.action, event.entityName].filter(Boolean).join(" "))
      .filter(Boolean),
    operator: currentOperatorMark(),
    role: "opérateur",
    allowed: intentCatalog.filter((item) => item.execution === "regle").map((item) => item.label),
  };
}

export async function attachConversationProject(conversationId: string, projectId: string): Promise<void> {
  if (!projectId) return;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { projectId },
  });
}
