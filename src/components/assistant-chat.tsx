"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Check, CircleAlert, CircleCheck, History, MessageSquarePlus, Paperclip, Sparkles, Square, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createInboxItemAction } from "@/app/actions";
import { AssistantProposalCard, type ProposalState } from "@/components/assistant-proposal-card";
import { ProposalBoard, type PendingProposal } from "@/components/proposal-board";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { AnswerPacket } from "@/domain/answer-packet";
import type { UnderstandingCard } from "@/domain/completeness";
import { provenanceLabel } from "@/domain/provenance";
import { THREAD_MESSAGE_LIMIT, threadIsFull, type ThreadSummary } from "@/domain/thread";
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
  packet?: AnswerPacket | null;
};
type ChatMessage = UIMessage<ChatMeta>;

export function AssistantChat({
  conversationId,
  projectName = "",
  initialMessages = [],
  projectStatus = "",
  proposals = [],
  fill = false,
  panel = false,
  hidden = 0,
  threads = [],
  threadNotice = null,
  onNewThread,
  onSelectThread,
  onRenameThread,
}: {
  conversationId: string;
  projectName?: string;
  projectStatus?: string;
  initialMessages?: StoredTurn[];
  proposals?: PendingProposal[];
  fill?: boolean;
  panel?: boolean;
  hidden?: number;
  threads?: ThreadSummary[];
  threadNotice?: string | null;
  onNewThread?: () => void;
  onSelectThread?: (id: string) => void;
  onRenameThread?: (title: string) => Promise<string | null>;
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
    if (!text || pending || threadIsFull(messages.length)) return;
    setDraft("");
    setFileError(null);
    hint.current.attachments = [];
    await sendMessage({ text });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const attached = files;
    const text = draft.trim();
    if ((!text && attached.length === 0) || pending || threadIsFull(messages.length)) return;
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
  const [renameOpen, setRenameOpen] = useState(false);
  const currentThread = threads.find((thread) => thread.id === conversationId) ?? null;
  const full = threadIsFull(messages.length);
  const canSend = !full && (draft.trim().length > 0 || files.length > 0);

  function renderMessage(message: ChatMessage, index: number) {
    return (
      <MessageRow
        key={message.id}
        message={message}
        pending={pending}
        live={pending && message.id === lastAssistant?.id}
        confirm={message.id === lastAssistant?.id && hasProposal(message)}
        proposalState={proposalState(messages, index, message.id === lastAssistant?.id)}
        editable={message.id === lastAssistant?.id}
        onConfirm={() => void send("Je confirme.")}
        onAmend={() => draftRef.current?.focus()}
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

  const suggestions = projectName
    ? [`Quelle est la prochaine étape du projet ${projectName} ?`, `Quelle est la rentabilité réelle du projet ${projectName} ?`]
    : [];

  return (
    <div
      className={cn("@container flex min-h-0 flex-col", fill ? "h-full" : "h-[min(36rem,70dvh)]")}
      id="assistant"
      data-panel={panel ? "" : undefined}
    >
      <div className={cn("flex shrink-0 items-center justify-between gap-2", panel ? "h-12 border-b border-border px-3" : "pb-2")}>
        <div className="flex min-w-0 items-center gap-2">
          {panel ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Sparkles aria-hidden="true" className="size-3.5" />
            </span>
          ) : null}
          <div className="grid min-w-0">
            <p className="truncate text-sm font-semibold">{panel ? "Assistant" : projectName || "Assistant"}</p>
            {panel && projectName ? (
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={`Contexte : dossier ${projectName}`}>
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="truncate">
                  Dossier {projectName}
                  {projectStatus ? ` · ${projectStatus}` : ""}
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          {onSelectThread && threads.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Fils de ce dossier"
                title="Fils de ce dossier"
                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
              >
                <History aria-hidden="true" className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Fils de ce dossier</DropdownMenuLabel>
                  {onRenameThread && currentThread ? (
                    <DropdownMenuItem onClick={() => setRenameOpen(true)}>Renommer ce fil</DropdownMenuItem>
                  ) : null}
                  {threads.map((thread) => (
                    <DropdownMenuItem key={thread.id} onClick={() => onSelectThread(thread.id)} className="items-start gap-2">
                      <Check
                        aria-hidden="true"
                        className={cn("mt-0.5 size-3.5 shrink-0", thread.id === conversationId ? "text-primary" : "invisible")}
                      />
                      <span className="grid min-w-0">
                        <span className="truncate text-sm">{thread.title}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {thread.updatedAt} · {thread.count} message{thread.count > 1 ? "s" : ""}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {onRenameThread && currentThread ? (
            <ThreadRenameDialog
              key={`${currentThread.id}-${renameOpen}`}
              open={renameOpen}
              thread={currentThread}
              onOpenChange={setRenameOpen}
              onRename={onRenameThread}
            />
          ) : null}
          <NewThreadButton onNewThread={onNewThread} />
        </div>
      </div>
      {threadNotice ? (
        <p role="status" className="shrink-0 border-b border-border bg-surface-2/60 px-3 py-1.5 text-xs text-muted-foreground">
          {threadNotice}
        </p>
      ) : null}
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto"
        onScroll={(event) => {
          const node = event.currentTarget;
          stickToEnd.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 py-6">
            <div className="grid w-full max-w-sm gap-3">
              <div className="grid gap-1 text-center">
                <p className="text-sm font-medium">{projectName ? `Dossier ${projectName}` : "Que souhaitez-vous faire ?"}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {projectName
                    ? "Le dossier ouvert part avec chaque message. Rien n’est écrit sans votre accord."
                    : "Décrivez la demande, ou joignez une pièce. Rien n’est écrit sans votre accord. Les montants restent ceux de la pièce."}
                </p>
              </div>
              {suggestions.length > 0 ? (
                <ul className="grid gap-1.5" aria-label="Suggestions">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-xs leading-5 transition-colors duration-150 hover:border-input hover:bg-surface-2"
                        onClick={() => {
                          setDraft(suggestion);
                          draftRef.current?.focus();
                        }}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : (
          <ol className={cn("mx-auto grid w-full gap-4", panel ? "px-3 py-3" : "max-w-3xl px-1 py-4")}>
            {hidden > 0 ? (
              <li className="text-center text-xs text-muted-foreground">
                {hidden} message{hidden > 1 ? "s" : ""} plus ancien{hidden > 1 ? "s" : ""} de ce fil {hidden > 1 ? "ne sont" : "n’est"} pas affiché{hidden > 1 ? "s" : ""}.
              </li>
            ) : null}
            {messages.map((message, index) => renderMessage(message, index))}
          </ol>
        )}
      </div>
      {proposals.length > 0 ? (
        <div className={cn("mx-auto grid w-full shrink-0 gap-2 py-2", panel ? "px-3" : "max-w-3xl")}>
          <h2 className="text-sm font-medium">À confirmer</h2>
          <ProposalBoard proposals={proposals} />
        </div>
      ) : null}
      <form
        onSubmit={onSubmit}
        aria-busy={pending}
        className={cn("mx-auto grid w-full shrink-0 gap-1.5", panel ? "border-t border-border px-3 pt-2 pb-2.5" : "max-w-3xl pt-2")}
      >
        {full ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning-soft px-2.5 py-2 text-xs leading-5 text-warning">
            <span>Ce fil atteint {THREAD_MESSAGE_LIMIT} messages. Ouvrez un nouveau fil pour continuer.</span>
            <NewThreadButton onNewThread={onNewThread} labelled />
          </div>
        ) : null}
        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-surface-2 pr-1 pl-2 text-xs">
                <Paperclip aria-hidden="true" className="size-3 text-muted-foreground" />
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  type="button"
                  className="inline-flex size-5 items-center justify-center rounded hover:bg-border"
                  aria-label={`Retirer ${file.name}`}
                  onClick={() => dropFile(index)}
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex items-end gap-1 rounded-lg border border-input bg-surface p-1 transition-colors duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
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
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
            aria-label="Joindre une pièce"
            title="Joindre une pièce"
            disabled={full}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip aria-hidden="true" className="size-4" />
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
            placeholder={full ? "Ouvrez un nouveau fil pour continuer" : projectName ? "Question ou demande sur ce dossier…" : "Écrire un message"}
            disabled={full}
            maxLength={4000}
            className="max-h-40 min-h-8 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          {streaming ? (
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
              aria-label="Arrêter"
              onClick={() => stop()}
            >
              <Square aria-hidden="true" className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/85 disabled:bg-surface-2 disabled:text-muted-foreground"
              aria-label="Envoyer"
              disabled={pending || !canSend}
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        <p className="text-center text-[0.7rem] text-muted-foreground">Entrée envoie · Maj+Entrée passe à la ligne</p>
        {error ? (
          <p role="alert" className="flex items-start gap-1.5 rounded-md bg-danger-soft px-2.5 py-2 text-xs leading-5 text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {error.message || "La réponse n’est pas arrivée. Reformulez la demande, ou réessayez dans un instant."}
          </p>
        ) : null}
        {fileError ? (
          <p role="alert" className="flex items-start gap-1.5 rounded-md bg-danger-soft px-2.5 py-2 text-xs leading-5 text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {fileError}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function ThreadRenameDialog({
  open,
  thread,
  onOpenChange,
  onRename,
}: {
  open: boolean;
  thread: ThreadSummary;
  onOpenChange: (open: boolean) => void;
  onRename: (title: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState(thread.title);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renommer le fil</DialogTitle>
          <DialogDescription>Le nouveau titre remplace celui proposé. Il n’est pas réécrit par les messages suivants.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            start(async () => {
              const failure = await onRename(value);
              if (failure) {
                setError(failure);
                return;
              }
              onOpenChange(false);
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="thread-title">Titre</Label>
            <Input id="thread-title" value={value} maxLength={80} onChange={(event) => setValue(event.target.value)} />
          </div>
          {thread.suggested ? (
            <button
              type="button"
              className="w-fit text-left text-xs text-primary underline-offset-4 hover:underline"
              onClick={() => setValue(thread.suggested)}
            >
              Titre proposé : {thread.suggested}
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Enregistrement…" : "Enregistrer le titre"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewThreadButton({ onNewThread, labelled = false }: { onNewThread?: () => void; labelled?: boolean }) {
  const className = labelled
    ? buttonVariants({ variant: "outline", size: "sm" })
    : "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground";
  const content = (
    <>
      <MessageSquarePlus aria-hidden="true" className={labelled ? "size-3.5" : "size-4"} />
      {labelled ? "Nouveau fil" : null}
    </>
  );
  if (onNewThread) {
    return (
      <button type="button" aria-label="Nouveau fil" title="Nouveau fil" className={className} onClick={onNewThread}>
        {content}
      </button>
    );
  }
  return (
    <Link href="/?nouveau=1" aria-label="Nouveau fil" title="Nouveau fil" className={className}>
      {content}
    </Link>
  );
}

function MessageRow({
  message,
  pending,
  live,
  confirm,
  proposalState,
  editable,
  onConfirm,
  onAmend,
  onCorrect,
}: {
  message: ChatMessage;
  pending: boolean;
  live: boolean;
  confirm: boolean;
  proposalState: ProposalState;
  editable: boolean;
  onConfirm: () => void;
  onAmend: () => void;
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
  const packet = message.metadata?.packet ?? null;
  const source = message.metadata?.source ?? "";

  const mine = message.role === "user";
  const version = provenanceLabel(message.metadata?.modelVersion ?? "");

  if (mine) {
    return (
      <li className="flex justify-end">
        <article
          aria-label={label}
          className="w-fit max-w-[min(88%,36rem)] rounded-lg rounded-br-sm bg-primary-soft px-3 py-2 text-sm leading-6 break-words whitespace-pre-wrap text-foreground"
        >
          {text}
        </article>
      </li>
    );
  }

  const tone = SOURCE_TONE[source];
  return (
    <li className="flex gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
          source === "action" ? "bg-success-soft text-success" : "bg-surface-2 text-muted-foreground",
        )}
      >
        {source === "action" ? <CircleCheck className="size-3.5" /> : <Sparkles className="size-3.5" />}
      </span>
      <article aria-label={label} className="grid min-w-0 flex-1 gap-2 break-words">
        {tone || version ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {tone ? <StatusBadge tone={tone}>{label}</StatusBadge> : null}
            {version ? <span className="text-[0.7rem] text-muted-foreground">{version}</span> : null}
          </div>
        ) : null}
        {steps.length > 0 ? (
          <ul className="grid gap-0.5 border-l-2 border-border pl-2">
            {steps.map((step, index) => (
              <li key={`${step}-${index}`} className="text-xs leading-5 text-muted-foreground">
                {step}
              </li>
            ))}
          </ul>
        ) : null}
        {packet ? <PacketCard packet={packet} /> : text ? <p className="text-sm leading-6 whitespace-pre-wrap">{text}</p> : null}
        {live && !text ? (
          <span className="inline-flex items-center gap-2 py-1 text-xs text-muted-foreground" role="status">
            <span className="inline-flex gap-1" aria-hidden="true">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
              <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
            </span>
            Réponse en cours
          </span>
        ) : null}
        {proposal.length > 0 ? (
          <AssistantProposalCard
            state={proposalState}
            fields={proposal}
            actions={
              confirm ? (
                <>
                  <Button type="button" size="sm" disabled={pending} onClick={onConfirm}>
                    Confirmer
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onAmend}>
                    Préciser la demande
                  </Button>
                </>
              ) : null
            }
          />
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
        {sources.length > 0 ? (
          <p className="text-[0.7rem] leading-5 text-muted-foreground">
            Sources : {sources.map((item) => `${item.label} ${item.title}`).join(" · ")}
          </p>
        ) : null}
      </article>
    </li>
  );
}

const SOURCE_TONE: Record<string, StatusTone> = {
  "regle-metier": "neutral",
  action: "success",
  proposition: "proposal",
  dossier: "info",
};

function proposalState(messages: ChatMessage[], index: number, latest: boolean): ProposalState {
  if (latest) return "a_confirmer";
  const reply = messages[index + 1];
  const outcome = messages[index + 2];
  const confirmed =
    reply?.role === "user" &&
    reply.parts.some((part) => part.type === "text" && /^je confirme\b/i.test(part.text.trim())) &&
    outcome?.role === "assistant" &&
    outcome.metadata?.source === "action";
  return confirmed ? "confirmee" : "sans_suite";
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
      packet: turn.packet,
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

function PacketCard({ packet }: { packet: AnswerPacket }) {
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2.5">
      <p className="text-sm font-medium leading-6">{packet.title}</p>
      {packet.period ? <p className="text-sm leading-6">Période : {packet.period}</p> : null}
      {packet.filters.length > 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">Filtres : {packet.filters.join(", ")}</p>
      ) : null}
      {packet.measures.length > 0 ? (
        <dl className="grid gap-1 text-sm">
          {packet.measures.map((measure) => (
            <div key={measure.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">{measure.label}</dt>
              <dd className="text-right tabular-nums">{measure.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {packet.rows.length > 0 ? (
        <ul className="grid gap-1 text-sm leading-6">
          {packet.rows.map((row) => (
            <li key={`${row.label}-${row.detail}`}>
              <span className="font-medium">{row.label}</span>
              <span className="text-muted-foreground"> — {row.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {packet.missing.length > 0 ? (
        <p className="text-sm leading-6">{packet.missing.join(" ")}</p>
      ) : null}
      {packet.method ? <p className="text-xs leading-5 text-muted-foreground">{packet.method}</p> : null}
    </div>
  );
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
    <AssistantProposalCard
      title="Fiche de compréhension"
      state={editable ? "a_confirmer" : "sans_suite"}
      note="La fiche n’écrit rien. La correction vaut pour ce document, elle ne devient pas une règle."
    >
      <form
        className="grid gap-2"
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
        <p className="text-sm leading-6">
          <span className="text-muted-foreground">Action proposée : </span>
          {card.action}
        </p>
        {card.path ? <p className="text-xs leading-5 text-muted-foreground">{card.path}</p> : null}
        {card.understood.length > 0 ? (
          <ul className="grid gap-0.5 text-sm leading-6">
            {card.understood.map((line) => (
              <li key={line} className="flex gap-1.5">
                <CircleCheck aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-success" />
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">Rien n’est encore assez sûr.</p>
        )}
        {card.confirm ? (
          <p className="rounded-md bg-warning-soft px-2.5 py-1.5 text-xs leading-5 text-warning">À confirmer : {card.confirm}</p>
        ) : (
          <p className="text-xs leading-5 text-muted-foreground">Rien à confirmer sur cette fiche.</p>
        )}
        {card.simulation ? <p className="text-xs leading-5 text-muted-foreground">{card.simulation}</p> : null}
        {editable ? (
          <>
            <div className="grid gap-2 @lg:grid-cols-3">
              <CardField id={`${formId}-projet`} name="projet" label="Projet" value={card.project} options={card.projects} />
              <CardField id={`${formId}-type`} name="type" label="Type" value={card.documentType} options={card.types} />
              <CardField id={`${formId}-fournisseur`} name="fournisseur" label="Fournisseur" value={card.supplier} options={card.suppliers} />
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={pending} className="w-fit">
              Corriger la fiche
            </Button>
          </>
        ) : null}
      </form>
    </AssistantProposalCard>
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
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} name={name} list={`${id}-list`} defaultValue={value} />
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
