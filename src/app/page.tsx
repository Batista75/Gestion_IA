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

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Accueil</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Confirmez une pièce, ou décrivez ce qu’il faut faire. Rien n’est écrit sans votre accord.
          </p>
        </div>
        {alerts.some((alert) => alert.href !== "/#a-traiter") ? (
          <ul className="flex flex-wrap gap-2">
            {alerts
              .filter((alert) => alert.href !== "/#a-traiter")
              .map((alert) => (
                <li key={alert.text}>
                  <Link
                    href={alert.href}
                    className="inline-flex min-h-11 items-center rounded-lg bg-muted px-3 text-sm font-medium"
                  >
                    {alert.text}
                  </Link>
                </li>
              ))}
          </ul>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien n’attend de décision.</p>
        ) : null}
      </div>

      <section id="a-traiter" className="grid scroll-mt-6 gap-3">
        <h2 className="text-lg font-semibold">À traiter</h2>
        <ProposalBoard proposals={pending} />
      </section>

      <section id="assistant" className="grid scroll-mt-6 gap-3">
        <h2 className="text-lg font-semibold">Demande</h2>
        <AssistantChat
          key={conversationId}
          conversationId={conversationId}
          projectName={thread?.projectName ?? ""}
          initialMessages={thread?.messages ?? []}
        />
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Projets récents</h2>
          <Link
            href="/projets"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Tous les projets
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
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {projects.map((project) => (
              <li key={project.id}>
                <Link href={`/projets/${project.id}`} className="grid gap-1 px-3 py-3 hover:bg-muted/60">
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

      <details id="pieces" className="scroll-mt-6 rounded-lg border border-border bg-card">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold">
          Pièces reçues{inbox.length > 0 ? ` · ${inbox.length}` : ""}
        </summary>
        <div className="grid gap-3 px-4 pb-4">
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
