"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/catalog-actions";
import { FormMessage } from "@/components/party-manager";
import { ConfirmDelete } from "@/components/record-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { writtenCurrency } from "@/domain/article";

const emptyState: FormState = { message: null, ok: false };

export type ProductVersionView = {
  id: string;
  quoteId: string;
  quoteTitle: string;
  versionLabel: string;
  issuedOn: string;
  supplierName: string;
  statedPrice: string;
  centsLabel: string;
  conditions: string;
  fileId: string;
  fileName: string;
};

export type SourceDocument = {
  id: string;
  name: string;
};

export type ProductOfferView = {
  id: string;
  supplierName: string;
  statedCost: string;
  centsLabel: string;
  fileId: string;
  fileName: string;
  sourceUrl: string;
  at: string;
};

export type ProductRecord = {
  id: string;
  name: string;
  reference: string;
  unit: string;
  description: string;
  supplierName: string;
  origin: string;
  statedPrice: string;
  costStated: string;
  currency: string;
  vatNote: string;
  kind: string;
  stockQty: number | null;
  sourceNote: string;
  sourceUrl: string;
  documents: SourceDocument[];
  enteredLabel: string;
  updatedLabel: string;
  versions: ProductVersionView[];
  offers: ProductOfferView[];
};

const filters = [
  { source: "", label: "Tous" },
  { source: "devis", label: "Issus d’un devis" },
  { source: "assistant", label: "Saisis par l’assistant" },
  { source: "manuel", label: "Saisie manuelle" },
];

