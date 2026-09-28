"use client";

import { useActionState } from "react";
import { saveDeliveryAction, type DeliveryState } from "@/app/projets/delivery-actions";
import { FormMessage } from "@/components/party-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DELIVERY_MODES, type DeliveryDraft } from "@/domain/delivery";

const initial: DeliveryState = { message: null, ok: false };
const fieldClass = "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm transition-colors duration-150";

export function DeliveryForm({ projectId, delivery }: { projectId: string; delivery: DeliveryDraft }) {
  const [state, action, pending] = useActionState(saveDeliveryAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-recipient">Destinataire</Label>
          <Input id="delivery-recipient" name="recipient" defaultValue={delivery.recipient} placeholder="Nom sur le bon de livraison" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-mode">Mode</Label>
          <select id="delivery-mode" name="mode" defaultValue={delivery.mode} className={fieldClass}>
            {DELIVERY_MODES.map((mode) => (
              <option key={mode.value || "none"} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="delivery-address">Adresse</Label>
        <Input id="delivery-address" name="address" defaultValue={delivery.address} placeholder="Peut différer de l’adresse de facturation" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-postal">Code postal</Label>
          <Input id="delivery-postal" name="postalCode" defaultValue={delivery.postalCode} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-city">Ville</Label>
          <Input id="delivery-city" name="city" defaultValue={delivery.city} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-country">Pays</Label>
          <Input id="delivery-country" name="country" defaultValue={delivery.country} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="delivery-contact">Contact sur place</Label>
          <Input id="delivery-contact" name="contact" defaultValue={delivery.contact} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-phone">Téléphone</Label>
          <Input id="delivery-phone" name="phone" defaultValue={delivery.phone} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-slot">Date ou créneau</Label>
          <Input id="delivery-slot" name="slot" defaultValue={delivery.slot} placeholder="15 octobre, 14 h" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="delivery-note">Consignes</Label>
        <Textarea id="delivery-note" name="note" rows={2} defaultValue={delivery.note} placeholder="Accès, quai, horaires, réserves" />
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Enregistrement…" : "Enregistrer la livraison"}
      </Button>
    </form>
  );
}
