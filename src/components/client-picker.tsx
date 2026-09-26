"use client";

import { useActionState } from "react";
import Link from "next/link";
import { assignClientAction, type ClientPickState } from "@/app/projets/client-actions";
import { FormMessage } from "@/components/party-manager";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: ClientPickState = { message: null, ok: false };
const fieldClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function ClientPicker({
  projectId,
  clientId,
  clients,
}: {
  projectId: string;
  clientId: string;
  clients: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(assignClientAction, initial);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-2">
        <Label htmlFor="project-client">Client du répertoire</Label>
        <select id="project-client" name="clientId" defaultValue={clientId} className={fieldClass} required>
          <option value="">Choisir un client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      {clients.length === 0 ? (
        <p className="text-sm">
          Aucun client au répertoire.{" "}
          <Link href="/clients" className="font-medium underline-offset-4 hover:underline">
            Créer la fiche
          </Link>
          .
        </p>
      ) : null}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending || clients.length === 0} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : "Retenir ce client"}
      </Button>
    </form>
  );
}
