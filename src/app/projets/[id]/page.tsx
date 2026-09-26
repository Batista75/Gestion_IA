import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectOperation } from "@/components/project-operation";
import { ProjectWorkflow } from "@/components/project-workflow";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TRADE_STEPS, readStepStatus } from "@/domain/trade-workflow";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      sales: { orderBy: { createdAt: "desc" }, include: { lines: { orderBy: { createdAt: "asc" } } } },
      steps: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) notFound();

  const [client, products] = await Promise.all([
    prisma.client.findFirst({
      where: { name: { equals: project.primaryClient, mode: "insensitive" } },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      take: 200,
      include: { supplier: true },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Vue projet</p>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        </div>
        <Link href="/projets" className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}>
          Tous les projets
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
            <CardDescription>Compte facturé de ce dossier.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm leading-6">
            <p className="font-medium">{project.primaryClient}</p>
            {client ? (
              <>
                <p>
                  {[client.country, client.city].filter(Boolean).join(" · ") || "Pays non renseigné"}
                </p>
                <p>
                  {client.contactName
                    ? `Contact ${client.contactName}${client.contactRole ? `, ${client.contactRole}` : ""}`
                    : "Aucun contact enregistré."}
                </p>
                <p>{client.email || client.phone || "E-mail et téléphone non renseignés."}</p>
                <Link
                  href={`/clients?q=${encodeURIComponent(client.name)}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  Ouvrir la fiche client
                </Link>
              </>
            ) : (
              <p>Ce nom n’est pas encore une fiche du répertoire. Le dossier reste ouvert.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contexte</CardTitle>
            <CardDescription>Objet et suite du dossier.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm leading-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{project.status}</Badge>
              {project.reference ? <span>{project.reference}</span> : null}
            </div>
            <p>{project.purpose ? `Le projet consiste à ${project.purpose}.` : "L’objet n’est pas encore rédigé."}</p>
            <p>Prochaine action : {project.nextAction}</p>
            {project.lead ? <p>Responsable : {project.lead}</p> : null}
            <p className="text-muted-foreground">Ouvert le {project.createdAt.toLocaleDateString("fr-FR")}</p>
          </CardContent>
        </Card>
      </div>

      <ProjectWorkflow
        projectId={project.id}
        steps={TRADE_STEPS}
        records={project.steps.map((step) => ({
          key: step.stepKey,
          status: readStepStatus(step.status),
          proofRef: step.proofRef,
          proofNote: step.proofNote,
        }))}
      />

      <ProjectOperation
        projectId={project.id}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          kind: product.kind,
          supplierName: product.supplier?.name ?? "",
          costLabel: product.costStated,
        }))}
        lines={project.lines.map((line) => ({
          id: line.id,
          name: line.name,
          kind: line.kind,
          supplierName: line.supplierName,
          quantity: line.quantity,
          costCents: line.costCents,
          markupPercent: line.markupPercent,
          discountPercent: line.discountPercent,
          confirmedLabel: line.confirmedAt ? line.confirmedAt.toLocaleString("fr-FR") : null,
        }))}
        documents={project.sales.map((document) => ({
          id: document.id,
          kind: document.kind,
          status: document.status,
          title: document.title,
          supplierName: document.supplierName,
          createdLabel: document.createdAt.toLocaleString("fr-FR"),
          confirmedLabel: document.confirmedAt ? document.confirmedAt.toLocaleString("fr-FR") : null,
          lines: document.lines.map((line) => ({
            id: line.id,
            name: line.name,
            kind: line.kind,
            supplierName: line.supplierName,
            quantity: line.quantity,
            costCents: line.costCents,
            markupPercent: line.markupPercent,
            discountPercent: line.discountPercent,
            confirmedLabel: null,
          })),
        }))}
      />

      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Actualité</h2>
        {project.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
        ) : (
          <ol className="grid gap-2">
            {project.events.map((event) => (
              <li key={event.id} className="text-sm leading-6">
                <span className="text-muted-foreground">{event.createdAt.toLocaleString("fr-FR")} · </span>
                {event.body}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
