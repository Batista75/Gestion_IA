import { notFound } from "next/navigation";
import { CalendarDays, MapPin, User, Wallet } from "lucide-react";
import { DeliveryForm } from "@/components/delivery-form";
import { ProjectEditDialog } from "@/components/project-edit-dialog";
import { ProjectHeader, ProjectTabs } from "@/components/project-header";
import { ProjectDocuments, ProjectLines } from "@/components/project-operation";
import { ProjectOverview, type OverviewStat } from "@/components/project-overview";
import { ProjectWorkflow } from "@/components/project-workflow";
import { RowMenu } from "@/components/row-menu";
import { deliveryFromRecord, deliveryModeLabel, deliverySummary } from "@/domain/delivery";
import { formatCents, saleOperationTotals } from "@/domain/pricing";
import { TRADE_STEPS, nextTradeStep, readStepStatus } from "@/domain/trade-workflow";
import { figuresOf, projectDocumentRows } from "@/lib/commercial-board";
import { prisma } from "@/lib/db";

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
  const tab =
    requested === "affaire"
      ? "produits"
      : requested === "livraison" || requested === "produits" || requested === "pieces" || requested === "parcours"
        ? requested
        : "apercu";
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

  const [namedClient, products, clients, suppliers, documentRows, quotes] = await Promise.all([
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
    tab === "apercu" ? projectDocumentRows(id) : Promise.resolve([]),
    prisma.quote.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, versionLabel: true } }),
  ]);
  const client = namedClient;
  const delivery = deliveryFromRecord(project);
  const deliveryLines = deliverySummary(delivery);

  const records = project.steps.map((step) => ({
    key: step.stepKey,
    status: readStepStatus(step.status),
    proofRef: step.proofRef,
    proofNote: step.proofNote,
  }));
  const proven = records.filter((record) => record.status === "fait").length;
  const nextStep = nextTradeStep(records);
  const lineFigures = project.lines.map(figuresOf);
  const lineTotals = saleOperationTotals(lineFigures);
  const quotesMade = project.sales.filter((sale) => sale.kind === "devis");
  const customerOrders = project.sales.filter((sale) => sale.kind === "commande_client").length;
  const supplierOrders = project.sales.filter((sale) => sale.kind === "commande_fournisseur").length;
  const confirmedLines = project.lines.filter((line) => line.confirmedAt).length;
  const place = [delivery.postalCode, delivery.city].filter(Boolean).join(" ");
  const base = `/projets/${project.id}`;

  const stats: OverviewStat[] = [
    {
      key: "lignes",
      label: "Produits et services",
      value: String(project.lines.length),
      detail: project.lines.length === 0 ? "Aucune ligne" : `${confirmedLines} confirmée${confirmedLines > 1 ? "s" : ""}`,
      href: `${base}?onglet=produits`,
    },
    {
      key: "devis",
      label: "Devis établis",
      value: String(quotesMade.length),
      detail: `${quotesMade.filter((sale) => sale.status === "en_cours").length} en cours`,
      href: `${base}?onglet=pieces`,
    },
    {
      key: "commandes",
      label: "Commandes",
      value: String(customerOrders + supplierOrders),
      detail: `${customerOrders} client · ${supplierOrders} fournisseur`,
      href: `${base}?onglet=pieces`,
    },
    {
      key: "vente",
      label: "Vente HT des lignes",
      value: project.lines.length === 0 || lineTotals.missing === project.lines.length ? "Non indiqué" : formatCents(lineTotals.netCents),
      detail:
        lineTotals.missing > 0
          ? `${lineTotals.missing} ligne${lineTotals.missing > 1 ? "s" : ""} sans coût`
          : project.lines.length > 0
            ? `Marge ${formatCents(lineTotals.marginCents)}`
            : "Rien à chiffrer",
      href: `${base}?onglet=produits`,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-onglet={tab}>
      <ProjectHeader
        name={project.name}
        subtitle={[project.purpose, project.reference].filter(Boolean).join(" · ") || "Objet non rédigé"}
        status={project.status}
        facts={[
          {
            icon: User,
            label: "Client",
            value: client?.name ?? project.primaryClient,
            detail: client ? [client.city, client.country].filter(Boolean).join(" · ") || undefined : "Hors répertoire",
            href: client ? `/clients?q=${encodeURIComponent(client.name)}` : undefined,
          },
          {
            icon: MapPin,
            label: "Livraison",
            value: place || delivery.address || "Non précisée",
            detail: delivery.mode ? deliveryModeLabel(delivery.mode) : undefined,
            href: `${base}?onglet=livraison`,
          },
          { icon: CalendarDays, label: "Ouvert le", value: project.createdAt.toLocaleDateString("fr-FR"), detail: project.lead || undefined },
          {
            icon: Wallet,
            label: "Budget indiqué",
            value: project.budgetStated.trim() || "Non indiqué",
            detail: project.budgetStated.trim() ? "Tel qu’écrit, non recalculé" : undefined,
          },
        ]}
        actions={
          <>
            <ProjectEditDialog
              project={{
                id: project.id,
                name: project.name,
                clientId: project.clientId ?? client?.id ?? "",
                status: project.status,
                purpose: project.purpose,
                nextAction: project.nextAction,
              }}
              clients={clients}
              quotes={quotes.map((quote) => ({ id: quote.id, label: quote.versionLabel || quote.title }))}
            />
            <RowMenu
              label="Autres actions du dossier"
              size="icon"
              items={[
                { label: "Événements du dossier", href: `/evenements?projet=${project.id}` },
                { label: "Voir la facture client", href: `${base}/facture` },
                { label: "Instruction métier", href: "/documentation/metier" },
                { label: "Tous les projets", href: "/projets" },
              ]}
            />
          </>
        }
      />

      <ProjectTabs
        current={tab}
        items={[
          { key: "apercu", label: "Vue d’ensemble", href: base },
          { key: "livraison", label: "Livraison", href: `${base}?onglet=livraison` },
          { key: "produits", label: "Produits", href: `${base}?onglet=produits`, count: String(project.lines.length) },
          { key: "pieces", label: "Devis et commandes", href: `${base}?onglet=pieces`, count: String(project.sales.length) },
          { key: "parcours", label: "Parcours", href: `${base}?onglet=parcours`, count: `${proven}/${TRADE_STEPS.length}` },
        ]}
      />

      {tab === "apercu" ? (
        <div className="min-h-0 flex-1 overflow-auto pb-1">
          <ProjectOverview
            projectId={project.id}
            stats={stats}
            documents={documentRows}
            client={{
              name: client?.name ?? project.primaryClient,
              known: Boolean(client),
              place: client ? [client.country, client.city].filter(Boolean).join(" · ") : "",
              contact: client?.contactName ? `${client.contactName}${client.contactRole ? `, ${client.contactRole}` : ""}` : "",
              reach: client?.email || client?.phone || "",
              href: client ? `/clients?q=${encodeURIComponent(client.name)}` : "/clients",
              pickerId: project.clientId ?? client?.id ?? "",
              choices: clients,
            }}
            context={{
              purpose: project.purpose,
              nextAction: project.nextAction,
              lead: project.lead,
              delivery: deliveryLines.length > 0 ? deliveryLines.join(", ") : "Non précisée",
              step: `${nextStep.order}. ${nextStep.title}`,
              progress: `${proven} preuve${proven > 1 ? "s" : ""} sur ${TRADE_STEPS.length}`,
            }}
            lines={project.lines.map((line, index) => ({
              id: line.id,
              name: line.name,
              supplierName: line.supplierName,
              quantity: line.quantity,
              net: formatCents(lineFigures[index]?.lineNetCents ?? null),
            }))}
          />
        </div>
      ) : null}

      {tab === "livraison" ? (
      <section id="livraison" className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 grid gap-0.5">
          <h2 className="text-sm font-semibold">Livraison</h2>
          <p className="text-xs text-muted-foreground">
            Destinataire, adresse, contact et créneau. Cette adresse peut différer de celle du client facturé. Elle est reprise sur les documents.
          </p>
        </div>
        <DeliveryForm projectId={project.id} delivery={delivery} />
      </section>
      ) : null}

      {tab === "produits" ? (
        <div className="min-h-0 flex-1">
          <ProjectLines
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
          />
        </div>
      ) : null}

      {tab === "pieces" ? (
        <div className="min-h-0 flex-1">
          <ProjectDocuments
            projectId={project.id}
            suppliers={suppliers}
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
        </div>
      ) : null}

      {tab === "parcours" ? (
        <div className="min-h-0 flex-1">
          <ProjectWorkflow
            projectId={project.id}
            steps={TRADE_STEPS}
            records={records}
          />
        </div>
      ) : null}
    </div>
  );
}
