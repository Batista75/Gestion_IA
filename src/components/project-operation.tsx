"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  addLineAction,
  confirmDocumentAction,
  confirmLinesAction,
  customerOrderAction,
  loseQuoteAction,
  quoteAction,
  reopenDocumentAction,
  attachNotedPieceAction,
  supplierOrderAction,
  updateDocumentAction,
  updateLinesAction,
  type SaleState,
} from "@/app/projets/sale-actions";
import { FormMessage } from "@/components/party-manager";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, saleStatusTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsInput, formatCents, saleLineFigures, saleOperationTotals, storedSaleFigures } from "@/domain/pricing";
import { notedPieceLabel } from "@/domain/noted-piece";
import { saleKindLabel, saleStatusLabel } from "@/domain/sale-line";

const initial: SaleState = { message: null, ok: false };

export type OperationLine = {
  id: string;
  name: string;
  kind: string;
  supplierName: string;
  quantity: number;
  costCents: number | null;
  saleUnitCents?: number | null;
  markupPercent: number;
  discountPercent: number;
  confirmedLabel: string | null;
};

export type NotedPieceView = {
  id: string;
  kind: string;
  reference: string;
  children: NotedPieceView[];
};

export type OperationDocument = {
  id: string;
  kind: string;
  status: string;
  title: string;
  supplierName: string;
  createdLabel: string;
  confirmedLabel: string | null;
  parent: { id: string; kind: string; title: string } | null;
  lines: OperationLine[];
  pieces: NotedPieceView[];
};

export type CatalogChoice = {
  id: string;
  name: string;
  kind: string;
  supplierName: string;
  costLabel: string;
};

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm transition-colors duration-150 focus-visible:border-ring focus-visible:outline-none";
const cellClass = "px-2 py-2 align-middle";
const numberCell = `${cellClass} text-right tabular-nums whitespace-nowrap`;
const headClass = "bg-surface-2 px-2 py-2 font-medium";
const detailsClass = "rounded-md border border-border p-3 transition-colors duration-150 hover:bg-muted/30";

export function ProjectLines({
  projectId,
  lines,
  products,
  suppliers,
}: {
  projectId: string;
  lines: OperationLine[];
  products: CatalogChoice[];
  suppliers: Array<{ id: string; name: string }>;
}) {
  const figures = lines.map((line) => saleLineFigures(line));
  const totals = saleOperationTotals(figures);
  const names = suppliers.map((supplier) => supplier.name);

  return (
    <section id="produits" className="flex h-full min-h-0 flex-col gap-3">
      <p className="shrink-0 text-sm text-muted-foreground">
        Le prix de vente HT vient du coût, du taux de marque et de la remise. Les montants restent hors taxes.
      </p>
      <AddLineForm projectId={projectId} products={products} open={lines.length === 0} />
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun produit ni service sur ce dossier. Ajoutez-en un pour préparer le devis.
        </p>
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <caption className="sr-only">Lignes du dossier</caption>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className={`${headClass} w-8`}>
                    <span className="sr-only">Pour le devis</span>
                  </th>
                  <th className={headClass}>Désignation</th>
                  <th className={`${headClass} w-16 text-right`}>Qté</th>
                  <th className={`${headClass} w-24 text-right`}>Coût HT</th>
                  <th className={`${headClass} w-16 text-right`}>Marque %</th>
                  <th className={`${headClass} w-16 text-right`}>Remise %</th>
                  <th className={`${headClass} w-36`}>Fournisseur</th>
                  <th className={`${headClass} w-28 text-right`}>Vente HT</th>
                  <th className={`${headClass} w-24 text-right`}>Marge</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <LineRow key={line.id} line={line} figures={figures[index]!} names={names} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-2/60 font-medium">
                  <td className={cellClass} colSpan={3}>
                    Total des lignes chiffrées
                  </td>
                  <td className={numberCell}>{formatCents(totals.costCents)}</td>
                  <td className={cellClass} colSpan={3}>
                    {totals.missing > 0 ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {totals.missing} ligne{totals.missing > 1 ? "s" : ""} sans coût, hors total
                      </span>
                    ) : null}
                  </td>
                  <td className={numberCell}>{formatCents(totals.netCents)}</td>
                  <td className={numberCell}>{formatCents(totals.marginCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2">
            <UpdateLinesForm projectId={projectId} lines={lines} />
            <ConfirmLinesForm projectId={projectId} />
            <QuoteForm projectId={projectId} />
          </div>
        </>
      )}
    </section>
  );
}

