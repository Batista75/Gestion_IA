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

function toPiece(piece: {
  id: string;
  kind: string;
  reference: string;
  children?: Array<{
    id: string;
    kind: string;
    reference: string;
    children?: Array<{ id: string; kind: string; reference: string }>;
  }>;
}) {
  return {
    id: piece.id,
    kind: piece.kind,
    reference: piece.reference,
    children: (piece.children ?? []).map((child) => ({
      id: child.id,
      kind: child.kind,
      reference: child.reference,
      children: (child.children ?? []).map((grandchild) => ({
        id: grandchild.id,
        kind: grandchild.kind,
        reference: grandchild.reference,
        children: [],
      })),
    })),
  };
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { id } = await params;
  const requested = (await searchParams).onglet;
  const tab = requested === "livraison" || requested === "affaire" ? requested : "apercu";
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      sales: {
        orderBy: { createdAt: "desc" },
        include: {
          lines: { orderBy: { createdAt: "asc" } },
          parent: { select: { id: true, kind: true, title: true } },
          notedPieces: {
            where: { pieceParentId: null },
            orderBy: { createdAt: "asc" },
            include: {
              children: {
                orderBy: { createdAt: "asc" },
                include: { children: { orderBy: { createdAt: "asc" } } },
              },
            },
          },
        },
      },
      steps: true,
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
    <div className="grid min-h-0 gap-3" data-onglet={tab}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.status}{project.reference ? ` · ${project.reference}` : ""}</p>
        </div>
        <Link href="/projets" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>
          Tous les projets
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Volets du dossier">
        {(
          [
            ["apercu", "Aperçu"],
            ["livraison", "Livraison"],
            ["affaire", "Produits, devis et parcours"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/projets/${project.id}?onglet=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(buttonVariants({ variant: tab === key ? "default" : "outline" }), "h-9 px-3")}
          >
            {label}
          </Link>
        ))}
        <Link href={`/evenements?projet=${project.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3")}>
          Événements
        </Link>
      </nav>

      {tab === "apercu" ? (
      <div className="grid gap-3 lg:grid-cols-2">
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
      ) : null}

      {tab === "livraison" ? (
      <Card id="livraison">
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
      ) : null}

      {tab === "affaire" ? (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
          pieces: document.notedPieces.map(toPiece),
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
        <h2 className="text-lg font-semibold">Événements</h2>
        <p className="text-sm text-muted-foreground">
          Les traces de ce dossier sont regroupées avec les autres opérations.
        </p>
        <Link href={`/evenements?projet=${project.id}`} className="text-sm font-medium underline-offset-4 hover:underline">
          Voir les événements de ce dossier
        </Link>
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
      ) : null}
    </div>
  );
}
