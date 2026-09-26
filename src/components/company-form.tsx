"use client";

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
      <div className="grid gap-2">
        <Label htmlFor="legalName">Raison sociale</Label>
        <Input id="legalName" name="legalName" defaultValue={company.legalName} className="h-11" placeholder="Atelier Nord" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Adresse</Label>
        <Input id="address" name="address" defaultValue={company.address} className="h-11" placeholder="12 rue des Lilas" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="postalCode">Code postal</Label>
          <Input id="postalCode" name="postalCode" defaultValue={company.postalCode} className="h-11" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="city">Ville</Label>
          <Input id="city" name="city" defaultValue={company.city} className="h-11" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="country">Pays</Label>
          <Input id="country" name="country" defaultValue={company.country} className="h-11" placeholder="France" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input id="phone" name="phone" defaultValue={company.phone} className="h-11" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={company.email} className="h-11" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="siren">SIREN</Label>
          <Input id="siren" name="siren" defaultValue={company.siren} className="h-11" inputMode="numeric" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vatNumber">Numéro de TVA</Label>
          <Input id="vatNumber" name="vatNumber" defaultValue={company.vatNumber} className="h-11" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="logo">Logo</Label>
        {company.logoUrl ? (
          <img src={company.logoUrl} alt="Logo de l’entreprise" className="h-16 w-auto max-w-full object-contain" />
        ) : (
          <p className="text-sm text-muted-foreground">Aucun logo enregistré.</p>
        )}
        <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="h-11" />
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