export function ProjectDocuments({
  projectId,
  documents,
  suppliers,
}: {
  projectId: string;
  documents: OperationDocument[];
  suppliers: Array<{ id: string; name: string }>;
}) {
  const quotes = documents.filter((document) => document.kind === "devis" && document.status !== "non_abouti");
  const lost = documents.filter((document) => document.kind === "devis" && document.status === "non_abouti");
  const customerOrders = documents.filter((document) => document.kind === "commande_client");
  const supplierOrders = documents.filter((document) => document.kind === "commande_fournisseur");

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <p className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>Un devis s’établit depuis Produits. La commande client s’ouvre depuis un devis en cours.</span>
        <Link href={`/projets/${projectId}/facture`} className="font-medium text-foreground underline-offset-4 hover:underline">
          Voir la facture client
        </Link>
      </p>
      <div className="relative grid min-h-0 flex-1 gap-3 overflow-auto @4xl:grid-cols-2 @4xl:grid-rows-[minmax(0,1fr)] @4xl:overflow-hidden">
        <div className="relative grid min-h-0 content-start gap-4 @4xl:overflow-auto @4xl:pr-1">
          <DocumentList
            id="devis"
            suppliers={suppliers}
            title="Devis"
            empty="Aucun devis pour ce projet. Cochez des lignes dans Produits, puis établissez le devis."
            projectId={projectId}
            documents={quotes}
          />
          {lost.length > 0 ? (
            <details id="devis-non-aboutis" className={detailsClass}>
              <summary className="cursor-pointer text-sm font-medium">Devis non aboutis · {lost.length}</summary>
              <div className="pt-3">
                <DocumentList suppliers={suppliers} title="" empty="" projectId={projectId} documents={lost} />
              </div>
            </details>
          ) : null}
        </div>
        <div className="relative grid min-h-0 content-start gap-4 @4xl:overflow-auto @4xl:pr-1">
          <DocumentList
            id="commandes-client"
            suppliers={suppliers}
            title="Commandes client"
            empty="Aucune commande client. Elle s’ouvre depuis un devis en cours."
            projectId={projectId}
            documents={customerOrders}
          />
          <DocumentList
            id="commandes-fournisseur"
            suppliers={suppliers}
            title="Commandes fournisseur"
            empty="Aucune commande fournisseur. Elle s’ouvre depuis une commande client, avec un fournisseur nommé."
            projectId={projectId}
            documents={supplierOrders}
          />
        </div>
      </div>
    </div>
  );
}

