"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveCompanyAction, type CompanyState } from "@/app/configuration/actions";
import { FormMessage } from "@/components/party-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyDraft } from "@/domain/company";

const initial: CompanyState = { message: null, ok: false };

export function CompanyForm({
  company,
}: {
  company: CompanyDraft & { hasLogo: boolean; logoUrl: string | null };
}) {
  const [state, action, pending] = useActionState(saveCompanyAction, initial);
  return (
    <form action={action} className="grid gap-4">
      <TextField id="legalName" name="legalName" label="Raison sociale" saved={company.legalName} placeholder="Atelier Nord" />
      <TextField id="address" name="address" label="Adresse" saved={company.address} placeholder="12 rue des Lilas" />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField id="postalCode" name="postalCode" label="Code postal" saved={company.postalCode} />
        <TextField id="city" name="city" label="Ville" saved={company.city} className="sm:col-span-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="country" name="country" label="Pays" saved={company.country} placeholder="France" />
        <TextField id="phone" name="phone" label="Téléphone" saved={company.phone} />
      </div>
      <TextField id="email" name="email" label="E-mail" saved={company.email} type="email" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="siren" name="siren" label="SIREN" saved={company.siren} inputMode="numeric" />
        <TextField id="vatNumber" name="vatNumber" label="Numéro de TVA" saved={company.vatNumber} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="logo">Logo</Label>
        {company.logoUrl ? (
          <img src={company.logoUrl} alt="Logo de l’entreprise" className="h-16 w-auto max-w-full object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">Aucun logo enregistré.</p>
        )}
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
        />
        <p className="text-xs leading-5 text-muted-foreground">PNG, JPEG ou WebP, 2 Mo au plus. Il apparaît en tête des documents.</p>
        {company.hasLogo ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="clearLogo" className="size-4" />
            Retirer le logo
          </label>
        ) : null}
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : "Enregistrer l’entreprise"}
      </Button>
    </form>
  );
}

function TextField({
  id,
  name,
  label,
  saved,
  className,
  type,
  placeholder,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  saved: string;
  className?: string;
  type?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [value, setValue] = useState(saved);
  const [source, setSource] = useState(saved);
  if (source !== saved) {
    setSource(saved);
    setValue(saved);
  }
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        value={value}
        onValueChange={setValue}
        placeholder={placeholder}
        className="h-11"
      />
    </div>
  );
}
