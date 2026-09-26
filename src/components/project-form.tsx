"use client";

import { useActionState } from "react";
import { createProjectAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { message: null };

export function ProjectForm() {
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
        <Label htmlFor="primaryClient">Client principal</Label>
        <Input
          id="primaryClient"
          name="primaryClient"
          required
          minLength={2}
          placeholder="Atelier Nord"
        />
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
