"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  addLineAction,
  confirmDocumentAction,
  confirmLinesAction,
  customerOrderAction,
  loseQuoteAction,
  quoteAction,
  reopenDocumentAction,
  supplierOrderAction,
  updateDocumentAction,
  updateLinesAction,
  type SaleState,
} from "@/app/projets/sale-actions";
import { FormMessage } from "@/components/party-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsInput, formatCents, saleLineFigures, saleOperationTotals } from "@/domain/pricing";
import { saleKindLabel, saleStatusLabel } from "@/domain/sale-line";

const initial: SaleState = { message: null, ok: false };

export type OperationLine = {
  id: string;
  name: string;
  kind: string;
  supplierName: string;
  quantity: number;
  costCents: number | null;
  markupPercent: number;
  discountPercent: number;
  confirmedLabel: string | null;
};

export type OperationDocument = {
  id: string;
  kind: string;
  status: string;
  title: string;
  supplierName: string;
  createdLabel: string;
  confirmedLabel: string | null;
  lines: OperationLine[];
};

export type CatalogChoice = {
  id: string;
  name: string;
  kind: string;
  supplierName: string;
  costLabel: string;
};

const fieldClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function ProjectOperation({
  projectId,
  lines,
  documents,
  products,
  suppliers,
}: {
  projectId: string;
  lines: OperationLine[];
  documents: OperationDocument[];
  products: CatalogChoice[];
  suppliers: Array<{ id: string; name: string }>;
}) {
  const quotes = documents.filter((document) => document.kind === "devis" && document.status !== "non_abouti");
  const lost = documents.filter((document) => document.kind === "devis" && document.status === "non_abouti");
  const customerOrders = documents.filter((document) => document.kind === "commande_client");
  const supplierOrders = documents.filter((document) => document.kind === "commande_fournisseur");
  const figures = lines.map((line) => saleLineFigures(line));
  const totals = saleOperationTotals(figures);

  return (
    <div className="grid gap-6">
      <section id="produits" className="grid scroll-mt-6 gap-3">
        <h2 className="text-lg font-semibold">Produits et services</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Le catalogue est le même pour tous les dossiers. Le prix de vente HT vient du coût du produit, du taux de marque et de la remise. La marge se modifie ici, puis se confirme. Les montants restent hors taxes.
        </p>
        <AddLineForm projectId={projectId} products={products} />
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun produit ni service sur ce dossier. Ajoutez-en un pour préparer le devis.
          </p>
        ) : (
          <div className="grid gap-3">
            <ul className="grid gap-3">
              {lines.map((line, index) => (
                <LineEditor
                  key={line.id}
                  line={line}
                  figures={figures[index]!}
                  quoteForm="project-quote"
                  updateForm="project-lines"
                  suppliers={suppliers}
                />
              ))}
            </ul>
            <p className="text-sm leading-6">
              Total des lignes chiffrées : coût {formatCents(totals.costCents)}, prix de vente {formatCents(totals.netCents)}, marge {formatCents(totals.marginCents)}.
              {totals.missing > 0
                ? ` ${totals.missing} ligne${totals.missing > 1 ? "s" : ""} sans coût, prix de vente non calculé.`
                : ""}
            </p>
            <UpdateLinesForm projectId={projectId} lines={lines} />
            <ConfirmLinesForm projectId={projectId} />
            <QuoteForm projectId={projectId} />
          </div>
        )}
      </section>

      <DocumentList
        id="devis"
        suppliers={suppliers}
        title="Devis"
        empty="Aucun devis pour ce projet. Sélectionnez une ou plusieurs lignes, puis établissez le devis."
        projectId={projectId}
        documents={quotes}
      />
      <DocumentList
        id="devis-non-aboutis"
        suppliers={suppliers}
        title="Devis non aboutis"
        empty="Aucun devis non abouti."
        projectId={projectId}
        documents={lost}
      />
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
      <p className="text-sm">
        <Link href={`/projets/${projectId}/facture`} className="font-medium underline-offset-4 hover:underline">
          Voir la facture client
        </Link>
      </p>
      <p className="text-sm text-muted-foreground">
        Les pièces déjà enregistrées sur le dossier restent dans l’actualité. Le{" "}
        <Link href="/ventes" className="font-medium text-foreground underline-offset-4 hover:underline">
          simulateur de prix
        </Link>{" "}
        ne crée pas de devis.
      </p>
    </div>
  );
}

