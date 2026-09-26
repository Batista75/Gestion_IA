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
    <section id="parcours" className="order-1 grid scroll-mt-6 gap-3 lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Parcours du métier</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {TRADE_TITLE}. {done} preuve{done > 1 ? "s" : ""} sur {steps.length}. Prochaine étape : {next.order}. {next.title}.
          </p>
        </div>
        <Link href="/documentation/metier" className="text-sm font-medium underline-offset-4 hover:underline">
          Lire l’instruction métier
        </Link>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
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
                className={`grid h-full w-full gap-1 rounded-lg border p-3 text-left ${
                  active ? "border-foreground" : "border-border"
                }`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {item.order}. {item.title}
                  </span>
                  <Badge variant={status === "fait" ? "default" : "secondary"}>{stepStatusLabel(status)}</Badge>
                  {item.key === next.key ? <Badge variant="outline">Prochaine</Badge> : null}
                </span>
                <span className="text-sm leading-5 text-muted-foreground">{item.proof}</span>
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
    <form action={action} className="grid gap-3 rounded-lg border border-border p-3">
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
          L’application n’émet pas la facture et ne lui donne pas de numéro. Indiquez la référence déjà portée sur la pièce.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
      <FormMessage state={state} />
      <Button type="submit" variant="outline" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : "Enregistrer l’étape"}
      </Button>
    </form>
  );
}
