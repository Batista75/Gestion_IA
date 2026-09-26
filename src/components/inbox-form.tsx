"use client";

import { useActionState } from "react";
import { createInboxItemAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { message: null };

export function InboxForm() {
  const [state, action, pending] = useActionState(
    createInboxItemAction,
    initialState,
  );

  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="body">Nouvelle information</Label>
        <Textarea
          id="body"
          name="body"
          rows={4}
          placeholder="Commentaire facultatif. Exemple : facture Helios à relire, sans l’attacher à un projet."
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="files">Fichiers</Label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          className="block w-full min-h-11 text-sm file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Tous les fichiers sont conservés, jusqu’à 8 fichiers de 20 Mo. L’assistant
        reconnaît une demande de prix, un devis, une commande ou une facture,
        puis propose les fiches. Rien n’est écrit ni rattaché à un projet avant
        confirmation.
      </p>
      {state.message ? (
        <p role="status" className="text-sm text-foreground">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Lecture…" : "Déposer pour analyse"}
      </Button>
    </form>
  );
}
