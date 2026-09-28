import Link from "next/link";
import { ProjectForm } from "@/components/project-form";
import { currentActor } from "@/lib/actor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const who = await currentActor();
  const [projects, clients, changes, actions] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.recordEvent.findMany({
      where: { entityType: "project" },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.projectEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { project: { select: { name: true } } },
    }),
  ]);
  const logs = [
    ...changes.map((entry) => ({
      id: `fiche-${entry.id}`,
      at: entry.createdAt,
      who: entry.actor.trim() || who,
      label: "Modification",
      text: `${entry.entityName} · ${entry.summary}`,
    })),
    ...actions.map((entry) => ({
      id: `action-${entry.id}`,
      at: entry.createdAt,
      who,
      label: "Action",
      text: `${entry.project.name} · ${entry.body}`,
    })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime());

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-7.5rem)] lg:grid-rows-2">
      <section className="grid min-h-0 content-start gap-3 overflow-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
          <details className="group">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground [&::-webkit-details-marker]:hidden">
              Nouveau dossier
            </summary>
            <div className="mt-3 max-w-xl rounded-lg border border-border bg-card p-4">
              <ProjectForm clients={clients} />
            </div>
          </details>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                {["Projet", "Client", "Statut", "Réf.", "Prochaine action", "Ouvert le"].map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    Aucun projet pour cette société.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/projets/${project.id}`} className="font-medium underline-offset-4 hover:underline">
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{project.client?.name || project.primaryClient || "—"}</td>
                    <td className="px-3 py-2">{project.status}</td>
                    <td className="px-3 py-2">{project.reference.trim() || "—"}</td>
                    <td className="px-3 py-2">{project.nextAction}</td>
                    <td className="px-3 py-2">{project.createdAt.toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="grid min-h-0 content-start gap-3 overflow-auto rounded-lg border border-border bg-card p-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Modifications et actions</h2>
          <p className="text-sm text-muted-foreground">
            L’auteur est l’initiale du prénom suivie du nom. La personne connectée est {who}.
          </p>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune modification ni action enregistrée.</p>
        ) : (
          <ol className="grid gap-2">
            {logs.map((entry) => (
              <li key={entry.id} className="text-sm leading-6">
                <span className="text-muted-foreground">{entry.at.toLocaleString("fr-FR")}</span>
                {" · "}
                <span className="font-medium">{entry.who}</span>
                {" · "}
                {entry.label}
                {" · "}
                {entry.text}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
