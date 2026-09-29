import { ProjectAssistant } from "@/components/project-assistant";
import { archivedProjectConversations, latestProjectConversation, projectConversations } from "@/lib/conversations";
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
    select: { name: true, status: true },
  });
  if (!project) return <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>;
  const [thread, threads, archived] = await Promise.all([
    latestProjectConversation(id),
    projectConversations(id),
    archivedProjectConversations(id),
  ]);
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_var(--assistant-width)] xl:grid-rows-[minmax(0,1fr)]">
      <div className="flex min-h-0 min-w-0 flex-col overflow-auto px-4 py-3 sm:px-5 xl:py-4">{children}</div>
      <section
        aria-label="Assistant"
        className="flex min-h-0 flex-col overflow-hidden border-t border-border bg-surface print:hidden xl:border-t-0 xl:border-l"
      >
        <ProjectAssistant
          key={id}
          projectName={project.name}
          projectStatus={project.status}
          current={thread ? { id: thread.id, messages: thread.messages, hidden: thread.hidden, projectName: thread.projectName } : null}
          fallbackId={crypto.randomUUID()}
          threads={threads}
          archived={archived}
        />
      </section>
    </div>
  );
}
