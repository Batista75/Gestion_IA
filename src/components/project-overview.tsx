import Link from "next/link";
import { ArrowRight, FileText, Files, Package, Receipt, ShoppingCart, Truck, Wallet } from "lucide-react";
import { ClientPicker } from "@/components/client-picker";
import { RowMenu, type RowMenuItem } from "@/components/row-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, saleStatusTone } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectDocumentRow } from "@/lib/commercial-board";

export type OverviewStat = { key: string; label: string; value: string; detail: string; href: string };

const STAT_ICONS = { lignes: Package, devis: FileText, commandes: ShoppingCart, vente: Wallet } as const;

const DOCUMENT_ICONS: Record<ProjectDocumentRow["source"], typeof FileText> = {
  produit: FileText,
  recu: Files,
  reference: Receipt,
};

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-border bg-surface ${className}`}>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-primary transition-colors duration-150 hover:text-foreground"
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

const head = "h-8 bg-surface-2/70 px-3 text-xs font-medium text-muted-foreground";
const cell = "px-3 py-2";

export function ProjectOverview({
  projectId,
  stats,
  documents,
  client,
  context,
  lines,
}: {
  projectId: string;
  stats: OverviewStat[];
  documents: ProjectDocumentRow[];
  client: {
    name: string;
    known: boolean;
    place: string;
    contact: string;
    reach: string;
    href: string;
    pickerId: string;
    choices: Array<{ id: string; name: string }>;
  };
  context: { purpose: string; nextAction: string; lead: string; delivery: string; step: string; progress: string };
  lines: Array<{ id: string; name: string; supplierName: string; quantity: number; net: string }>;
}) {
  const shown = documents.slice(0, 6);
  return (
    <div className="grid content-start gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            icon={STAT_ICONS[stat.key as keyof typeof STAT_ICONS] ?? Package}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
            href={stat.href}
          />
        ))}
      </div>

      <Panel
        title="Pièces du dossier"
        action={
          <span className="text-xs text-muted-foreground tabular-nums">
            {documents.length > shown.length ? `${shown.length} sur ${documents.length}` : documents.length}
          </span>
        }
      >
        {shown.length === 0 ? (
          <EmptyState icon={Files} title="Aucune pièce pour ce dossier">
            Un devis s’établit depuis Produits. Les références de livraison et de facture se rattachent depuis une commande.
          </EmptyState>
        ) : (
          <Table>
            <caption className="sr-only">Pièces du dossier</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={head}>Date</TableHead>
                <TableHead className={head}>Pièce</TableHead>
                <TableHead className={head}>Tiers</TableHead>
                <TableHead className={`${head} text-right`}>Montant HT</TableHead>
                <TableHead className={head}>Situation</TableHead>
                <TableHead className={`${head} w-10`}>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => {
                const Icon = DOCUMENT_ICONS[row.source];
                const items: RowMenuItem[] = [{ label: row.source === "reference" ? "Voir dans Devis et commandes" : "Ouvrir", href: row.href }];
                if (row.download) items.push({ label: "Télécharger", href: row.download, download: true });
                return (
                  <TableRow key={`${row.source}-${row.id}`}>
                    <TableCell className={`${cell} text-muted-foreground tabular-nums`}>{row.date.toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className={`${cell} max-w-64`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="grid min-w-0">
                          {row.source === "reference" ? (
                            <span className="truncate font-medium">{row.reference}</span>
                          ) : (
                            <Link href={row.href} className="truncate font-medium underline-offset-4 hover:underline">
                              {row.reference}
                            </Link>
                          )}
                          <span className="truncate text-xs text-muted-foreground">{row.type}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className={`${cell} max-w-36 truncate text-muted-foreground`}>{row.party}</TableCell>
                    <TableCell className={`${cell} text-right tabular-nums`}>{row.amount}</TableCell>
                    <TableCell className={cell}>
                      <StatusBadge tone={saleStatusTone(row.status)}>{row.statusLabel}</StatusBadge>
                    </TableCell>
                    <TableCell className="px-1 py-1 text-right">
                      <RowMenu label={`Actions pour ${row.reference}`} items={items} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="mt-auto border-t border-border">
          <PanelLink href={`/projets/${projectId}?onglet=pieces`}>Voir les devis et commandes</PanelLink>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Client et contexte">
          <dl className="grid gap-2 px-3 py-3 text-sm">
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Client</dt>
              <dd className="min-w-0">
                {client.known ? (
                  <Link href={client.href} className="font-medium underline-offset-4 hover:underline">
                    {client.name}
                  </Link>
                ) : (
                  <span className="font-medium">{client.name}</span>
                )}
                <span className="block truncate text-xs text-muted-foreground">
                  {client.known ? [client.place, client.contact, client.reach].filter(Boolean).join(" · ") : "Pas encore une fiche du répertoire."}
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Objet</dt>
              <dd className="line-clamp-2">{context.purpose || "Pas encore rédigé."}</dd>
            </div>
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Prochaine action</dt>
              <dd>{context.nextAction || "—"}</dd>
            </div>
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Parcours</dt>
              <dd>
                {context.progress}
                <span className="block text-xs text-muted-foreground">Prochaine étape : {context.step}</span>
              </dd>
            </div>
            <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">Livraison</dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <Truck aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{context.delivery}</span>
              </dd>
            </div>
            {context.lead ? (
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">Responsable</dt>
                <dd>{context.lead}</dd>
              </div>
            ) : null}
          </dl>
          <details className="group mx-3 mb-3 rounded-md border border-border px-3 py-2 transition-colors duration-150 hover:bg-surface-2/50">
            <summary className="cursor-pointer text-xs font-medium">Changer le client du dossier</summary>
            <div className="pt-2">
              <ClientPicker projectId={projectId} clientId={client.pickerId} clients={client.choices} />
            </div>
          </details>
        </Panel>

        <Panel title="Produits et services" action={<span className="text-xs text-muted-foreground tabular-nums">{lines.length}</span>}>
          {lines.length === 0 ? (
            <EmptyState icon={Package} title="Aucune ligne">
              Ajoutez un produit ou un service du catalogue dans le volet Produits.
            </EmptyState>
          ) : (
            <Table>
              <caption className="sr-only">Produits et services du dossier</caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={head}>Désignation</TableHead>
                  <TableHead className={`${head} text-right`}>Qté</TableHead>
                  <TableHead className={`${head} text-right`}>Vente HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.slice(0, 5).map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className={`${cell} max-w-56`}>
                      <span className="block truncate font-medium">{line.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{line.supplierName || "Fournisseur non nommé"}</span>
                    </TableCell>
                    <TableCell className={`${cell} text-right tabular-nums`}>{line.quantity}</TableCell>
                    <TableCell className={`${cell} text-right tabular-nums`}>{line.net}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-auto border-t border-border">
            <PanelLink href={`/projets/${projectId}?onglet=produits`}>
              {lines.length > 5 ? `Voir les ${lines.length} lignes` : "Ouvrir le volet Produits"}
            </PanelLink>
          </div>
        </Panel>
      </div>
    </div>
  );
}
