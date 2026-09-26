"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionState } from "@/app/actions";
import type { FormState } from "@/app/catalog-actions";
import { ConfirmDelete } from "@/components/record-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { message: null };

const fieldClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function ProjectForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(
    createProjectAction,
    initialState,
  );

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nom du projet</Label>
        <Input id="name" name="name" required minLength={2} placeholder="Atlas" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="clientId">Client</Label>
        <select id="clientId" name="clientId" required defaultValue="" className={fieldClass}>
          <option value="">Choisir un client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="nextAction">Prochaine action</Label>
        <Input
          id="nextAction"
          name="nextAction"
          placeholder="Qualifier le besoin"
        />
      </div>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Création…" : "Créer le dossier"}
      </Button>
    </form>
  );
}

export function ProjectEditor({
  project,
  updateAction,
  deleteAction,
  deleteQuoteAction,
  quotes,
  clients,
}: {
  project: {
    id: string;
    name: string;
    clientId: string;
    status: string;
    purpose: string;
    nextAction: string;
  };
  clients: Array<{ id: string; name: string }>;
  updateAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  deleteQuoteAction: (previous: FormState, formData: FormData) => Promise<FormState>;
  quotes: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(updateAction, {
    message: null,
    ok: false,
  });
  return (
    <div className="grid gap-4 rounded-lg border border-border p-3">
      <form action={action} className="grid gap-3">
        <input type="hidden" name="id" value={project.id} />
        <div className="grid gap-2">
          <Label htmlFor={`name-${project.id}`}>Nom du projet</Label>
          <Input id={`name-${project.id}`} name="name" required minLength={2} defaultValue={project.name} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`client-${project.id}`}>Client</Label>
          <select
            id={`client-${project.id}`}
            name="clientId"
            required
            defaultValue={project.clientId}
            className={fieldClass}
          >
            <option value="">Choisir un client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`status-${project.id}`}>Statut</Label>
          <Input id={`status-${project.id}`} name="status" defaultValue={project.status} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`purpose-${project.id}`}>Objet</Label>
          <Textarea id={`purpose-${project.id}`} name="purpose" rows={2} defaultValue={project.purpose} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`action-${project.id}`}>Prochaine action</Label>
          <Input id={`action-${project.id}`} name="nextAction" defaultValue={project.nextAction} />
        </div>
        <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
          {pending ? "Enregistrement…" : "Enregistrer le projet"}
        </Button>
        {state.message ? (
          <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm" : "text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
      </form>
      {quotes.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Retirer un devis du dossier</p>
          {quotes.map((quote) => (
            <ConfirmDelete
              key={quote.id}
              action={deleteQuoteAction}
              id={quote.id}
              label={`Supprimer ${quote.label}`}
              confirm={`Supprimer le devis ${quote.label} ? Les produits restent au catalogue.`}
            />
          ))}
        </div>
      ) : null}
      <ConfirmDelete
        action={deleteAction}
        id={project.id}
        label="Supprimer le projet"
        confirm={`Supprimer le projet ${project.name} ? L’actualité est retirée. Les devis restent au catalogue.`}
      />
    </div>
  );
}
