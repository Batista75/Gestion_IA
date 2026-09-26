import Link from "next/link";
import { ProjectForm } from "@/components/project-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Nouveau dossier</CardTitle>
          <CardDescription>
            Un projet relie un besoin, un client facturé et les pièces qui
            suivront. Le statut initial est « À qualifier ». Le compte se tient
            dans la{" "}
            <Link
              href="/clients"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              vue Clients
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm />
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Projets</h1>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Aucun projet pour cette société.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>
                      Client principal · {project.primaryClient}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary">{project.status}</Badge>
                    <p className="text-sm">{project.nextAction}</p>
                    <p className="text-xs text-muted-foreground">
                      Ouvert le {project.createdAt.toLocaleDateString("fr-FR")}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
