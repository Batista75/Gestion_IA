"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/catalog-actions";
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

export type PartyRecord = {
  id: string;
  name: string;
  siren: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  updatedLabel: string;
  kind?: string;
  civility?: string;
  tradeName?: string;
  legalForm?: string;
  country?: string;
  postalCode?: string;
  city?: string;
  siret?: string;
  vatNumber?: string;
  contactName?: string;
  contactRole?: string;
};

export function PartyManager({
  title,
  intro,
  actionPath,
  query,
  records,
  noun,
  profile,
  createAction,
  updateAction,
}: {
  title?: string;
  intro: string;
  actionPath: string;
  query: string;
  records: PartyRecord[];
  noun: string;
  profile?: "client";
  createAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  updateAction: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  return (
    <div className="grid gap-6">
      {title ? (
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{intro}</p>
        </div>
      ) : (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{intro}</p>
      )}

      <form action={actionPath} className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor={`${actionPath}-q`} className="sr-only">
          Rechercher
        </Label>
        <Input
          id={`${actionPath}-q`}
          name="q"
          defaultValue={query}
          placeholder="Nom, e-mail ou SIREN"
          className="h-11 sm:max-w-sm"
        />
        <Button type="submit" variant="outline" className="min-h-11 px-4">
          Rechercher
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nouveau {noun}</CardTitle>
            <CardDescription>
              {profile === "client"
                ? "Ce formulaire enregistre tout de suite. L’assistant, lui, propose la fiche et attend votre accord."
                : "La même fiche peut être créée par l’assistant."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PartyFields
              action={createAction}
              submitLabel={`Créer le ${noun}`}
              profile={profile}
            />
          </CardContent>
        </Card>

        <section className="grid gap-3">
          {records.length === 0 ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">
                {query
                  ? `Aucun ${noun} ne correspond à cette recherche.`
                  : `Aucun ${noun} pour le moment.`}
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
                        {[
                          profile === "client" ? kindText(record.kind) : "",
                          record.country,
                          record.city,
                          record.email,
                          record.phone,
                          record.siren,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Aucun contact renseigné"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {record.tradeName || record.legalForm || record.vatNumber ? (
                        <p className="text-sm leading-6">
                          {[
                            record.tradeName ? `Enseigne ${record.tradeName}` : "",
                            record.legalForm,
                            record.vatNumber ? `TVA ${record.vatNumber}` : "",
                            record.siret ? `SIRET ${record.siret}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                      {record.contactName ? (
                        <p className="text-sm leading-6">
                          Contact {record.contactName}
                          {record.contactRole ? `, ${record.contactRole}` : ""}
                        </p>
                      ) : null}
                      {record.address ? (
                        <p className="text-sm leading-6">
                          {[record.address, record.postalCode, record.city]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      ) : null}
                      {record.notes ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {record.notes}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Mis à jour le {record.updatedLabel}
                      </p>
                      <details>
                        <summary className="cursor-pointer text-sm font-medium">
                          Modifier
                        </summary>
                        <div className="pt-3">
                          <PartyFields
                            action={updateAction}
                            submitLabel="Enregistrer"
                            record={record}
                            profile={profile}
                          />
                        </div>
                      </details>
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

function PartyFields({
  action,
  submitLabel,
  record,
  profile,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  record?: PartyRecord;
  profile?: "client";
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  const prefix = record?.id ?? "new";
  return (
    <form action={formAction} className="grid gap-3">
      {record ? <input type="hidden" name="id" value={record.id} /> : null}
      {profile === "client" ? (
        <>
          <Choice
            prefix={prefix}
            label="Type"
            name="kind"
            defaultValue={record?.kind ?? ""}
            options={[
              ["", "À qualifier"],
              ["particulier", "Particulier"],
              ["entreprise", "Entreprise"],
            ]}
          />
          <Choice
            prefix={prefix}
            label="Civilité"
            name="civility"
            defaultValue={record?.civility ?? ""}
            options={[
              ["", "—"],
              ["Madame", "Madame"],
              ["Monsieur", "Monsieur"],
            ]}
          />
        </>
      ) : null}
      <Field
        prefix={prefix}
        label={profile === "client" ? "Nom ou raison sociale" : "Nom"}
        name="name"
        required
        defaultValue={record?.name}
      />
      {profile === "client" ? (
        <>
          <Field prefix={prefix} label="Enseigne" name="tradeName" defaultValue={record?.tradeName} />
          <Field prefix={prefix} label="Forme juridique" name="legalForm" defaultValue={record?.legalForm} />
          <Field prefix={prefix} label="Pays" name="country" defaultValue={record?.country} />
          <Field prefix={prefix} label="SIREN" name="siren" defaultValue={record?.siren} />
          <Field prefix={prefix} label="SIRET" name="siret" defaultValue={record?.siret} />
          <Field prefix={prefix} label="N° de TVA" name="vatNumber" defaultValue={record?.vatNumber} />
          <Field prefix={prefix} label="Adresse" name="address" defaultValue={record?.address} />
          <Field prefix={prefix} label="Code postal" name="postalCode" defaultValue={record?.postalCode} />
          <Field prefix={prefix} label="Ville" name="city" defaultValue={record?.city} />
          <Field prefix={prefix} label="Contact" name="contactName" defaultValue={record?.contactName} />
          <Field prefix={prefix} label="Fonction du contact" name="contactRole" defaultValue={record?.contactRole} />
        </>
      ) : (
        <>
          <Field prefix={prefix} label="SIREN ou SIRET" name="siren" defaultValue={record?.siren} />
          <Field prefix={prefix} label="Adresse" name="address" defaultValue={record?.address} />
        </>
      )}
      <Field prefix={prefix} label="E-mail" name="email" type="email" defaultValue={record?.email} />
      <Field prefix={prefix} label="Téléphone" name="phone" defaultValue={record?.phone} />
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-notes`}>Notes</Label>
        <Textarea id={`${prefix}-notes`} name="notes" defaultValue={record?.notes} rows={3} />
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : submitLabel}
      </Button>
    </form>
  );
}

function Choice({
  prefix,
  label,
  name,
  defaultValue,
  options,
}: {
  prefix: string;
  label: string;
  name: string;
  defaultValue: string;
  options: Array<[string, string]>;
}) {
  const id = `${prefix}-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        {options.map(([value, text]) => (
          <option key={value || "empty"} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function kindText(kind: string | undefined): string {
  if (kind === "particulier") return "Particulier";
  if (kind === "entreprise") return "Entreprise";
  return "Non qualifié";
}

function Field({
  prefix,
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  prefix: string;
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  const id = `${prefix}-${name}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="h-11"
      />
    </div>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={state.ok ? "text-sm text-foreground" : "text-sm text-destructive"}
    >
      {state.message}
    </p>
  );
}
