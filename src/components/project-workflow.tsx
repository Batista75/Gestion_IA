"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveStepAction, type TradeState } from "@/app/projets/trade-actions";
import { FormMessage } from "@/components/party-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TRADE_TITLE,
  advanceWarning,
  nextTradeStep,
  stepStatusLabel,
  type StepRecord,
  type TradeStep,
} from "@/domain/trade-workflow";

const initial: TradeState = { message: null, ok: false };
const fieldClass = "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function ProjectWorkflow({
  projectId,
  steps,
  records,
}: {
  projectId: string;
  steps: TradeStep[];
  records: StepRecord[];
}) {
  const next = nextTradeStep(records);
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Parcours du métier</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {TRADE_TITLE}. Chaque étape attend sa preuve. La prochaine est l’étape {next.order}, {next.title}.
          </p>
        </div>
        <Link href="/documentation/metier" className="text-sm font-medium underline-offset-4 hover:underline">
          Lire l’instruction métier
        </Link>
      </div>
      <ol className="grid gap-3">
        {steps.map((step) => (
          <StepCard
            key={step.key}
            projectId={projectId}
            step={step}
            record={records.find((item) => item.key === step.key) ?? null}
            records={records}
            current={step.key === next.key}
          />
        ))}
      </ol>
    </section>
  );
}

function StepCard({
  projectId,
  step,
  record,
  records,
  current,
}: {
  projectId: string;
  step: TradeStep;
  record: StepRecord | null;
  records: StepRecord[];
  current: boolean;
}) {
  const [state, action, pending] = useActionState(saveStepAction, initial);
  const status = record?.status ?? "a_faire";
  const warning = advanceWarning(step.key, records);
  return (
    <li className={`grid gap-3 rounded-lg border p-3 ${current ? "border-foreground" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {step.order}. {step.title}
        </p>
        <Badge variant={status === "fait" ? "default" : "secondary"}>{stepStatusLabel(status)}</Badge>
        {current ? <Badge variant="outline">Prochaine étape</Badge> : null}
      </div>
      <p className="text-sm leading-6">{step.action}</p>
      <p className="text-sm leading-6 text-muted-foreground">Preuve : {step.proof}</p>
      {warning ? <p className="text-sm leading-6">{warning}</p> : null}
      {step.key === "facturation" ? (
        <p className="text-sm leading-6">
          L’application n’émet pas la facture et ne lui donne pas de numéro. Indiquez la référence déjà portée sur la pièce.
        </p>
      ) : null}
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="stepKey" value={step.key} />
        <div className="grid gap-2">
          <Label htmlFor={`status-${step.key}`}>Situation</Label>
          <select id={`status-${step.key}`} name="status" defaultValue={status} className={fieldClass}>
            <option value="a_faire">À faire</option>
            <option value="en_cours">En cours</option>
            <option value="fait">Preuve enregistrée</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`proof-${step.key}`}>Référence de la preuve</Label>
          <Input id={`proof-${step.key}`} name="proofRef" defaultValue={record?.proofRef ?? ""} placeholder="Référence indiquée sur la pièce" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor={`note-${step.key}`}>Note</Label>
          <Input id={`note-${step.key}`} name="proofNote" defaultValue={record?.proofNote ?? ""} placeholder="Date, réserves, signataire" />
        </div>
        <FormMessage state={state} />
        <Button type="submit" variant="outline" disabled={pending} className="min-h-11 w-fit px-4">
          {pending ? "Enregistrement…" : "Enregistrer l’étape"}
        </Button>
      </form>
    </li>
  );
}
