import Link from "next/link";
import { ProjectForm } from "@/components/project-form";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="grid gap-4">
      <section className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
            <Link href="/evenements" className="text-sm font-medium underline-offset-4 hover:underline">
              Événements des dossiers
            </Link>
          </div>
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
    </div>
  );
}
