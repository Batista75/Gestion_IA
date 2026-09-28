"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createInboxItemAction } from "@/app/actions";
import { ProposalBoard, type PendingProposal } from "@/components/proposal-board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnderstandingCard } from "@/domain/completeness";
import { provenanceLabel } from "@/domain/provenance";
import type { StoredTurn } from "@/lib/conversations";
import { cn } from "cn";

type Field = { label: string; value: string };
type SourceRef = { label: string; title: string };
type ChatMeta = {
  source?: string;
  modelVersion?: string;
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
  fill = false,
}: {
  conversationId: string;
  projectName?: string;
  initialMessages?: StoredTurn[];
  proposals?: PendingProposal[];
  fill?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hint = useRef({ view: "/", attachments: [] as string[] });
  // Lu au moment de l’envoi, avec la page et les pièces de cet instant.
  // eslint-disable-next-line react-hooks/refs -- la valeur sert à la requête, pas au rendu
  hint.current.view = pathname || "/";
  /* eslint-disable react-hooks/refs -- lu seulement quand le message part */
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
  /* eslint-enable react-hooks/refs */
  const { messages, sendMessage, status, error, stop } = useChat<ChatMessage>({
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
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToEnd = useRef(true);
  const pending = busy || status === "submitted" || status === "streaming";
  const streaming = status === "submitted" || status === "streaming";

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("nouveau") !== "1") return;
    url.searchParams.delete("nouveau");
    url.searchParams.set("fil", conversationId);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }, [conversationId, router]);

  useEffect(() => {
    const node = draftRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    if (document.activeElement === document.body) draftRef.current?.focus();
  }, []);

  useEffect(() => {
    const node = threadRef.current;
    if (!node || !stickToEnd.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, status, pending]);

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
    const attached = files;
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
  const canSend = draft.trim().length > 0 || files.length > 0;

  function renderMessage(message: ChatMessage) {
    return (
      <MessageRow
        key={message.id}
        message={message}
        pending={pending}
        live={pending && message.id === lastAssistant?.id}
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
    );
  }

  function addFiles(list: FileList | null) {
    const picked = [...(list ?? [])];
    if (picked.length === 0) return;
    const next = [...files, ...picked];
    if (next.length > 8) {
      setFileError("Au plus 8 pièces à la fois.");
      setFiles(next.slice(0, 8));
    } else {
      setFileError(null);
      setFiles(next);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function dropFile(index: number) {
    setFiles((current) => current.filter((_, position) => position !== index));
  }

  return (
    <div
      className={cn("flex min-h-0 flex-col", fill ? "h-full" : "h-[min(36rem,70dvh)]")}
      id="assistant"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 pb-2">
        <p className="truncate text-sm font-medium">{projectName ? projectName : "Assistant"}</p>
        <Link href="/?nouveau=1" className="inline-flex min-h-11 shrink-0 items-center text-sm underline-offset-4 hover:underline">
          Nouveau fil
        </Link>
      </div>
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => {
          const node = event.currentTarget;
          stickToEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div className="grid max-w-md gap-2">
              <p className="text-lg font-medium">Que souhaitez-vous faire ?</p>
              <p className="text-sm leading-6 text-muted-foreground">
                Décrivez la demande, ou joignez une pièce. Rien n’est écrit sans votre accord. Les montants restent ceux de la pièce.
              </p>
            </div>
          </div>
        ) : (
          <ol className="mx-auto grid w-full max-w-3xl gap-4 px-1 py-4">{messages.map((message) => renderMessage(message))}</ol>
        )}
      </div>
      {proposals.length > 0 ? (
        <div className="mx-auto grid w-full max-w-3xl shrink-0 gap-2 py-2">
          <h2 className="text-sm font-medium">À confirmer</h2>
          <ProposalBoard proposals={proposals} />
        </div>
      ) : null}
      <form onSubmit={onSubmit} aria-busy={pending} className="mx-auto grid w-full max-w-3xl shrink-0 gap-2 pt-2">
        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-muted px-3 text-sm">
                <span className="max-w-48 truncate">{file.name}</span>
                <button type="button" className="text-base leading-none" aria-label={`Retirer ${file.name}`} onClick={() => dropFile(index)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-end gap-1 rounded-3xl border border-border bg-card py-1 pr-1 pl-1 shadow-sm">
          <input
            ref={fileRef}
            id="assistant-files"
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => addFiles(event.target.files)}
          />
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Joindre une pièce"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip aria-hidden="true" className="size-5" />
          </button>
          <label htmlFor="assistant-draft" className="sr-only">
            Message
          </label>
          <textarea
            ref={draftRef}
            id="assistant-draft"
            value={draft}
            rows={1}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
            placeholder="Écrire un message"
            maxLength={4000}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
          {streaming ? (
            <button
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-label="Arrêter"
              onClick={() => stop()}
            >
              <Square aria-hidden="true" className="size-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Envoyer"
              disabled={pending || !canSend}
            >
              <ArrowUp aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">Entrée envoie. Maj+Entrée passe à la ligne.</p>
        {error ? (
          <p role="alert" className="text-sm leading-6 text-destructive">
            {error.message || "La réponse n’est pas arrivée. Reformulez la demande, ou réessayez dans un instant."}
          </p>
        ) : null}
        {fileError ? (
          <p role="alert" className="text-sm leading-6 text-destructive">
            {fileError}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function MessageRow({
  message,
  pending,
  live,
  confirm,
  editable,
  onConfirm,
  onCorrect,
}: {
  message: ChatMessage;
  pending: boolean;
  live: boolean;
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

  const mine = message.role === "user";
  const version = provenanceLabel(message.metadata?.modelVersion ?? "");

  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <article
        aria-label={label}
        className={cn(
          "grid gap-2 break-words",
          mine
            ? "w-fit max-w-[min(100%,36rem)] rounded-3xl bg-primary px-4 py-3 text-primary-foreground"
            : "w-full max-w-3xl py-1",
        )}
      >
      {version && !mine ? <span className="text-xs text-muted-foreground">{version}</span> : null}
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
      {live && !text ? (
        <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="Réponse en cours">
          <span className="size-1.5 animate-pulse rounded-full bg-current" />
          <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
          <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
        </span>
      ) : null}
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
      </article>
    </li>
  );
}

function toUi(turns: StoredTurn[]): ChatMessage[] {
  return turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    metadata: {
      source: turn.source,
      modelVersion: turn.modelVersion,
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
      {card.path ? <p className="text-sm leading-6">{card.path}</p> : null}
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
      {card.simulation ? <p className="text-sm leading-6">{card.simulation}</p> : null}
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
            La correction vaut pour ce document. Elle ne devient pas une règle. Le message d’origine n’est pas réécrit.
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
