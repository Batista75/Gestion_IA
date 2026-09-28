import Link from "next/link";
import { deleteFileAction, deleteInboxAction, updateInboxAction } from "@/app/catalog-actions";
import { AssistantChat } from "@/components/assistant-chat";
import { ConfirmDelete, NoteEditor } from "@/components/record-actions";
import { ProposalBoard, type PendingProposal } from "@/components/proposal-board";
import { fillDocumentProvenance } from "@/lib/document-proposals";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { kindLabel } from "@/domain/offer-versions";
import { homeAlerts, recentProjectCards } from "@/lib/home-board";
import { isConversationId, latestConversation, loadConversation } from "@/lib/conversations";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function proposalView(payload: unknown): {
  fields: Array<{ label: string; value: string }>;
  sources: Array<{ label: string; title: string }>;
} {
  if (!payload || typeof payload !== "object") return { fields: [], sources: [] };
  const value = payload as { fields?: unknown; sources?: unknown };
  return {
    fields: rows(value.fields),
    sources: rows(value.sources).map((source) => ({ label: source.label, title: source.value })),
  };
}

function rows(value: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { label?: unknown; value?: unknown; title?: unknown };
    const label = typeof row.label === "string" ? row.label : "";
    const text = typeof row.value === "string" ? row.value : typeof row.title === "string" ? row.title : "";
    return label && text ? [{ label, value: text }] : [];
  });
}

function previewEnrichment(value: string): string {
  const lines = value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const prices = lines.filter((line) => /prix indiqué/i.test(line));
  const head = lines.filter((line) => !/prix indiqué/i.test(line)).slice(0, 2);
  return [...head, ...prices].slice(0, 8).join("\n");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string; fil?: string }>;
}) {
  const params = await searchParams;
  const fresh = params.nouveau === "1";
  const requested = typeof params.fil === "string" && isConversationId(params.fil) ? params.fil : "";
  const thread = fresh
    ? null
    : requested
      ? await loadConversation(requested)
      : await latestConversation();
  const conversationId = thread?.id ?? (requested && !fresh ? requested : crypto.randomUUID());
  await fillDocumentProvenance();
  const [projects, inbox, proposals, alerts] = await Promise.all([
    recentProjectCards(),
    prisma.inboxItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { files: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.documentProposal.findMany({
      where: { status: "en_attente" },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { file: true },
    }),
    homeAlerts(),
  ]);
  const pending: PendingProposal[] = proposals.map((proposal) => {
    const view = proposalView(proposal.payload);
    return {
      id: proposal.id,
      kind: proposal.kind,
      title: proposal.title,
      summary: proposal.summary,
      fileName: proposal.file?.originalName ?? proposal.title,
      fileId: proposal.fileId ?? "",
      fields: view.fields,
      sources: view.sources,
      modelVersion: proposal.modelVersion,
      confidence: confidenceOf(proposal.confidence),
    };
  });

  const notices = alerts.filter((alert) => alert.href !== "/#a-traiter");

  return (
    <div className="grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)_11rem] gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_18rem] xl:grid-rows-1">
      <section className="flex min-h-0 flex-col gap-2 overflow-hidden">
        {notices.length > 0 ? (
          <ul className="flex shrink-0 flex-wrap gap-2">
            {notices.map((alert) => (
              <li key={alert.text}>
                <Link
                  href={alert.href}
                  className="inline-flex min-h-11 items-center rounded-full bg-muted px-3 text-sm font-medium"
                >
                  {alert.text}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {pending.length > 0 ? (
          <details id="a-traiter" open className="max-h-36 shrink-0 overflow-auto rounded-xl border border-border bg-card">
            <summary className="sticky top-0 min-h-9 cursor-pointer bg-card px-3 py-2 text-sm font-medium">
              À traiter · {pending.length}
            </summary>
            <div className="px-3 pb-3">
              <ProposalBoard proposals={pending} />
            </div>
          </details>
        ) : null}
        <div className="min-h-0 flex-1">
          <AssistantChat
            key={conversationId}
            fill
            conversationId={conversationId}
            projectName={thread?.projectName ?? ""}
            initialMessages={thread?.messages ?? []}
          />
        </div>
      </section>

      <aside className="grid min-h-0 grid-rows-2 gap-2 overflow-hidden">
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-1 overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Projets récents</h2>
          <Link
            href="/projets"
            className="inline-flex h-8 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Tous
          </Link>
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Aucun dossier. Le premier se crée dans{" "}
              <Link href="/projets" className="font-medium text-foreground">
                Projets
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <ul className="min-h-0 divide-y divide-border overflow-auto rounded-lg border border-border bg-card">
            {projects.map((project) => (
              <li key={project.id}>
                <Link href={`/projets/${project.id}`} className="grid gap-0.5 px-3 py-2 hover:bg-muted/60">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{project.name}</span>
                    <Badge variant="secondary">{project.status}</Badge>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {project.client || "Client non indiqué"}
                    {project.nextAction ? ` · ${project.nextAction}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Devis {project.quoted} · coûts {project.cost} · marge {project.margin}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details id="pieces" open className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
          Pièces reçues{inbox.length > 0 ? ` · ${inbox.length}` : ""}
        </summary>
        <div className="grid min-h-0 gap-2 overflow-auto px-3 pb-3">
        {inbox.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Aucune information en attente.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {inbox.map((item) => (
              <li key={item.id}>
                <Card size="sm">
                  <CardContent className="grid gap-2">
                    <p className="text-sm leading-6 break-words">{item.body}</p>
                    {item.files.length > 0 ? (
                      <ul className="grid gap-2">
                        {item.files.map((file) => (
                          <li key={file.id} className="rounded-lg bg-muted px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={`/api/pieces/${file.id}`}
                                className="text-sm font-medium break-all underline-offset-4 hover:underline"
                              >
                                {file.originalName}
                              </a>
                              <Badge variant="secondary">{kindLabel(file.kind)}</Badge>
                            </div>
                            {file.enrichment ? (
                              <p className="mt-1 text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                                {previewEnrichment(file.enrichment)}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {item.createdAt.toLocaleString("fr-FR")} · sans projet
                    </p>
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">Modifier ou supprimer</summary>
                      <div className="grid gap-3 pt-3">
                        <NoteEditor action={updateInboxAction} id={item.id} body={item.body} />
                        {item.files.map((file) => (
                          <ConfirmDelete
                            key={file.id}
                            action={deleteFileAction}
                            id={file.id}
                            label={`Supprimer ${file.originalName}`}
                            confirm={`Supprimer le document ${file.originalName} ? Le fichier quitte cette machine.`}
                          />
                        ))}
                        <ConfirmDelete
                          action={deleteInboxAction}
                          id={item.id}
                          label="Supprimer la note"
                          confirm="Supprimer cette note et ses documents ?"
                        />
                      </div>
                    </details>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>
      </aside>
    </div>
  );
}

function confidenceOf(value: unknown): Array<{ field: string; confidence: number }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const field = "field" in item && typeof item.field === "string" ? item.field : "";
    const confidence = "confidence" in item && typeof item.confidence === "number" ? item.confidence : null;
    if (!field || confidence === null || confidence < 0 || confidence > 1) return [];
    return [{ field, confidence }];
  });
}
