import { AssistantChat } from "@/components/assistant-chat";
import { latestProjectConversation } from "@/lib/conversations";
import { prisma } from "@/lib/db";

export default async function ProjectSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!project) return children;
  const thread = await latestProjectConversation(id);
  const conversationId = thread?.id ?? crypto.randomUUID();
  return (
    <div className="grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)_15rem] gap-3">
      <div className="min-h-0 overflow-auto">{children}</div>
      <section aria-label="Assistant" className="flex min-h-0 flex-col overflow-hidden">
        <h2 className="sr-only">Assistant</h2>
        <div className="min-h-0 flex-1">
          <AssistantChat
            key={conversationId}
            fill
            conversationId={conversationId}
            projectName={project.name}
            initialMessages={thread?.messages ?? []}
          />
        </div>
      </section>
    </div>
  );
}
