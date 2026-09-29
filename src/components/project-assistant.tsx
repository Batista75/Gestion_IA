"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { archiveThreadAction, deleteThreadAction, loadThreadAction, renameThreadAction, restoreThreadAction } from "@/app/assistant/thread-actions";
import { AssistantChat } from "@/components/assistant-chat";
import { nextOpenThread, requestedThreadId, threadAddress, type ThreadSummary } from "@/domain/thread";
import type { StoredTurn } from "@/lib/conversations";

type Thread = { id: string; messages: StoredTurn[]; hidden: number; projectName: string };

type Props = {
  projectName: string;
  projectStatus: string;
  current: Thread | null;
  fallbackId: string;
  threads: ThreadSummary[];
  archived?: ThreadSummary[];
  panel?: boolean;
  projectId?: string;
};

export function ProjectAssistant(props: Props) {
  return (
    <Suspense
      fallback={
        <AssistantChat
          fill
          panel={props.panel}
          conversationId={props.current?.id ?? props.fallbackId}
          projectName={props.current?.projectName || props.projectName}
          projectStatus={props.panel ? props.projectStatus : ""}
          initialMessages={props.current?.messages ?? []}
          hidden={props.current?.hidden ?? 0}
          threads={props.threads}
          archivedThreads={props.archived}
        />
      }
    >
      <ProjectAssistantInner {...props} />
    </Suspense>
  );
}

function ProjectAssistantInner({
  projectName,
  projectStatus,
  current,
  fallbackId,
  threads,
  archived = [],
  panel = true,
  projectId = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = requestedThreadId(searchParams.get("fil"));
  const [chosen, setChosen] = useState<Thread | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [aside, setAside] = useState<Record<string, "open" | "archived" | "gone">>({});
  const [lead, setLead] = useState<string[]>([]);
  const [booted, setBooted] = useState(!requested || requested === (current?.id ?? fallbackId));
  const [loading, startLoading] = useTransition();
  const shown = chosen ?? current ?? { id: fallbackId, messages: [], hidden: 0, projectName };
  const known = [...threads, ...archived.filter((thread) => !threads.some((open) => open.id === thread.id))];

  function status(id: string): "open" | "archived" | "gone" {
    return aside[id] ?? (archived.some((thread) => thread.id === id) ? "archived" : "open");
  }

  function present(list: ThreadSummary[]): ThreadSummary[] {
    return list.map((thread) => {
      const title = titles[thread.id];
      if (!title) return thread;
      return { ...thread, title, suggested: thread.suggested === title ? "" : thread.suggested };
    });
  }

  const namedThreads = present(
    [...lead.map((id) => known.find((thread) => thread.id === id)), ...known.filter((thread) => !lead.includes(thread.id))].filter(
      (thread): thread is ThreadSummary => thread != null && status(thread.id) === "open",
    ),
  );
  const archivedThreads = present(known.filter((thread) => status(thread.id) === "archived"));

  function emptyThread(id = crypto.randomUUID()): Thread {
    return { id, messages: [], hidden: 0, projectName: panel ? projectName : "" };
  }

  function fromLoaded(thread: Awaited<ReturnType<typeof loadThreadAction>>): Thread {
    if (!thread) return emptyThread();
    return {
      id: thread.id,
      messages: thread.messages,
      hidden: thread.hidden,
      projectName: thread.projectName || (panel ? projectName : ""),
    };
  }

  function remember(thread: Thread) {
    setChosen(thread);
    const next = threadAddress(pathname, thread.id, searchParams.toString());
    if (`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}` !== next) {
      router.replace(next, { scroll: false });
    }
  }

  async function adopt(id: string): Promise<string | null> {
    const thread = await loadThreadAction(id);
    if (!thread) {
      remember(emptyThread(id));
      return null;
    }
    if (panel && projectId && thread.projectId && thread.projectId !== projectId) {
      return "Ce fil appartient à un autre dossier.";
    }
    if (archived.some((item) => item.id === id)) {
      const restored = await restoreThreadAction(id);
      if ("error" in restored) return restored.error;
      setAside((places) => ({ ...places, [id]: "open" }));
      setLead((ids) => [id, ...ids.filter((item) => item !== id)]);
    }
    remember(fromLoaded(thread));
    return null;
  }

  useEffect(() => {
    if (booted) return;
    let cancelled = false;
    startLoading(async () => {
      const failure = await adopt(requested);
      if (cancelled) return;
      if (failure) setFailed(failure);
      setBooted(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- démarrage unique depuis l’adresse
  }, [booted]);

  useEffect(() => {
    if (!booted) return;
    if (searchParams.get("fil") === shown.id && !searchParams.has("nouveau")) return;
    if (requested && requested !== shown.id) return;
    router.replace(threadAddress(pathname, shown.id, searchParams.toString()), { scroll: false });
  }, [booted, shown.id, pathname, router, searchParams, requested]);

  useEffect(() => {
    if (!booted || !requested || requested === shown.id) return;
    let cancelled = false;
    startLoading(async () => {
      const failure = await adopt(requested);
      if (!cancelled && failure) setFailed(failure);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigation arrière / avant
  }, [booted, requested, shown.id]);

  function openNext(id: string) {
    const next = nextOpenThread(namedThreads, id);
    setAside((places) => ({ ...places, [id]: "archived" }));
    setLead((ids) => ids.filter((item) => item !== id));
    if (!next) {
      remember(emptyThread());
      return;
    }
    startLoading(async () => {
      remember(fromLoaded(await loadThreadAction(next.id)));
    });
  }

  function openThread(id: string) {
    if (id === shown.id) return;
    setFailed(null);
    startLoading(async () => {
      const thread = await loadThreadAction(id);
      if (thread) remember(fromLoaded(thread));
      else setFailed("Ce fil n’a pas pu être rouvert.");
    });
  }

  return (
    <AssistantChat
      key={shown.id}
      fill
      panel={panel}
      conversationId={shown.id}
      projectName={shown.projectName || projectName}
      projectStatus={panel ? projectStatus : ""}
      initialMessages={shown.messages}
      hidden={shown.hidden}
      threads={namedThreads}
      archivedThreads={archivedThreads}
      threadNotice={loading ? "Ouverture du fil…" : failed}
      onRenameThread={async (title) => {
        const result = await renameThreadAction(shown.id, title);
        if ("error" in result) return result.error;
        setTitles((currentTitles) => ({ ...currentTitles, [shown.id]: result.title }));
        return null;
      }}
      onLeaveThread={async (kind) => {
        const id = shown.id;
        const result = kind === "archive" ? await archiveThreadAction(id) : await deleteThreadAction(id);
        if ("error" in result) return result.error;
        if (kind === "delete") {
          setAside((places) => ({ ...places, [id]: "gone" }));
          setLead((ids) => ids.filter((item) => item !== id));
          const next = nextOpenThread(namedThreads, id);
          if (!next) remember(emptyThread());
          else remember(fromLoaded(await loadThreadAction(next.id)));
          return null;
        }
        openNext(id);
        return null;
      }}
      onRestoreThread={async (id) => {
        const result = await restoreThreadAction(id);
        if ("error" in result) return result.error;
        setAside((places) => ({ ...places, [id]: "open" }));
        setLead((ids) => [id, ...ids.filter((item) => item !== id)]);
        const thread = await loadThreadAction(id);
        if (!thread) return "Ce fil n’a pas pu être rouvert.";
        remember(fromLoaded(thread));
        return null;
      }}
      onNewThread={() => {
        setFailed(null);
        remember(emptyThread());
      }}
      onSelectThread={openThread}
    />
  );
}
