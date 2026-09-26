"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type OllamaStatus = {
  ok: boolean;
  baseUrl: string;
  models: string[];
  defaultModel: string | null;
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  source?: "ollama" | "regle-metier" | "action";
  model?: string | null;
};

export function AssistantChat() {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/ollama", { cache: "no-store" });
        const body = (await response.json()) as OllamaStatus;
        if (cancelled) return;
        setStatus(body);
        setModel(body.defaultModel ?? "");
      } catch {
        if (!cancelled) {
          setStatusError("Impossible de lire l’état d’Ollama.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;

    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    setPending(true);
    setSendError(null);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: model || undefined,
          messages: history.map(({ role, content: text }) => ({
            role,
            content: text,
          })),
        }),
      });
      const body = (await response.json()) as {
        reply?: string;
        error?: string;
        model?: string | null;
        source?: "ollama" | "regle-metier" | "action";
      };
      if (!response.ok || !body.reply) {
        setSendError(body.error ?? "L’inférence a échoué.");
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: body.reply ?? "",
          source: body.source,
          model: body.model,
        },
      ]);
    } catch {
      setSendError("La requête vers l’assistant a été interrompue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Inférence sur le PC hôte</CardTitle>
          <CardDescription>
            Ollama utilise la carte graphique du poste 192.168.1.5. Le texte
            reste sur le réseau local.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {status === null && !statusError ? (
            <p className="text-sm text-muted-foreground">
              Vérification d’Ollama…
            </p>
          ) : null}
          {statusError ? (
            <p className="text-sm text-destructive">{statusError}</p>
          ) : null}
          {status ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.ok ? "secondary" : "destructive"}>
                {status.ok ? "Ollama joignable" : "Ollama injoignable"}
              </Badge>
              {status.baseUrl ? (
                <span className="text-sm text-muted-foreground">
                  {status.baseUrl}
                </span>
              ) : null}
            </div>
          ) : null}
          {status?.error ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {status.error}
            </p>
          ) : null}
          {status && status.models.length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="ollama-model">Modèle installé sur l’hôte</Label>
              <select
                id="ollama-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {status.models.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>
            Il peut créer ou mettre à jour un client, un fournisseur, un
            produit, un projet ou un devis. Il ne calcule pas les prix et
            n’émet pas de facture. La conversation elle-même n’est pas
            conservée.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {messages.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Exemples : créer client Atelier Nord, email contact@atelier.fr —
              créer projet Atlas, client Atelier Nord — devis Offre mars,
              produit Vis à bois. Pour un prix de vente, utilisez Ventes.
            </p>
          ) : (
            <ol className="grid gap-3">
              {messages.map((message, index) => (
                <li
                  key={`${message.role}-${index}`}
                  className="grid gap-1 rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {message.role === "user"
                      ? "Vous"
                      : message.source === "regle-metier"
                        ? "Règle métier"
                        : message.source === "action"
                          ? "Action enregistrée"
                          : (message.model ?? "Assistant")}
                  </span>
                  <p className="text-sm leading-6 whitespace-pre-wrap">
                    {message.content}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <form onSubmit={onSubmit} className="grid gap-3">
            <Label htmlFor="assistant-draft">Message</Label>
            <Textarea
              id="assistant-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Décrivez la pièce ou la question, sans donnée inutile."
              maxLength={4000}
              className="min-h-28"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={pending || draft.trim().length === 0}
                className="min-h-11 px-4"
              >
                {pending ? "Inférence en cours…" : "Envoyer"}
              </Button>
              {messages.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 px-4"
                  onClick={() => {
                    setMessages([]);
                    setSendError(null);
                  }}
                >
                  Effacer
                </Button>
              ) : null}
            </div>
            {sendError ? (
              <p className="text-sm leading-6 text-destructive">{sendError}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
