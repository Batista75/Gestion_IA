"use client";

import { useState, useTransition } from "react";
import { archiveThreadAction, deleteThreadAction, loadThreadAction, renameThreadAction, restoreThreadAction } from "@/app/assistant/thread-actions";
import { AssistantChat } from "@/components/assistant-chat";
import { nextOpenThread, type ThreadSummary } from "@/domain/thread";
import type { StoredTurn } from "@/lib/conversations";

type Thread = { id: string; messages: StoredTurn[]; hidden: number };

export function ProjectAssistant({
  projectName,
  projectStatus,
  current,
  fallbackId,
  threads,
  archived = [],
}: {
  projectName: string;
  projectStatus: string;
  current: Thread | null;
  fallbackId: string;
  threads: ThreadSummary[];
  archived?: ThreadSummary[];
}) {
  const [chosen, setChosen] = useState<Thread | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [aside, setAside] = useState<Record<string, "open" | "archived" | "gone">>({});
  const [lead, setLead] = useState<string[]>([]);
  const [loading, startLoading] = useTransition();
  const shown = chosen ?? current ?? { id: fallbackId, messages: [], hidden: 0 };
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

  function openNext(id: string) {
    const next = nextOpenThread(namedThreads, id);
    setAside((places) => ({ ...places, [id]: "archived" }));
    setLead((ids) => ids.filter((item) => item !== id));
    if (!next) {
      setChosen({ id: crypto.randomUUID(), messages: [], hidden: 0 });
      return;
    }
    startLoading(async () => {
      const thread = await loadThreadAction(next.id);
      setChosen(thread ?? { id: crypto.randomUUID(), messages: [], hidden: 0 });
    });
  }

  function openThread(id: string) {
    if (id === shown.id) return;
    setFailed(null);
    startLoading(async () => {
      const thread = await loadThreadAction(id);
      if (thread) setChosen(thread);
      else setFailed("Ce fil n’a pas pu être rouvert.");
    });
  }

  return (
    <AssistantChat
      key={shown.id}
      fill
      panel
      conversationId={shown.id}
      projectName={projectName}
      projectStatus={projectStatus}
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
          if (!next) setChosen({ id: crypto.randomUUID(), messages: [], hidden: 0 });
          else {
            const thread = await loadThreadAction(next.id);
            setChosen(thread ?? { id: crypto.randomUUID(), messages: [], hidden: 0 });
          }
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
        setChosen(thread);
        return null;
      }}
      onNewThread={() => {
        setFailed(null);
        setChosen({ id: crypto.randomUUID(), messages: [], hidden: 0 });
      }}
      onSelectThread={openThread}
    />
  );
}
