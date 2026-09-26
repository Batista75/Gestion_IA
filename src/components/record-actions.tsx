"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/catalog-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const emptyState: FormState = { message: null, ok: false };

export function ConfirmDelete({
  action,
  id,
  label,
  confirm,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  label: string;
  confirm: string;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" disabled={pending} className="min-h-11 px-4">
        {pending ? "Suppression…" : label}
      </Button>
      <Outcome state={state} />
    </form>
  );
}

export function NoteEditor({
  action,
  id,
  body,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  body: string;
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <Label htmlFor={`note-${id}`}>Note</Label>
      <Textarea id={`note-${id}`} name="body" defaultValue={body} rows={3} />
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : "Enregistrer la note"}
      </Button>
      <Outcome state={state} />
    </form>
  );
}

function Outcome({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm" : "text-sm text-destructive"}>
      {state.message}
    </p>
  );
}
