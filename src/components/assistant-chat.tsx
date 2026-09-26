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
import { CLIENT_EXAMPLES } from "@/domain/client-file";

type OllamaStatus = {
  ok: boolean;
  baseUrl: string;
  models: string[];
  defaultModel: string | null;
  embedModel: string | null;
  sizing: string;
  warning?: string;
  error?: string;
};

type SourceRef = { label: string; title: string };

type ProposalField = { label: string; value: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  source?: "ollama" | "regle-metier" | "action" | "proposition" | "dossier";
  model?: string | null;
  proposal?: ProposalField[];
  sources?: SourceRef[];
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

  async function send(content: string) {
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
        source?: "ollama" | "regle-metier" | "action" | "proposition" | "dossier";
        proposal?: { fields?: ProposalField[] };
        sources?: SourceRef[];
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
          proposal: body.proposal?.fields,
          sources: body.sources,
        },
      ]);
    } catch {
      setSendError("La requête vers l’assistant a été interrompue.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(draft.trim());
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
          {status?.warning ? (
            <p className="text-sm leading-6 text-muted-foreground">{status.warning}</p>
          ) : null}
          {status ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {status.sizing}{" "}
              {status.embedModel
                ? `Index : ${status.embedModel}.`
                : "Index lexical tant que nomic-embed-text n’est pas installé sur l’hôte."}
            </p>
          ) : null}
          {status && status.models.filter((name) => !/embed|bge-m/i.test(name)).length > 0 ? (
            <div className="grid gap-2">
              <Label htmlFor="ollama-model">Modèle installé sur l’hôte</Label>
              <select
                id="ollama-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {status.models
                  .filter((name) => !/embed|bge-m/i.test(name))
                  .map((name) => (
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
            Il reconnaît l’intention, relit les fiches déjà enregistrées, puis
            agit. Une fiche client reste une proposition à confirmer. Il ne
            calcule pas les prix. La conversation n’est pas conservée.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {messages.length === 0 ? (
            <div className="grid gap-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Ces exemples proposent une fiche, sans l’enregistrer. Vous pouvez
                aussi demander « que sait-on de Marie Dupont » ou « liste des
                clients » : la réponse vient des fiches, pas d’une invention.
                Pour un prix de vente, utilisez Ventes.
              </p>
              <div className="flex flex-wrap gap-2">
                {CLIENT_EXAMPLES.map((example) => (
                  <Button
                    key={example.id}
                    type="button"
                    variant="outline"
                    className="min-h-11 px-3"
                    disabled={pending}
                    onClick={() => void send(example.text)}
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
            </div>
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
                          : message.source === "proposition"
                            ? "Proposition à confirmer"
                            : message.source === "dossier"
                              ? "D’après les fiches"
                              : (message.model ?? "Assistant")}
                  </span>
                  <p className="text-sm leading-6 whitespace-pre-wrap">
                    {message.content}
                  </p>
                  {message.sources && message.sources.length > 0 ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Sources :{" "}
                      {message.sources
                        .map((source) => `${source.label} ${source.title}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {message.proposal && message.proposal.length > 0 ? (
                    <dl className="mt-2 grid gap-1 text-sm">
                      {message.proposal.map((field) => (
                        <div key={field.label} className="grid grid-cols-[8rem_1fr] gap-2">
                          <dt className="text-muted-foreground">{field.label}</dt>
                          <dd>{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {message.source === "proposition" && index === messages.length - 1 ? (
                    <Button
                      type="button"
                      className="mt-2 min-h-11 w-fit px-4"
                      disabled={pending}
                      onClick={() => void send("Je confirme.")}
                    >
                      Confirmer
                    </Button>
                  ) : null}
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
