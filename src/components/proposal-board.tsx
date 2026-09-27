"use client";

import { useState } from "react";
import {
  confirmDocumentAction,
  dismissDocumentAction,
} from "@/app/proposal-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { kindLabel } from "@/domain/offer-versions";
import { confidenceLabel, provenanceLabel } from "@/domain/provenance";

export type PendingProposal = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  fileName: string;
  fileId: string;
  fields: Array<{ label: string; value: string }>;
  sources: Array<{ label: string; title: string }>;
  modelVersion: string;
  confidence: Array<{ field: string; confidence: number }>;
};

export function ProposalBoard({ proposals }: { proposals: PendingProposal[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"confirm" | "dismiss" | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const visible = proposals.filter((proposal) => !done.includes(proposal.id));

  async function run(
    id: string,
    kind: "confirm" | "dismiss",
    action: (value: string) => Promise<{ message: string | null }>,
  ) {
    setPendingId(id);
    setPendingAction(kind);
    setMessage(null);
    try {
      const result = await action(id);
      setMessage(result.message);
      if (result.message?.includes("Validation enregistrée")) setDone((current) => [...current, id]);
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-3">
      {message ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm leading-6">
          {message}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucune pièce à confirmer. Un devis, une demande ou une commande déposé ici sera relu avant d’écrire une fiche.
        </p>
      ) : (
        <ul className="grid gap-3">
          {visible.map((proposal) => {
            const origin = provenanceLabel(proposal.modelVersion) || "Origine non indiquée";
            const score = sharedConfidence(proposal);
            return (
              <li key={proposal.id} className="grid gap-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{kindLabel(proposal.kind)}</Badge>
                  {proposal.fileId ? (
                    <a
                      href={`/api/pieces/${proposal.fileId}`}
                      className="text-sm font-medium break-all underline-offset-4 hover:underline"
                    >
                      {proposal.fileName}
                    </a>
                  ) : (
                    <span className="text-sm font-medium">{proposal.title}</span>
                  )}
                </div>
                <p className="text-sm leading-6">{firstLine(proposal.summary)}</p>
                <p className="text-xs text-muted-foreground">
                  {origin} · en attente de validation
                  {score ? ` · confiance ${confidenceLabel(score)}` : ""}
                </p>
                <details>
                  <summary className="min-h-11 cursor-pointer text-sm font-medium">Détail</summary>
                  <div className="grid gap-3 pt-2">
                    <p className="text-sm leading-6 whitespace-pre-wrap break-words">{proposal.summary}</p>
                    <dl className="grid gap-2 text-sm">
                      {proposal.fields.map((field) => {
                        const fieldScore = proposal.confidence.find((item) => item.field === field.label);
                        return (
                          <div key={field.label} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                            <dt className="text-muted-foreground">{field.label}</dt>
                            <dd className="whitespace-pre-wrap break-words">
                              {field.value}
                              {fieldScore ? ` · confiance ${confidenceLabel(fieldScore.confidence)}` : ""}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    {proposal.sources.length > 0 ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Sources : {proposal.sources.map((source) => `${source.label} ${source.title}`).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </details>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="min-h-11 px-4"
                    disabled={pendingId !== null}
                    onClick={() => void run(proposal.id, "confirm", confirmDocumentAction)}
                  >
                    {pendingId === proposal.id && pendingAction === "confirm" ? "Écriture…" : "Confirmer"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 px-4"
                    disabled={pendingId !== null}
                    onClick={() => void run(proposal.id, "dismiss", dismissDocumentAction)}
                  >
                    {pendingId === proposal.id && pendingAction === "dismiss" ? "Écriture…" : "Ignorer"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function firstLine(summary: string): string {
  const line = summary
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return "Pièce à relire.";
  return line.length > 180 ? `${line.slice(0, 177)}…` : line;
}

function sharedConfidence(proposal: PendingProposal): number | null {
  const scores = proposal.fields.flatMap((field) => {
    const found = proposal.confidence.find((item) => item.field === field.label);
    return found ? [found.confidence] : [];
  });
  if (scores.length === 0) return null;
  return scores.every((score) => score === scores[0]) ? scores[0]! : null;
}
