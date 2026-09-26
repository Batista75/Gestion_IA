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

const emptyState: FormState = { message: null, ok: false };

export type ProductVersionView = {
  id: string;
  quoteId: string;
  quoteTitle: string;
  versionLabel: string;
  issuedOn: string;
  supplierName: string;
  statedPrice: string;
  conditions: string;
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
  vatNote: string;
  kind: string;
  updatedLabel: string;
  versions: ProductVersionView[];
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
}: {
  query: string;
  source: string;
  records: ProductRecord[];
  createAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  updateAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  deleteQuoteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  quoteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Le catalogue réunit les saisies manuelles, les produits cités dans un
          devis et ceux ajoutés par l’assistant. Un même produit peut porter
          plusieurs devis : chaque prix et chaque condition restent une version.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form action="/produits" className="flex flex-col gap-2 sm:flex-row">
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
        </form>
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
              Un fournisseur inconnu est créé en même temps.
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
                  {record.statedPrice ? (
                    <p className="text-sm">
                      Prix unitaire indiqué {record.statedPrice}
                      {record.vatNote ? ` · TVA indiquée ${record.vatNote}` : ""}
                      {record.kind === "service" ? " · service" : ""}
                    </p>
                  ) : null}
                  <p className="text-sm">{record.origin}</p>
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
                                ? `Prix indiqué ${version.statedPrice}`
                                : "Prix non indiqué"}
                            </p>
                            {version.conditions ? <p>Conditions : {version.conditions}</p> : null}
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
                    Mis à jour le {record.updatedLabel}
                  </p>
                  <ConfirmDelete
                    action={deleteAction}
                    id={record.id}
                    label="Supprimer le produit"
                    confirm={`Supprimer ${record.name} ? Les lignes de devis de ce produit sont retirées.`}
                  />
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">
                      Modifier
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
      <TextField prefix={prefix} label="Nom" name="name" required defaultValue={record?.name} />
      <TextField prefix={prefix} label="Référence" name="reference" defaultValue={record?.reference} />
      <TextField prefix={prefix} label="Unité" name="unit" defaultValue={record?.unit} />
      <TextField
        prefix={prefix}
        label="Fournisseur"
        name="supplierName"
        defaultValue={record?.supplierName}
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
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
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