function AddLineForm({ projectId, products, open }: { projectId: string; products: CatalogChoice[]; open: boolean }) {
  const [state, action, pending] = useActionState(addLineAction, initial);
  return (
    <details className={`shrink-0 ${detailsClass}`} open={open || undefined}>
      <summary className="cursor-pointer text-sm font-medium">Ajouter un produit du catalogue</summary>
      <form action={action} className="grid gap-2 pt-3">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,6rem))_auto] lg:items-end">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="productId">Produit ou service</Label>
            <select id="productId" name="productId" defaultValue="" required className={fieldClass}>
              <option value="">Choisir dans le catalogue</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.kind === "service" ? " · service" : ""}
                  {product.supplierName ? ` · ${product.supplierName}` : ""}
                  {product.costLabel ? ` · coût ${product.costLabel}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line-qty">Quantité</Label>
            <Input id="line-qty" name="quantity" defaultValue="1" inputMode="numeric" className="text-right" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line-markup">Marque %</Label>
            <Input id="line-markup" name="markup" defaultValue="30" inputMode="numeric" className="text-right" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line-discount">Remise %</Label>
            <Input id="line-discount" name="discount" defaultValue="0" inputMode="numeric" className="text-right" />
          </div>
          <Button type="submit" disabled={pending || products.length === 0}>
            {pending ? "Ajout…" : "Ajouter au projet"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ce catalogue est commun à tous les dossiers. Un produit nouveau se crée dans{" "}
          <Link href="/produits" className="font-medium text-foreground underline-offset-4 hover:underline">
            Produits
          </Link>
          .
        </p>
        <FormMessage state={state} />
      </form>
    </details>
  );
}

function LineRow({
  line,
  figures,
  names,
}: {
  line: OperationLine;
  figures: ReturnType<typeof saleLineFigures>;
  names: string[];
}) {
  const discounted = figures.unitListCents !== null && figures.unitListCents !== figures.unitNetCents;
  return (
    <tr className="border-b border-border transition-colors duration-150 last:border-0 hover:bg-surface-2/50">
      <td className={cellClass}>
        <input
          form="project-quote"
          type="checkbox"
          name="lineId"
          value={line.id}
          className="size-4"
          aria-label={`Mettre ${line.name} dans le devis`}
        />
      </td>
      <td className={`${cellClass} max-w-0`}>
        <span className="block truncate font-medium" title={line.name}>
          {line.name}
        </span>
        <span
          className="block truncate text-xs text-muted-foreground"
          title={line.confirmedLabel ? `Confirmé le ${line.confirmedLabel}` : "Non confirmé"}
        >
          {line.kind === "service" ? "Service" : "Produit"} · {line.confirmedLabel ? `confirmé le ${line.confirmedLabel.split(" ")[0]}` : "non confirmé"}
        </span>
      </td>
      <td className={cellClass}>
        <CellInput label={`Quantité de ${line.name}`} name={`qty_${line.id}`} form="project-lines" defaultValue={String(line.quantity)} />
      </td>
      <td className={cellClass}>
        <CellInput label={`Coût HT de ${line.name}`} name={`cost_${line.id}`} form="project-lines" defaultValue={centsInput(line.costCents)} />
      </td>
      <td className={cellClass}>
        <CellInput label={`Marque de ${line.name}`} name={`markup_${line.id}`} form="project-lines" defaultValue={String(line.markupPercent)} />
      </td>
      <td className={cellClass}>
        <CellInput label={`Remise de ${line.name}`} name={`discount_${line.id}`} form="project-lines" defaultValue={String(line.discountPercent)} />
      </td>
      <td className={cellClass}>
        <NameSelect label={`Fournisseur de ${line.name}`} name={`supplier_${line.id}`} form="project-lines" value={line.supplierName} names={names} />
      </td>
      <td className={numberCell}>
        {formatCents(figures.lineNetCents)}
        {discounted ? (
          <span className="block text-xs text-muted-foreground">
            avant remise {formatCents(figures.lineCostCents === null ? null : figures.unitListCents! * line.quantity)}
          </span>
        ) : null}
      </td>
      <td className={numberCell}>{formatCents(figures.lineMarginCents)}</td>
    </tr>
  );
}

function CellInput({
  label,
  name,
  form,
  defaultValue,
}: {
  label: string;
  name: string;
  form: string;
  defaultValue: string;
}) {
  return (
    <input
      aria-label={label}
      id={name}
      name={name}
      form={form}
      defaultValue={defaultValue}
      inputMode="decimal"
      className={`${fieldClass} text-right tabular-nums`}
    />
  );
}

function NameSelect({
  label,
  name,
  form,
  value,
  names,
}: {
  label: string;
  name: string;
  form: string;
  value: string;
  names: string[];
}) {
  const options = value && !names.includes(value) ? [value, ...names] : names;
  return (
    <select aria-label={label} id={name} name={name} form={form} defaultValue={value} className={fieldClass}>
      <option value="">Non nommé</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function UpdateLinesForm({ projectId, lines }: { projectId: string; lines: OperationLine[] }) {
  const [state, action, pending] = useActionState(updateLinesAction, initial);
  return (
    <form id="project-lines" action={action} className="grid gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      {lines.map((line) => (
        <input key={line.id} type="hidden" name="existingId" value={line.id} />
      ))}
      <Button type="submit" disabled={pending}>
        {pending ? "Actualisation…" : "Actualiser les chiffres"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

function ConfirmLinesForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(confirmLinesAction, initial);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Confirmation…" : "Confirmer les chiffres du dossier"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

function QuoteForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(quoteAction, initial);
  return (
    <form id="project-quote" action={action} className="ml-auto grid gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="quote-title" className="sr-only">
          Titre du devis
        </Label>
        <Input id="quote-title" name="title" placeholder="Titre du devis" className="w-56" />
        <Button type="submit" disabled={pending}>
          {pending ? "Établissement…" : "Établir le devis"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Cochez les lignes. Le devis reprend leurs chiffres à cet instant.</p>
      <FormMessage state={state} />
    </form>
  );
}

function DocumentList({
  id,
  title,
  empty,
  projectId,
  documents,
  suppliers,
}: {
  id?: string;
  title: string;
  empty: string;
  projectId: string;
  documents: OperationDocument[];
  suppliers: Array<{ id: string; name: string }>;
}) {
  return (
    <section id={id} className="grid gap-2">
      {title ? (
        <h2 className="text-base font-semibold">
          {title}
          {documents.length > 0 ? <span className="font-normal text-muted-foreground"> · {documents.length}</span> : null}
        </h2>
      ) : null}
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {documents.map((document) => (
            <DocumentCard key={document.id} projectId={projectId} document={document} suppliers={suppliers} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentCard({
  projectId,
  document,
  suppliers,
}: {
  projectId: string;
  document: OperationDocument;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const formId = `doc-${document.id}`;
  const figures = document.lines.map((line) => storedSaleFigures(line));
  const totals = saleOperationTotals(figures);
  const editable = (document.status === "en_cours" || document.status === "brouillon") && !document.confirmedLabel;
  return (
    <li className="grid gap-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{document.title}</p>
        <Badge variant="secondary">{saleKindLabel(document.kind)}</Badge>
        <StatusBadge tone={saleStatusTone(document.status)}>{saleStatusLabel(document.status)}</StatusBadge>
        <span className="text-xs text-muted-foreground">{document.createdLabel}</span>
        <Link
          href={`/projets/${projectId}/documents/${document.id}`}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Voir le document
        </Link>
      </div>
      {document.parent ? (
        <p className="text-sm">
          Issue de{" "}
          <Link href={`/projets/${projectId}/documents/${document.parent.id}`} className="font-medium underline-offset-4 hover:underline">
            {saleKindLabel(document.parent.kind)} · {document.parent.title}
          </Link>
        </p>
      ) : null}
      <PieceTree pieces={document.pieces} projectId={projectId} />
      {document.kind === "commande_client" || document.kind === "commande_fournisseur" ? (
        <AttachPiece
          projectId={projectId}
          saleParentId={document.id}
          pieceParentId=""
          kinds={["livraison", "facture"]}
          summary="Rattacher une livraison ou une facture"
        />
      ) : null}
      {document.supplierName ? <p className="text-sm">Fournisseur {document.supplierName}</p> : null}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className={`w-full border-collapse text-sm ${editable ? "min-w-[34rem]" : ""}`}>
          <caption className="sr-only">Lignes de {document.title}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className={headClass}>Désignation</th>
              <th className={`${headClass} ${editable ? "w-20" : "w-12"} text-right`}>Qté</th>
              <th className={`${headClass} ${editable ? "w-28" : "w-24"} text-right whitespace-nowrap`}>Coût HT</th>
              <th className={`${headClass} ${editable ? "w-20" : "w-16"} text-right`}>Marque</th>
              {editable ? <th className={`${headClass} w-20 text-right`}>Remise %</th> : null}
              <th className={`${headClass} w-24 text-right whitespace-nowrap`}>Vente HT</th>
              <th className={`${headClass} w-24 text-right`}>Marge</th>
            </tr>
          </thead>
          <tbody>
            {document.lines.map((line, index) => (
              <tr key={line.id} className="border-b border-border last:border-0">
                <td className={cellClass}>
                  <span className="font-medium">{line.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {line.kind === "service" ? "Service" : "Produit"}
                    {line.supplierName ? ` · ${line.supplierName}` : ""}
                  </span>
                </td>
                {editable ? (
                  <>
                    <td className={cellClass}>
                      <CellInput label={`Quantité de ${line.name}`} name={`qty_${line.id}`} form={formId} defaultValue={String(line.quantity)} />
                    </td>
                    <td className={cellClass}>
                      <CellInput label={`Coût HT de ${line.name}`} name={`cost_${line.id}`} form={formId} defaultValue={centsInput(line.costCents)} />
                    </td>
                    <td className={cellClass}>
                      <CellInput label={`Marque de ${line.name}`} name={`markup_${line.id}`} form={formId} defaultValue={String(line.markupPercent)} />
                    </td>
                    <td className={cellClass}>
                      <CellInput label={`Remise de ${line.name}`} name={`discount_${line.id}`} form={formId} defaultValue={String(line.discountPercent)} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className={numberCell}>{line.quantity}</td>
                    <td className={numberCell}>{formatCents(line.costCents === null ? null : line.costCents * line.quantity)}</td>
                    <td className={numberCell}>{line.markupPercent} %</td>
                  </>
                )}
                <td className={numberCell}>{formatCents(figures[index]?.lineNetCents ?? null)}</td>
                <td className={numberCell}>{formatCents(figures[index]?.lineMarginCents ?? null)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface-2/60 font-medium">
              <td className={cellClass} colSpan={2}>
                Total
              </td>
              <td className={numberCell}>{formatCents(totals.missing > 0 ? null : totals.costCents)}</td>
              <td className={cellClass} colSpan={editable ? 2 : 1} />
              <td className={numberCell}>{formatCents(totals.missing > 0 ? null : totals.netCents)}</td>
              <td className={numberCell}>{formatCents(totals.missing > 0 ? null : totals.marginCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {document.confirmedLabel ? `Chiffres confirmés le ${document.confirmedLabel}.` : "Chiffres non confirmés."}
      </p>
      {editable ? <DocumentUpdateForm formId={formId} projectId={projectId} document={document} /> : null}
      <div className="flex flex-wrap gap-2">
        {document.status === "en_cours" && !document.confirmedLabel ? (
          <SimpleDocumentForm projectId={projectId} documentId={document.id} action={confirmDocumentAction} label="Confirmer les chiffres" />
        ) : null}
        {document.status === "en_cours" && document.confirmedLabel ? (
          <SimpleDocumentForm projectId={projectId} documentId={document.id} action={reopenDocumentAction} label="Reprendre les chiffres" />
        ) : null}
        {document.kind === "devis" && document.status === "en_cours" ? (
          <>
            <SimpleDocumentForm projectId={projectId} documentId={document.id} action={customerOrderAction} label="Ouvrir la commande client" />
            <SimpleDocumentForm projectId={projectId} documentId={document.id} action={loseQuoteAction} label="Marquer non abouti" />
          </>
        ) : null}
      </div>
      {document.kind === "commande_client" && document.status === "en_cours" ? (
        <SupplierOrderForm projectId={projectId} documentId={document.id} suppliers={suppliers} />
      ) : null}
    </li>
  );
}

function PieceTree({ pieces, projectId }: { pieces: NotedPieceView[]; projectId: string }) {
  if (pieces.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {pieces.map((piece) => (
        <li key={piece.id} className="grid gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-sm">
            {notedPieceLabel(piece.kind)} · {piece.reference}
            <span className="text-muted-foreground"> · référence recopiée, sans numéro attribué</span>
          </p>
          <PieceTree pieces={piece.children} projectId={projectId} />
          {piece.kind === "livraison" ? (
            <AttachPiece
              projectId={projectId}
              saleParentId=""
              pieceParentId={piece.id}
              kinds={["facture"]}
              summary="Rattacher une facture"
            />
          ) : null}
          {piece.kind === "facture" ? (
            <AttachPiece
              projectId={projectId}
              saleParentId=""
              pieceParentId={piece.id}
              kinds={["avoir"]}
              summary="Rattacher un avoir"
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AttachPiece({
  projectId,
  saleParentId,
  pieceParentId,
  kinds,
  summary,
}: {
  projectId: string;
  saleParentId: string;
  pieceParentId: string;
  kinds: Array<"livraison" | "facture" | "avoir">;
  summary: string;
}) {
  const [state, action, pending] = useActionState(attachNotedPieceAction, initial);
  const [reference, setReference] = useState("");
  const ready = reference.trim().length >= 2;
  return (
    <details className={detailsClass}>
      <summary className="cursor-pointer text-sm font-medium">{summary}</summary>
      <form action={action} className="grid max-w-md gap-2 pt-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="saleParentId" value={saleParentId} />
        <input type="hidden" name="pieceParentId" value={pieceParentId} />
        {kinds.length > 1 ? (
          <div className="grid gap-1">
            <Label htmlFor={`kind-${saleParentId || pieceParentId}`}>Pièce</Label>
            <select id={`kind-${saleParentId || pieceParentId}`} name="kind" className={fieldClass}>
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {notedPieceLabel(kind)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="kind" value={kinds[0]} />
        )}
        <div className="grid gap-1">
          <Label htmlFor={`ref-${saleParentId || pieceParentId}`}>Référence écrite sur la pièce</Label>
          <Input
            id={`ref-${saleParentId || pieceParentId}`}
            name="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            maxLength={80}
          />
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Cette référence est recopiée. L’application ne l’invente pas et n’émet pas la pièce.
        </p>
        <Button type="submit" disabled={!ready || pending} className="w-fit">
          {pending ? "Enregistrement…" : "Rattacher"}
        </Button>
        <FormMessage state={state} />
      </form>
    </details>
  );
}

function DocumentUpdateForm({
  formId,
  projectId,
  document,
}: {
  formId: string;
  projectId: string;
  document: OperationDocument;
}) {
  const [state, action, pending] = useActionState(updateDocumentAction, initial);
  return (
    <form id={formId} action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="documentId" value={document.id} />
      {document.lines.map((line) => (
        <input key={line.id} type="hidden" name="existingId" value={line.id} />
      ))}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Actualisation…" : "Actualiser ce document"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

function SimpleDocumentForm({
  projectId,
  documentId,
  action,
  label,
}: {
  projectId: string;
  documentId: string;
  action: (previous: SaleState, formData: FormData) => Promise<SaleState>;
  label: string;
}) {
  const [state, dispatch, pending] = useActionState(action, initial);
  return (
    <form action={dispatch} className="grid gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="documentId" value={documentId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "En cours…" : label}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

function SupplierOrderForm({
  projectId,
  documentId,
  suppliers,
}: {
  projectId: string;
  documentId: string;
  suppliers: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(supplierOrderAction, initial);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="documentId" value={documentId} />
      <div className="grid gap-2">
        <Label htmlFor={`supplier-${documentId}`}>Fournisseur si la ligne n’en a pas</Label>
        <select id={`supplier-${documentId}`} name="supplierName" defaultValue="" className={fieldClass}>
          <option value="">Choisir un fournisseur</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.name}>
              {supplier.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Ouverture…" : "Établir la commande fournisseur"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
