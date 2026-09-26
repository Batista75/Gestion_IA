import Link from "next/link";
import { AssistantChat } from "@/components/assistant-chat";
import { type PendingProposal } from "@/components/proposal-board";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { kindLabel } from "@/domain/offer-versions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  const [projects, inbox, proposals] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
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
    };
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Accueil</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Un seul assistant suit l’activité, achat-revente ou fourniture de
          services : de la demande de devis reçue jusqu’à la fourniture du
          produit ou du service dans un projet. Il propose les fiches et
          n’ouvre pas de dossier tant que vous ne le lui demandez pas.
        </p>
      </div>

      <AssistantChat proposals={pending} />

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Projets récents</h2>
          <Link
            href="/projets"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Tous les projets
          </Link>
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Aucun dossier. Créez le premier depuis{" "}
              <Link href="/projets" className="font-medium text-foreground">
                Projets
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.primaryClient}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <Badge variant="secondary">{project.status}</Badge>
                    <p className="text-sm">{project.nextAction}</p>
                    {project.purpose ? (
                      <p className="text-sm text-muted-foreground">
                        Le projet consiste à {project.purpose}.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Pièces reçues</h2>
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
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
