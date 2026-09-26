import Link from "next/link";
import {
  deleteProjectAction,
  deleteQuoteAction,
  updateProjectAction,
} from "@/app/catalog-actions";
import { ChangeJournal } from "@/components/change-journal";
import { ProjectEditor, ProjectForm } from "@/components/project-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { listRecordEvents } from "@/lib/record-journal";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, journal] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        events: { orderBy: { createdAt: "asc" } },
        quotes: { orderBy: { createdAt: "desc" }, include: { lines: true } },
      },
    }),
    listRecordEvents("project", 40),
  ]);

  return (
    <div className="grid gap-6">
    <ChangeJournal entries={journal.slice(0, 12)} />
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
                    <CardTitle>
                      <Link href={`/projets/${project.id}`} className="underline-offset-4 hover:underline">
                        {project.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      Client principal · {project.primaryClient}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary">{project.status}</Badge>
                      {project.reference ? (
                        <span className="text-sm text-muted-foreground">{project.reference}</span>
                      ) : null}
                      <p className="text-sm">{project.nextAction}</p>
                      <p className="text-xs text-muted-foreground">
                        Ouvert le {project.createdAt.toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Link
                      href={`/projets/${project.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "min-h-11 w-fit px-4")}
                    >
                      Ouvrir la vue
                    </Link>
                    {project.purpose ? (
                      <p className="text-sm leading-6">Le projet consiste à {project.purpose}.</p>
                    ) : null}
                    {project.budgetStated ? (
                      <p className="text-sm">Budget indiqué {project.budgetStated}, en {project.currency}.</p>
                    ) : null}
                    {project.quotes.length > 0 ? (
                      <div className="grid gap-2">
                        <p className="text-sm font-medium">Devis de l’affaire</p>
                        <ul className="grid gap-2">
                          {project.quotes.map((quote) => (
                            <li key={quote.id} className="rounded-lg bg-muted px-3 py-2 text-sm leading-6">
                              <p className="font-medium">{quote.versionLabel || quote.title}</p>
                              <p>
                                Devise {quote.currency || "non indiquée"}
                                {quote.statedTotalHt ? ` · HT indiqué ${quote.statedTotalHt}` : ""}
                                {quote.statedVat ? ` · TVA indiquée ${quote.statedVat}` : ""}
                                {quote.statedTotalTtc ? ` · TTC indiqué ${quote.statedTotalTtc}` : ""}
                              </p>
                              {quote.vatMention ? <p>{quote.vatMention}</p> : null}
                              {quote.currency === "USD" ? (
                                <p>Conversion en euro : taux non indiqué. Le montant reste en dollars.</p>
                              ) : null}
                              <p>Marge brute : coût de revient non indiqué.</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">Modifier ou supprimer</summary>
                      <div className="pt-3">
                        <ProjectEditor
                          project={{
                            id: project.id,
                            name: project.name,
                            primaryClient: project.primaryClient,
                            status: project.status,
                            purpose: project.purpose,
                            nextAction: project.nextAction,
                          }}
                          quotes={project.quotes.map((quote) => ({
                            id: quote.id,
                            label: quote.versionLabel || quote.title,
                          }))}
                          updateAction={updateProjectAction}
                          deleteAction={deleteProjectAction}
                          deleteQuoteAction={deleteQuoteAction}
                        />
                      </div>
                    </details>
                    <div className="grid gap-2">
                      <p className="text-sm font-medium">Actualité</p>
                      {project.events.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
                      ) : (
                        <ol className="grid gap-2">
                          {project.events.map((event) => (
                            <li key={event.id} className="text-sm leading-6">
                              <span className="text-muted-foreground">
                                {event.createdAt.toLocaleString("fr-FR")}
                                {" · "}
                              </span>
                              {event.body}
                              {event.fileId ? (
                                <>
                                  {" "}
                                  <Link
                                    href={`/api/pieces/${event.fileId}`}
                                    className="font-medium underline-offset-4 hover:underline"
                                  >
                                    Ouvrir la pièce
                                  </Link>
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
    </div>
  );
}
