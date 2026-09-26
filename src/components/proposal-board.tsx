"use client";

import { useState } from "react";
import {
  confirmDocumentAction,
  dismissDocumentAction,
} from "@/app/proposal-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { kindLabel } from "@/domain/offer-versions";

export type PendingProposal = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  fileName: string;
  fileId: string;
  fields: Array<{ label: string; value: string }>;
  sources: Array<{ label: string; title: string }>;
};

export function ProposalBoard({ proposals }: { proposals: PendingProposal[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function run(id: string, action: (value: string) => Promise<{ message: string | null }>) {
    setPendingId(id);
    setMessage(null);
    try {
      const result = await action(id);
      setMessage(result.message);
    } finally {
      setPendingId(null);
    }
  }

  if (proposals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune proposition en attente. Un devis, une demande de prix, une commande ou une facture déposé ici sera relu avant d’écrire une fiche.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {message ? (
        <p role="status" className="text-sm leading-6">
          {message}
        </p>
      ) : null}
      <ul className="grid gap-3">
        {proposals.map((proposal) => (
          <li key={proposal.id} className="grid gap-2 rounded-lg border border-border p-3">
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
            <p className="text-sm leading-6 whitespace-pre-wrap break-words">{proposal.summary}</p>
            <dl className="grid gap-1 text-sm">
              {proposal.fields.map((field) => (
                <div key={field.label} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="whitespace-pre-wrap break-words">{field.value}</dd>
                </div>
              ))}
            </dl>
            {proposal.sources.length > 0 ? (
              <p className="text-xs leading-5 text-muted-foreground">
                Sources : {proposal.sources.map((source) => `${source.label} ${source.title}`).join(" · ")}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11 px-4"
                disabled={pendingId === proposal.id}
                onClick={() => void run(proposal.id, confirmDocumentAction)}
              >
                {pendingId === proposal.id ? "Écriture…" : "Confirmer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 px-4"
                disabled={pendingId === proposal.id}
                onClick={() => void run(proposal.id, dismissDocumentAction)}
              >
                Écarter
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
