"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createInboxItemAction } from "@/app/actions";
import { ProposalBoard, type PendingProposal } from "@/components/proposal-board";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UnderstandingCard } from "@/domain/completeness";
import type { StoredTurn } from "@/lib/conversations";
import { cn } from "cn";

type Field = { label: string; value: string };
type SourceRef = { label: string; title: string };
type ChatMeta = {
  source?: string;
  proposal?: { fields: Field[] } | null;
  sources?: SourceRef[];
  understanding?: UnderstandingCard | null;
};
type ChatMessage = UIMessage<ChatMeta>;

export function AssistantChat({
  conversationId,
  projectName = "",
  initialMessages = [],
  proposals = [],
}: {
  conversationId: string;
  projectName?: string;
  initialMessages?: StoredTurn[];
  proposals?: PendingProposal[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hint = useRef({ view: "/", attachments: [] as string[] });
  hint.current.view = pathname || "/";
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/assistant",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            context: {
              view: hint.current.view,
              attachments: hint.current.attachments,
            },
          },
        }),
      }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    id: conversationId,
    messages: toUi(initialMessages),
    transport,
    onFinish: () => {
      router.refresh();
    },
  });
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = busy || status === "submitted" || status === "streaming";

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("nouveau") !== "1") return;
    url.searchParams.delete("nouveau");
    url.searchParams.set("fil", conversationId);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }, [conversationId, router]);

  async function send(content: string) {
    const text = content.trim();
    if (!text || pending) return;
    setDraft("");
    setFileError(null);
    hint.current.attachments = [];
    await sendMessage({ text });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = [...(fileRef.current?.files ?? [])];
    const attached = selected.length > 0 ? selected : files;
    const text = draft.trim();
    if ((!text && attached.length === 0) || pending) return;
    if (attached.length === 0) {
      await send(text);
      return;
    }

    setDraft("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    setBusy(true);
    setFileError(null);
    try {
      const data = new FormData();
      data.set("body", text);
      for (const file of attached) data.append("files", file);
      const saved = await createInboxItemAction({ message: null }, data);
      if (saved.message && /pas été enregistré|Au plus|Décrivez l’information/.test(saved.message)) {
        setFileError(saved.message);
        return;
      }
      const userText = text || attached.map((file) => file.name).join(", ");
      hint.current.attachments = attached.map((file) => file.name);
      await sendMessage({ text: userText });
      hint.current.attachments = [];
      router.refresh();
    } catch {
      setFileError("La pièce n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");

  return (
    <div className="grid gap-4" id="assistant">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {projectName ? `Fil du projet ${projectName}. ` : "Fil conservé sur cette machine. "}
          La page ouverte est jointe à la demande.
        </p>
        <Link
          href="/?nouveau=1"
          className={cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")}
        >
          Nouveau fil
        </Link>
      </div>
      <Card>
        <CardContent className="grid gap-4">
          {proposals.length > 0 ? (
            <div className="grid gap-2">
              <h2 className="text-sm font-medium">À confirmer</h2>
              <ProposalBoard proposals={proposals} />
            </div>
          ) : null}
          {messages.length > 0 ? (
            <ol className="grid gap-3">
              {messages.map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  pending={pending}
                  confirm={message.id === lastAssistant?.id && hasProposal(message)}
                  editable={message.id === lastAssistant?.id}
                  onConfirm={() => void send("Je confirme.")}
                  onCorrect={(line, attachments) => {
                    hint.current.attachments = attachments;
                    void sendMessage({ text: line }).finally(() => {
                      hint.current.attachments = [];
                    });
                  }}
                />
              ))}
            </ol>
          ) : null}

          <form onSubmit={onSubmit} className="grid gap-3">
            <Label htmlFor="assistant-draft">Que souhaitez-vous faire ?</Label>
            <Textarea
              id="assistant-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="J’ai reçu le devis de Durand. Ajoute cette facture au projet Atlas. Prépare un devis pour le projet Horizon."
              maxLength={4000}
              className="min-h-28"
            />
            <div className="grid gap-2">
              <Label htmlFor="assistant-files">Pièces jointes</Label>
              <input
                ref={fileRef}
                id="assistant-files"
                type="file"
                multiple
                onChange={(event) => setFiles([...(event.target.files ?? [])])}
                className="block w-full min-h-11 text-sm file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-sm file:font-medium"
              />
              {files.length > 0 ? (
                <p className="text-sm text-muted-foreground break-words">
                  {files.map((file) => file.name).join(", ")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={pending || (draft.trim().length === 0 && files.length === 0)}
                className="min-h-11 px-4"
              >
                {pending ? "Lecture…" : "Envoyer"}
              </Button>
            </div>
            {error ? (
              <p className="text-sm leading-6 text-destructive">{error.message}</p>
            ) : null}
            {fileError ? (
              <p className="text-sm leading-6 text-destructive">{fileError}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageRow({
  message,
  pending,
  confirm,
  editable,
  onConfirm,
  onCorrect,
}: {
  message: ChatMessage;
  pending: boolean;
  confirm: boolean;
  editable: boolean;
  onConfirm: () => void;
  onCorrect: (line: string, attachments: string[]) => void;
}) {
  const label = roleLabel(message);
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
  const steps = message.parts.flatMap((part) => {
    const title = stepTitle(part);
    return title && title !== label ? [title] : [];
  });
  const proposal = message.metadata?.proposal?.fields ?? [];
  const sources = message.metadata?.sources ?? [];
  const understanding = message.metadata?.understanding ?? null;

  return (
    <li className="grid gap-1 rounded-lg border border-border px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {steps.length > 0 ? (
        <ul className="grid gap-1">
          {steps.map((step, index) => (
            <li key={`${step}-${index}`} className="text-xs leading-5 text-muted-foreground">
              {step}
            </li>
          ))}
        </ul>
      ) : null}
      {text ? <p className="text-sm leading-6 whitespace-pre-wrap">{text}</p> : null}
      {sources.length > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Sources : {sources.map((source) => `${source.label} ${source.title}`).join(" · ")}
        </p>
      ) : null}
      {proposal.length > 0 ? (
        <dl className="mt-2 grid gap-1 text-sm">
          {proposal.map((field) => (
            <div key={field.label} className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {understanding ? (
        <UnderstandingPanel
          card={understanding}
          editable={editable}
          pending={pending}
          formId={message.id}
          onCorrect={onCorrect}
        />
      ) : null}
      {confirm ? (
        <Button type="button" className="mt-2 min-h-11 w-fit px-4" disabled={pending} onClick={onConfirm}>
          Confirmer
        </Button>
      ) : null}
    </li>
  );
}

function toUi(turns: StoredTurn[]): ChatMessage[] {
  return turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    metadata: {
      source: turn.source,
      proposal: turn.proposal,
      sources: turn.sources,
      understanding: turn.understanding,
    },
    parts: [
      ...turn.steps.map((step, index) => ({
        type: "dynamic-tool" as const,
        toolName: "notice",
        toolCallId: `${turn.id}-step-${index}`,
        title: step,
        state: "output-available" as const,
        input: {},
        output: step,
      })),
      { type: "text" as const, text: turn.content, state: "done" as const },
    ],
  }));
}

function roleLabel(message: ChatMessage): string {
  if (message.role === "user") return "Vous";
  switch (message.metadata?.source) {
    case "regle-metier":
      return "Règle métier";
    case "action":
      return "Action enregistrée";
    case "proposition":
      return "Proposition à confirmer";
    case "dossier":
      return "D’après les fiches";
    default:
      return "Assistant";
  }
}

function UnderstandingPanel({
  card,
  editable,
  pending,
  formId,
  onCorrect,
}: {
  card: UnderstandingCard;
  editable: boolean;
  pending: boolean;
  formId: string;
  onCorrect: (line: string, attachments: string[]) => void;
}) {
  return (
    <form
      className="mt-2 grid gap-3 rounded-md border border-border bg-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const projet = String(data.get("projet") ?? "").trim();
        const type = String(data.get("type") ?? "").trim();
        const supplier = String(data.get("fournisseur") ?? "").trim();
        const parts = [
          projet ? `projet ${projet}` : "",
          type ? `type ${type}` : "",
          supplier ? `fournisseur ${supplier}` : "",
        ].filter(Boolean);
        if (parts.length === 0) return;
        onCorrect(`Fiche : ${parts.join(", ")}`, card.attachments);
      }}
    >
      <p className="text-sm font-medium">Fiche de compréhension</p>
      <p className="text-sm leading-6">Action proposée : {card.action}</p>
      {card.understood.length > 0 ? (
        <ul className="grid gap-1 text-sm leading-6">
          {card.understood.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">Rien n’est encore assez sûr.</p>
      )}
      <p className="text-sm leading-6">
        {card.confirm ? `À confirmer : ${card.confirm}` : "Rien à confirmer sur cette fiche."}
      </p>
      {editable ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <CardField id={`${formId}-projet`} name="projet" label="Projet" value={card.project} options={card.projects} />
            <CardField id={`${formId}-type`} name="type" label="Type" value={card.documentType} options={card.types} />
            <CardField id={`${formId}-fournisseur`} name="fournisseur" label="Fournisseur" value={card.supplier} options={card.suppliers} />
          </div>
          <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
            Corriger la fiche
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            La correction vaut pour cette demande. Le message d’origine n’est pas réécrit.
          </p>
        </>
      ) : null}
    </form>
  );
}

function CardField({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} list={`${id}-list`} defaultValue={value} className="min-h-11" />
      <datalist id={`${id}-list`}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

function hasProposal(message: ChatMessage): boolean {
  return (message.metadata?.proposal?.fields.length ?? 0) > 0;
}

function stepTitle(part: ChatMessage["parts"][number]): string | null {
  if (part.type === "dynamic-tool") return part.title || null;
  if (part.type.startsWith("tool-") && "title" in part && typeof part.title === "string") {
    return part.title;
  }
  if (part.type.startsWith("tool-")) return part.type.slice(5).replaceAll("_", " ");
  return null;
}
