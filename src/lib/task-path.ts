import { readStoredTask, type StoredTask } from "@/domain/task-path";
import { prisma } from "@/lib/db";

export async function loadTask(conversationId: string): Promise<StoredTask | null> {
  const row = await prisma.assistantTask.findUnique({ where: { conversationId } });
  return row ? readStoredTask(row.payload) : null;
}

export async function saveTask(conversationId: string, task: StoredTask): Promise<void> {
  const payload = {
    intent: task.intent,
    action: task.action,
    request: task.request,
    field: task.field,
    question: task.question,
    proposed: task.proposed,
    status: task.status,
    steps: task.steps,
    overrides: task.overrides,
    valeurs: task.valeurs,
    attachments: task.attachments,
    view: task.view,
  };
  await prisma.assistantTask.upsert({
    where: { conversationId },
    create: { conversationId, payload },
    update: { payload },
  });
}
