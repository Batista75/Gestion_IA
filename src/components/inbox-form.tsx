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
          required
          minLength={3}
          rows={4}
          placeholder="Collez une instruction ou décrivez une pièce reçue. Exemple : devis fournisseur à ranger dans le projet Atlas."
        />
      </div>
      <p className="text-sm text-muted-foreground">
        L’enregistrement reste dans « À classer ». Rien n’est rattaché à un
        projet tant que vous ne le confirmez pas.
      </p>
      {state.message ? (
        <p role="status" className="text-sm text-foreground">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : "Enregistrer dans À classer"}
      </Button>
    </form>
  );
}
