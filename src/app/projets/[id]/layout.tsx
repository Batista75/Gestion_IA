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
    <div className="grid gap-8">
      {children}
      <section id="assistant" className="grid scroll-mt-6 gap-3">
        <h2 className="text-lg font-semibold">Assistant</h2>
        <AssistantChat
          key={conversationId}
          conversationId={conversationId}
          projectName={project.name}
          initialMessages={thread?.messages ?? []}
        />
      </section>
    </div>
  );
}
