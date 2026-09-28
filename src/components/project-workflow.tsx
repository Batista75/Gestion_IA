"use client";

import { useState } from "react";
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
const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm transition-colors duration-150 focus-visible:border-ring focus-visible:outline-none";

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
  const signature = records.map((record) => `${record.key}:${record.status}:${record.proofRef}`).join("|");
  const [selected, setSelected] = useState(next.key);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setSelected(next.key);
  }
  const step = steps.find((item) => item.key === selected) ?? next;
  const done = records.filter((record) => record.status === "fait").length;

  return (
    <section id="parcours" className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {TRADE_TITLE}. {done} preuve{done > 1 ? "s" : ""} sur {steps.length}. Prochaine étape : {next.order}. {next.title}.
        </p>
        <Link href="/documentation/metier" className="text-sm font-medium underline-offset-4 hover:underline">
          Lire l’instruction métier
        </Link>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
      <ol className="grid content-start gap-2 sm:grid-cols-2 lg:overflow-auto lg:pr-1 xl:grid-cols-3">
        {steps.map((item) => {
          const record = records.find((entry) => entry.key === item.key) ?? null;
          const status = record?.status ?? "a_faire";
          const active = item.key === step.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(item.key)}
                className={`grid h-full w-full content-start gap-1 rounded-lg border bg-card p-2.5 text-left transition-colors duration-150 hover:bg-muted/30 ${
                  active ? "border-foreground" : "border-border"
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {item.order}. {item.title}
                  </span>
                  <Badge variant={status === "fait" ? "default" : "secondary"}>{stepStatusLabel(status)}</Badge>
                  {item.key === next.key ? <Badge variant="outline">Prochaine</Badge> : null}
                </span>
                <span className="line-clamp-2 text-xs leading-4 text-muted-foreground">{item.proof}</span>
                {record?.proofRef ? <span className="text-sm">Réf. {record.proofRef}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <StepForm
        key={`${step.key}:${signature}`}
        projectId={projectId}
        step={step}
        record={records.find((entry) => entry.key === step.key) ?? null}
        records={records}
      />
      </div>
    </section>
  );
}

function StepForm({
  projectId,
  step,
  record,
  records,
}: {
  projectId: string;
  step: TradeStep;
  record: StepRecord | null;
  records: StepRecord[];
}) {
  const [state, action, pending] = useActionState(saveStepAction, initial);
  const status = record?.status ?? "a_faire";
  const warning = advanceWarning(step.key, records);
  return (
    <form action={action} className="grid content-start gap-3 rounded-lg border border-border bg-card p-3 shadow-sm lg:overflow-auto">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="stepKey" value={step.key} />
      <div className="grid gap-1">
        <p className="font-medium">
          {step.order}. {step.title}
        </p>
        <p className="text-sm leading-6">{step.action}</p>
        <p className="text-sm leading-6 text-muted-foreground">Preuve attendue : {step.proof}</p>
      </div>
      {warning ? <p className="text-sm leading-6">{warning}</p> : null}
      {step.key === "facturation" ? (
        <p className="text-sm leading-6">
          L’application n’émet pas la facture et ne lui donne pas de numéro. Indiquez la référence déjà portée sur la pièce.{" "}
          <Link href={`/projets/${projectId}/facture`} className="font-medium underline-offset-4 hover:underline">
            Voir la facture client
          </Link>
          .
        </p>
      ) : null}
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`status-${step.key}`}>Situation</Label>
          <select id={`status-${step.key}`} name="status" defaultValue={status} className={fieldClass}>
            <option value="a_faire">À faire</option>
            <option value="en_cours">En cours</option>
            <option value="fait">Preuve enregistrée</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`proof-${step.key}`}>Référence de la preuve</Label>
          <Input id={`proof-${step.key}`} name="proofRef" defaultValue={record?.proofRef ?? ""} placeholder="Référence indiquée sur la pièce" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note-${step.key}`}>Note</Label>
          <Input id={`note-${step.key}`} name="proofNote" defaultValue={record?.proofNote ?? ""} placeholder="Date, réserves, signataire" />
        </div>
      </div>
      <FormMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Enregistrement…" : "Enregistrer l’étape"}
      </Button>
    </form>
  );
}