export function ProductManager({
  query,
  source,
  records,
  createAction,
  updateAction,
  deleteAction,
  deleteQuoteAction,
  quoteAction,
  showHeading = true,
  showFinder = true,
  edition = "",
}: {
  query: string;
  source: string;
  records: ProductRecord[];
  createAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  updateAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  deleteQuoteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  quoteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  showHeading?: boolean;
  showFinder?: boolean;
  edition?: string;
}) {
  return (
    <div className="grid gap-6">
      {showHeading ? (
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Le catalogue réunit les saisies manuelles, les produits cités dans un
          devis et ceux ajoutés par l’assistant. Un produit peut avoir plusieurs
          offres fournisseurs : chaque prix reste à part.
        </p>
      </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {showFinder ? <form action="/produits" className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="source" value={source} />
          <Label htmlFor="product-q" className="sr-only">
            Rechercher
          </Label>
          <Input
            id="product-q"
            name="q"
            defaultValue={query}
            placeholder="Nom ou référence"
            className="h-11 sm:max-w-sm"
          />
          <Button type="submit" variant="outline" className="min-h-11 px-4">
            Rechercher
          </Button>
        </form> : null}
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const href = filter.source
              ? `/produits?source=${filter.source}`
              : "/produits";
            const active = source === filter.source;
            return (
              <Link
                key={filter.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saisie manuelle</CardTitle>
            <CardDescription>
              Un fournisseur inconnu est créé en même temps. Sans pièce, une note ou un lien vers le site du fournisseur suffit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductFields action={createAction} submitLabel="Ajouter le produit" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Issu d’un devis</CardTitle>
            <CardDescription>
              Un produit par ligne. Le devis est conservé et les produits
              entrent au catalogue. Un nouveau devis du même produit ajoute une
              version, il ne remplace pas le prix déjà indiqué.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuoteFields action={quoteAction} />
          </CardContent>
        </Card>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            {query || source
              ? "Aucun produit ne correspond à ce filtre."
              : "Aucun produit au catalogue."}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {records.map((record) => (
            <li key={record.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{record.name}</CardTitle>
                  <CardDescription>
                    {[record.reference, record.unit, record.supplierName]
                      .filter(Boolean)
                      .join(" · ") || "Sans référence"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {record.description ? (
                    <p className="text-sm leading-6">{record.description}</p>
                  ) : null}
                  <ArticleFacts record={record} />
                  <p className="text-sm">{record.origin}</p>
                  <SourceBlock record={record} />
                  <OfferBlock record={record} />
                  {record.versions.length > 0 ? (
                    <div className="grid gap-2">
                      <p className="text-sm font-medium">Versions de devis</p>
                      <ul className="grid gap-2">
                        {record.versions.map((version) => (
                          <li key={version.id} className="rounded-lg bg-muted px-3 py-2 text-sm leading-6">
                            <p className="font-medium break-words">
                              {version.versionLabel || version.quoteTitle}
                            </p>
                            {version.supplierName ? <p>{version.supplierName}</p> : null}
                            <p>
                              {version.statedPrice
                                ? `Coût unitaire ${version.statedPrice}${version.centsLabel ? ` · ${version.centsLabel}` : ""}`
                                : "Coût unitaire non indiqué"}
                            </p>
                            {version.conditions ? <p>Conditions : {version.conditions}</p> : null}
                            {version.fileId ? (
                              <a
                                href={`/api/pieces/${version.fileId}`}
                                className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                              >
                                Consulter {version.fileName || "le document"}
                              </a>
                            ) : null}
                            <ConfirmDelete
                              action={deleteQuoteAction}
                              id={version.quoteId}
                              label="Supprimer cette version"
                              confirm="Supprimer cette version de devis ? Le produit reste au catalogue."
                            />
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        Chaque devis reste une version. Les prix et les conditions ne sont pas fusionnés.
                      </p>
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Saisi le {record.enteredLabel} · mis à jour le {record.updatedLabel}
                  </p>
                  <ConfirmDelete
                    action={deleteAction}
                    id={record.id}
                    label="Supprimer le produit"
                    confirm={`Supprimer ${record.name} ? Les lignes de devis de ce produit sont retirées.`}
                  />
                  <details id={record.id === edition ? "edition" : undefined} open={record.id === edition || undefined}>
                    <summary className="cursor-pointer text-sm font-medium">
                      Éditer
                    </summary>
                    <div className="pt-3">
                      <ProductFields
                        action={updateAction}
                        submitLabel="Enregistrer"
                        record={record}
                      />
                    </div>
                  </details>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductFields({
  action,
  submitLabel,
  record,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  record?: ProductRecord;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  const prefix = record?.id ?? "new-product";
  return (
    <form action={formAction} className="grid gap-3">
      {record ? <input type="hidden" name="id" value={record.id} /> : null}
      <TextField prefix={prefix} label="Désignation" name="name" required defaultValue={record?.name} />
      <TextField prefix={prefix} label="Référence" name="reference" defaultValue={record?.reference} />
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-kind`}>Famille</Label>
        <select
          id={`${prefix}-kind`}
          name="kind"
          defaultValue={record?.kind === "service" ? "service" : "produit"}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="produit">Produit</option>
          <option value="service">Service</option>
        </select>
      </div>
      <TextField prefix={prefix} label="Coût unitaire" name="costStated" defaultValue={record?.costStated} />
      <p className="text-xs leading-5 text-muted-foreground">
        Ce montant est enregistré comme une offre du fournisseur nommé. Un autre prix reste conservé.
      </p>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-currency`}>Devise</Label>
        <select
          id={`${prefix}-currency`}
          name="currency"
          defaultValue={record?.currency === "USD" ? "USD" : record?.currency === "EUR" ? "EUR" : ""}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Non indiquée</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <TextField prefix={prefix} label="Unité" name="unit" defaultValue={record?.unit} />
      <TextField
        prefix={prefix}
        label="Stock actuel"
        name="stockQty"
        defaultValue={record?.stockQty === null || record?.stockQty === undefined ? "" : String(record.stockQty)}
      />
      <TextField
        prefix={prefix}
        label="Fournisseur"
        name="supplierName"
        defaultValue={record?.supplierName}
      />
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-sourceNote`}>Note</Label>
        <Textarea
          id={`${prefix}-sourceNote`}
          name="sourceNote"
          defaultValue={record?.sourceNote}
          rows={2}
          placeholder="Origine de la saisie, si aucune pièce n’est jointe"
        />
      </div>
      <TextField
        prefix={prefix}
        label="Lien du fournisseur"
        name="sourceUrl"
        defaultValue={record?.sourceUrl}
      />
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-description`}>Description</Label>
        <Textarea
          id={`${prefix}-description`}
          name="description"
          defaultValue={record?.description}
          rows={3}
        />
      </div>
      {record ? <p className="text-sm text-muted-foreground">Date de saisie {record.enteredLabel}</p> : null}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}

function OfferBlock({ record }: { record: ProductRecord }) {
  return (
    <div className="grid gap-2 text-sm leading-6">
      <p className="font-medium">Offres fournisseurs</p>
      {record.offers.length === 0 ? (
        <p className="text-muted-foreground">Aucune offre fournisseur.</p>
      ) : (
        <ul className="grid gap-2">
          {record.offers.map((offer) => (
            <li key={offer.id} className="rounded-lg bg-muted px-3 py-2">
              <p className="font-medium">{offer.supplierName || "Fournisseur non nommé"}</p>
              <p>{offer.statedCost ? `Prix écrit ${offer.statedCost}` : "Prix non indiqué"}</p>
              {offer.centsLabel ? <p>Valeur retenue {offer.centsLabel}</p> : null}
              {offer.fileId ? (
                <a
                  href={`/api/pieces/${offer.fileId}`}
                  className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                >
                  Consulter {offer.fileName || "le document"}
                </a>
              ) : null}
              {offer.sourceUrl ? (
                <a
                  href={offer.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                >
                  Site du fournisseur
                </a>
              ) : null}
              <p className="text-xs text-muted-foreground">{offer.at}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceBlock({ record }: { record: ProductRecord }) {
  return (
    <div className="grid gap-1 text-sm leading-6">
      <p className="font-medium">Document source</p>
      {record.documents.length > 0 ? (
        <ul className="grid gap-1">
          {record.documents.map((document) => (
            <li key={document.id}>
              <a
                href={`/api/pieces/${document.id}`}
                className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
              >
                Consulter {document.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Aucun document source.</p>
      )}
      {record.sourceNote ? <p>Note : {record.sourceNote}</p> : null}
      {record.sourceUrl ? (
        <a
          href={record.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
        >
          Site du fournisseur
        </a>
      ) : null}
    </div>
  );
}

function ArticleFacts({ record }: { record: ProductRecord }) {
  const cost = record.costStated || record.versions.find((version) => version.statedPrice)?.statedPrice || "";
  const currency = record.currency || writtenCurrency(cost);
  return (
    <p className="text-sm">
      {record.kind === "service" ? "Service" : "Produit"}
      {" · "}
      {cost ? `Coût unitaire ${cost}` : "Coût unitaire non indiqué"}
      {currency ? ` · ${currency}` : ""}
      {` · saisi le ${record.enteredLabel}`}
    </p>
  );
}

function QuoteFields({
  action,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  return (
    <form action={formAction} className="grid gap-3">
      <TextField prefix="quote" label="Titre du devis" name="title" required />
      <TextField prefix="quote" label="Fournisseur" name="supplierName" />
      <div className="grid gap-2">
        <Label htmlFor="quote-products">Produits, un par ligne</Label>
        <Textarea
          id="quote-products"
          name="products"
          required
          rows={4}
          placeholder={"Vis à bois\nCharnière"}
        />
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : "Enregistrer le devis"}
      </Button>
    </form>
  );
}

function TextField({
  prefix,
  label,
  name,
  defaultValue,
  required,
}: {
  prefix: string;
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const id = `${prefix}-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="h-11"
      />
    </div>
  );
}