function AddLineForm({ projectId, products }: { projectId: string; products: CatalogChoice[] }) {
  const [state, action, pending] = useActionState(addLineAction, initial);
  return (
    <form action={action} className="grid gap-3 rounded-lg border border-border p-3">
      <input type="hidden" name="projectId" value={projectId} />
      <p className="text-sm font-medium">Ajouter un produit du catalogue</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
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
          <p className="text-xs leading-5 text-muted-foreground">
            Ce catalogue est commun à tous les dossiers. Un produit nouveau se crée dans{" "}
            <Link href="/produits" className="font-medium text-foreground underline-offset-4 hover:underline">
              Produits
            </Link>
            .
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="line-qty">Quantité</Label>
          <Input id="line-qty" name="quantity" defaultValue="1" inputMode="numeric" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="line-markup">Taux de marque (%)</Label>
          <Input id="line-markup" name="markup" defaultValue="30" inputMode="numeric" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="line-discount">Remise (%)</Label>
          <Input id="line-discount" name="discount" defaultValue="0" inputMode="numeric" />
        </div>
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending || products.length === 0} className="min-h-11 w-fit px-4">
        {pending ? "Ajout…" : "Ajouter au projet"}
      </Button>
    </form>
  );
}

function LineEditor({
  line,
  figures,
  quoteForm,
  updateForm,
  suppliers,
}: {
  line: OperationLine;
  figures: ReturnType<typeof saleLineFigures>;
  quoteForm: string;
  updateForm: string;
  suppliers: Array<{ id: string; name: string }>;
}) {
  return (
    <li className="grid gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input form={quoteForm} type="checkbox" name="lineId" value={line.id} className="size-4" />
          {line.name}
        </label>
        <Badge variant="secondary">{line.kind === "service" ? "Service" : "Produit"}</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Quantité" name={`qty_${line.id}`} form={updateForm} defaultValue={String(line.quantity)} />
        <Field label="Coût HT" name={`cost_${line.id}`} form={updateForm} defaultValue={centsInput(line.costCents)} />
        <Field label="Marque %" name={`markup_${line.id}`} form={updateForm} defaultValue={String(line.markupPercent)} />
        <Field label="Remise %" name={`discount_${line.id}`} form={updateForm} defaultValue={String(line.discountPercent)} />
        <NameSelect
          label="Fournisseur"
          name={`supplier_${line.id}`}
          form={updateForm}
          value={line.supplierName}
          names={suppliers.map((supplier) => supplier.name)}
        />
      </div>
      <p className="text-sm leading-6">
        Prix de vente HT {formatCents(figures.lineNetCents)}
        {figures.unitListCents !== null && figures.unitListCents !== figures.unitNetCents
          ? ` · avant remise ${formatCents(figures.lineCostCents === null ? null : figures.unitListCents! * line.quantity)}`
          : ""}
        {" · "}marge {formatCents(figures.lineMarginCents)}
        {line.confirmedLabel ? ` · confirmé le ${line.confirmedLabel}` : " · non confirmé"}
      </p>
    </li>
  );
}

