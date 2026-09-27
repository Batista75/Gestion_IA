import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientPicker } from "@/components/client-picker";
import { DeliveryForm } from "@/components/delivery-form";
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
import { deliveryFromRecord, deliverySummary } from "@/domain/delivery";
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
      sales: {
        orderBy: { createdAt: "desc" },
        include: {
          lines: { orderBy: { createdAt: "asc" } },
          parent: { select: { id: true, kind: true, title: true } },
        },
      },
      steps: true,
      events: { orderBy: { createdAt: "asc" } },
      client: true,
    },
  });
  if (!project) notFound();

  const [namedClient, products, clients, suppliers] = await Promise.all([
    project.client
      ? Promise.resolve(project.client)
      : prisma.client.findFirst({
          where: { name: { equals: project.primaryClient, mode: "insensitive" } },
        }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      take: 500,
      include: { supplier: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const client = namedClient;
  const delivery = deliveryFromRecord(project);
  const deliveryLines = deliverySummary(delivery);

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

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Sections du dossier">
        {[
          ["#parcours", "Parcours"],
          ["#livraison", "Livraison"],
          ["#produits", "Produits et services"],
          ["#devis", "Devis"],
          ["#commandes-client", "Commandes client"],
          ["#commandes-fournisseur", "Commandes fournisseur"],
          ["#actualite", "Actualité"],
        ].map(([href, label]) => (
          <a key={href} href={href} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-3")}>
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
            <CardDescription>Compte facturé de ce dossier.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm leading-6">
            <p className="font-medium">{client?.name ?? project.primaryClient}</p>
            <ClientPicker
              projectId={project.id}
              clientId={project.clientId ?? client?.id ?? ""}
              clients={clients}
            />
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
            <p>{deliveryLines.length > 0 ? `Livraison : ${deliveryLines.join(", ")}.` : "Livraison non précisée."}</p>
            {project.lead ? <p>Responsable : {project.lead}</p> : null}
            <p className="text-muted-foreground">Ouvert le {project.createdAt.toLocaleDateString("fr-FR")}</p>
          </CardContent>
        </Card>
      </div>

      <Card id="livraison" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>Livraison</CardTitle>
          <CardDescription>
            Destinataire, adresse, contact et créneau. Cette adresse peut différer de celle du client facturé. Elle est reprise sur les documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeliveryForm projectId={project.id} delivery={delivery} />
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="order-2 grid min-w-0 gap-6 lg:order-1">
      <ProjectOperation
        projectId={project.id}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          kind: product.kind,
          supplierName: product.supplier?.name ?? "",
          costLabel: product.costStated,
        }))}
        suppliers={suppliers}
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
          parent: document.parent,
          lines: document.lines.map((line) => ({
            id: line.id,
            name: line.name,
            kind: line.kind,
            supplierName: line.supplierName,
            quantity: line.quantity,
            costCents: line.costCents,
            saleUnitCents: line.saleUnitCents,
            markupPercent: line.markupPercent,
            discountPercent: line.discountPercent,
            confirmedLabel: null,
          })),
        }))}
      />

      <section id="actualite" className="grid scroll-mt-6 gap-2">
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
      </div>
    </div>
  );
}
