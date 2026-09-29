"use client";

import { useState, useTransition } from "react";
import { loadThreadAction, renameThreadAction } from "@/app/assistant/thread-actions";
import { AssistantChat } from "@/components/assistant-chat";
import type { ThreadSummary } from "@/domain/thread";
import type { StoredTurn } from "@/lib/conversations";

type Thread = { id: string; messages: StoredTurn[]; hidden: number };

export function ProjectAssistant({
  projectName,
  projectStatus,
  current,
  fallbackId,
  threads,
}: {
  projectName: string;
  projectStatus: string;
  current: Thread | null;
  fallbackId: string;
  threads: ThreadSummary[];
}) {
  const [chosen, setChosen] = useState<Thread | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, startLoading] = useTransition();
  const shown = chosen ?? current ?? { id: fallbackId, messages: [], hidden: 0 };
  const namedThreads = threads.map((thread) => {
    const title = titles[thread.id];
    if (!title) return thread;
    return { ...thread, title, suggested: thread.suggested === title ? "" : thread.suggested };
  });

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
      threadNotice={loading ? "Ouverture du fil…" : failed}
      onRenameThread={async (title) => {
        const result = await renameThreadAction(shown.id, title);
        if ("error" in result) return result.error;
        setTitles((currentTitles) => ({ ...currentTitles, [shown.id]: result.title }));
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