function Field({
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
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <input id={name} name={name} form={form} defaultValue={defaultValue} className={fieldClass} />
    </div>
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
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} form={form} defaultValue={value} className={fieldClass}>
        <option value="">Non nommé</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function UpdateLinesForm({ projectId, lines }: { projectId: string; lines: OperationLine[] }) {
  const [state, action, pending] = useActionState(updateLinesAction, initial);
  return (
    <form id="project-lines" action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      {lines.map((line) => (
        <input key={line.id} type="hidden" name="existingId" value={line.id} />
      ))}
      <Button type="submit" disabled={pending} className="min-h-11 px-4">
        {pending ? "Actualisation…" : "Actualiser les chiffres"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

function ConfirmLinesForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(confirmLinesAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11 px-4">
        {pending ? "Confirmation…" : "Confirmer les chiffres du dossier"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}

function QuoteForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(quoteAction, initial);
  return (
    <form id="project-quote" action={action} className="grid gap-3 rounded-lg bg-muted p-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-2">
        <Label htmlFor="quote-title">Titre du devis</Label>
        <Input id="quote-title" name="title" placeholder="Devis atelier" />
      </div>
      <p className="text-sm text-muted-foreground">
        Cochez une ou plusieurs lignes. Le devis reprend leur coût, leur prix de vente et leur marge à cet instant.
      </p>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Établissement…" : "Établir le devis"}
      </Button>
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
  id: string;
  title: string;
  empty: string;
  projectId: string;
  documents: OperationDocument[];
  suppliers: Array<{ id: string; name: string }>;
}) {
  return (
    <section id={id} className="grid scroll-mt-6 gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-3">
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
  const figures = document.lines.map((line) => saleLineFigures(line));
  const totals = saleOperationTotals(figures);
  const editable = document.status === "en_cours" && !document.confirmedLabel;
  return (
    <li className="grid gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{document.title}</p>
        <Badge variant="secondary">{saleKindLabel(document.kind)}</Badge>
        <Badge variant="outline">{saleStatusLabel(document.status)}</Badge>
        <span className="text-xs text-muted-foreground">{document.createdLabel}</span>
        <Link
          href={`/projets/${projectId}/documents/${document.id}`}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Voir le document
        </Link>
      </div>
      {document.supplierName ? <p className="text-sm">Fournisseur {document.supplierName}</p> : null}
      <ul className="grid gap-2">
        {document.lines.map((line, index) => (
          <li key={line.id} className="grid gap-2 text-sm leading-6">
            <p>
              {line.kind === "service" ? "Service" : "Produit"} {line.name}
              {line.supplierName ? ` · ${line.supplierName}` : ""}
            </p>
            {editable ? (
              <div className="grid gap-2 sm:grid-cols-4">
                <Field label="Quantité" name={`qty_${line.id}`} form={formId} defaultValue={String(line.quantity)} />
                <Field label="Coût HT" name={`cost_${line.id}`} form={formId} defaultValue={centsInput(line.costCents)} />
                <Field label="Marque %" name={`markup_${line.id}`} form={formId} defaultValue={String(line.markupPercent)} />
                <Field label="Remise %" name={`discount_${line.id}`} form={formId} defaultValue={String(line.discountPercent)} />
              </div>
            ) : (
              <p>
                Quantité {line.quantity} · coût {formatCents(line.costCents === null ? null : line.costCents * line.quantity)} · marque {line.markupPercent} %
              </p>
            )}
            <p>
              Prix de vente HT {formatCents(figures[index]?.lineNetCents ?? null)} · marge {formatCents(figures[index]?.lineMarginCents ?? null)}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Total : coût {formatCents(totals.missing > 0 ? null : totals.costCents)}, prix de vente {formatCents(totals.missing > 0 ? null : totals.netCents)}, marge {formatCents(totals.missing > 0 ? null : totals.marginCents)}.
        {document.confirmedLabel ? ` Chiffres confirmés le ${document.confirmedLabel}.` : " Chiffres non confirmés."}
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
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11 px-4">
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
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11 px-4">
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
      <Button type="submit" disabled={pending} className="min-h-11 px-4">
        {pending ? "Ouverture…" : "Établir la commande fournisseur"}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
