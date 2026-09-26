import { SEARCH_TOOL, isEmbedOnlyModel } from "@/domain/agent";
import {
  CATALOG_TOOLS,
  commandFromTool,
  commandsFromText,
  parseCatalogCommand,
  type CatalogCommand,
} from "@/domain/catalog";
import {
  identifyClient,
  isNewClientBrief,
  proposalFields,
  readConfirmation,
  reviseDraft,
} from "@/domain/client-file";
import { renderKnowledge, retrievalContext, sourceLabel, understandIntent } from "@/domain/knowledge";
import {
  asksModelToComputeMoney,
  MONEY_RULE_REPLY,
} from "@/domain/ollama-endpoint";
import { applyCatalogCommand } from "@/lib/catalog-store";
import {
  confirmCurrentProposal,
  currentProposal,
  openClientProposal,
  proposeChangeFromMessage,
  proposeFromParty,
  type ProposalView,
} from "@/lib/client-proposals";
import { withGpuLane } from "@/lib/gpu-lane";
import { searchKnowledge } from "@/lib/knowledge-store";
import {
  chatWithOllama,
  getOllamaStatus,
  SYSTEM_PROMPT,
  type OllamaChatMessage,
} from "@/lib/ollama";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 12;
const MAX_CHARS = 4_000;

type IncomingMessage = { role: "user" | "assistant"; content: string };
type SourceRef = { label: string; title: string };

const AGENT_TOOLS = [...CATALOG_TOOLS, SEARCH_TOOL];

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Message illisible." }, { status: 400 });
  }

  const parsed = parsePayload(payload);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const lastUser = [...parsed.messages]
    .reverse()
    .find((message) => message.role === "user");
  if (lastUser) {
    const direct = await answerDirectly(lastUser.content);
    if (direct) return Response.json(direct);
  }

  const status = await getOllamaStatus();
  if (!status.ok || !status.defaultModel) {
    return Response.json(
      {
        error: `${status.error ?? "Ollama est indisponible."} Une recherche dans les fiches, par exemple « que sait-on de Marie Dupont », fonctionne sans le modèle.`,
      },
      { status: 503 },
    );
  }

  const model = parsed.model ?? status.defaultModel;
  if (!status.models.includes(model)) {
    return Response.json(
      { error: "Ce modèle n’est pas installé sur le PC hôte." },
      { status: 400 },
    );
  }

  if (isEmbedOnlyModel(model)) {
    return Response.json(
      { error: "Ce modèle sert à l’index des fiches, pas à la conversation." },
      { status: 400 },
    );
  }

  try {
    const reply = await withGpuLane(async () => {
      const docs = await searchKnowledge(lastUser?.content ?? "", "context");
      return runAssistant(model, parsed.messages, docs);
    });
    return Response.json({
      reply: reply.text,
      model: reply.source === "proposition" || reply.source === "dossier" ? null : model,
      source: reply.source,
      proposal: reply.proposal,
      sources: reply.sources,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "L’inférence a échoué.";
    return Response.json({ error: message }, { status: 502 });
  }
}

async function answerDirectly(text: string) {
  const brief = isNewClientBrief(text) || Boolean(identifyClient(text));
  if (asksModelToComputeMoney(text) && !brief) {
    return { reply: MONEY_RULE_REPLY, model: null, source: "regle-metier" as const };
  }

  const verdict = readConfirmation(text);
  const pending = await currentProposal();
  if (verdict === "confirm") {
    const saved = await confirmCurrentProposal();
    return {
      reply: saved.summary,
      model: null,
      source: saved.ok ? ("action" as const) : ("proposition" as const),
    };
  }
  if (pending && verdict === "reject") {
    return {
      reply:
        "La fiche n’est pas enregistrée. Indiquez ce qu’il faut changer, par exemple le téléphone, le pays ou la forme juridique.",
      model: null,
      source: "proposition" as const,
      proposal: { fields: proposalFields(pending) },
    };
  }

  const command = parseCatalogCommand(text);
  const clientCommand =
    command && (command.type === "create_client" || command.type === "update_client")
      ? command
      : null;
  const intent = understandIntent(text);
  if (intent === "lookup" || intent === "directory") {
    return withGpuLane(() => answerFromDossier(text, intent));
  }

  if (clientCommand) {
    const identified = identifyClient(text);
    if (identified) return proposalResponse(await openClientProposal(identified));
    return proposalFromCommand(clientCommand);
  }
  if (!pending || isNewClientBrief(text)) {
    const identified = identifyClient(text);
    if (identified) return proposalResponse(await openClientProposal(identified));
  }
  if (command) {
    const applied = await applyCatalogCommand(command);
    return { reply: applied.summary, model: null, source: "action" as const };
  }

  if (pending && !isNewClientBrief(text)) {
    const revised = reviseDraft(pending, text);
    if (!revised.changed) {
      return {
        reply:
          "Je n’ai pas identifié de champ à corriger. Précisez-le, par exemple « le téléphone est le 06 98 76 54 32 ».",
        model: null,
        source: "proposition" as const,
        proposal: { fields: proposalFields(pending) },
      };
    }
    return proposalResponse(await openClientProposal(revised.draft));
  }

  if (intent === "change") {
    const changed = await proposeChangeFromMessage(text);
    if (changed) {
      return {
        reply: changed.reply,
        model: null,
        source: changed.proposal ? ("proposition" as const) : ("dossier" as const),
        proposal: changed.proposal,
        sources: changed.sources,
      };
    }
  }
  return null;
}

async function proposalFromCommand(
  command: Extract<CatalogCommand, { type: "create_client" | "update_client" }>,
) {
  const opened = await proposeFromParty(command);
  if ("clarify" in opened) {
    return { reply: opened.clarify, model: null, source: "dossier" as const };
  }
  return proposalResponse(opened);
}

async function answerFromDossier(text: string, intent: "lookup" | "directory") {
  const docs = await searchKnowledge(text, intent);
  return {
    reply: renderKnowledge(docs, intent),
    model: null,
    source: "dossier" as const,
    sources: docs.map((doc) => ({ label: sourceLabel(doc.sourceType), title: doc.title })),
  };
}

function proposalResponse(opened: ProposalView) {
  return {
    reply: opened.reply,
    model: null,
    source: "proposition" as const,
    proposal: opened.proposal,
  };
}

async function runAssistant(
  model: string,
  incoming: IncomingMessage[],
  docs: Awaited<ReturnType<typeof searchKnowledge>>,
): Promise<{
  text: string;
  source: "ollama" | "action" | "proposition" | "dossier";
  proposal?: ProposalView["proposal"];
  sources?: SourceRef[];
}> {
  const sources = docs.map((doc) => ({ label: sourceLabel(doc.sourceType), title: doc.title }));
  let transcript: OllamaChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${retrievalContext(docs)}\nUne note À classer n’est pas un projet.`,
    },
    ...incoming.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
  const summaries: string[] = [];

  for (let round = 0; round < 2; round += 1) {
    const result = await chatWithOllama({
      model,
      messages: transcript,
      tools: AGENT_TOOLS,
    });
    const searches = result.toolCalls.filter((call) => call.function.name === "search_records");
    const commands = uniqueCommands([
      ...result.toolCalls.map((call) =>
        commandFromTool(call.function.name, parseArguments(call.function.arguments)),
      ),
      ...commandsFromText(result.content),
    ]);
    if (commands.length === 0 && searches.length === 0) {
      return {
        text: joinReply(result.content, summaries),
        source: summaries.length > 0 ? "action" : "ollama",
        sources,
      };
    }

    transcript = [
      ...result.messages,
      {
        role: "assistant",
        content: result.content,
        tool_calls: result.toolCalls,
      },
    ];
    for (const call of searches) {
      const args = parseArguments(call.function.arguments);
      const query =
        args && typeof args === "object" && "query" in args && typeof args.query === "string"
          ? args.query
          : incoming.at(-1)?.content ?? "";
      const found = await searchKnowledge(query, "lookup");
      const rendered = renderKnowledge(found, "lookup");
      summaries.push(rendered);
      for (const doc of found) {
        sources.push({ label: sourceLabel(doc.sourceType), title: doc.title });
      }
      transcript.push({ role: "tool", content: rendered, tool_name: "search_records" });
    }
    for (const command of commands) {
      if (command.type === "create_client" || command.type === "update_client") {
        const opened = await proposeFromParty(command);
        if ("clarify" in opened) {
          return { text: opened.clarify, source: "dossier", sources };
        }
        return {
          text: joinReply(opened.reply, summaries),
          source: "proposition",
          proposal: opened.proposal,
          sources,
        };
      }
      const applied = await applyCatalogCommand(command);
      summaries.push(applied.summary);
      transcript.push({
        role: "tool",
        content: applied.summary,
        tool_name: command.type,
      });
    }
    if (searches.length === 0) break;
  }

  return { text: joinReply("", summaries), source: "action", sources };
}

function parseArguments(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function uniqueCommands(commands: Array<CatalogCommand | null>): CatalogCommand[] {
  const seen = new Set<string>();
  const unique: CatalogCommand[] = [];
  for (const command of commands) {
    if (!command) continue;
    const key = JSON.stringify(command);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(command);
  }
  return unique;
}

function joinReply(content: string, summaries: string[]): string {
  const extra = summaries.filter((summary) => !content.includes(summary));
  return [content.trim(), ...extra].filter(Boolean).join("\n\n");
}

function parsePayload(
  payload: unknown,
):
  | { ok: true; messages: IncomingMessage[]; model: string | null }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Message illisible." };
  }

  const body = payload as { messages?: unknown; model?: unknown };
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, error: "Écrivez un message avant d’envoyer." };
  }
  if (body.messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      error: "La conversation est trop longue. Effacez-la et recommencez.",
    };
  }

  const messages: IncomingMessage[] = [];
  for (const item of body.messages) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Message illisible." };
    }
    const message = item as { role?: unknown; content?: unknown };
    if (message.role !== "user" && message.role !== "assistant") {
      return { ok: false, error: "Message illisible." };
    }
    if (typeof message.content !== "string" || !message.content.trim()) {
      return { ok: false, error: "Le message est vide." };
    }
    if (message.content.length > MAX_CHARS) {
      return { ok: false, error: "Le message dépasse 4 000 caractères." };
    }
    messages.push({ role: message.role, content: message.content.trim() });
  }

  if (messages.at(-1)?.role !== "user") {
    return { ok: false, error: "Le dernier message doit venir de vous." };
  }

  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : null;
  if (model && !/^[\w.:-]{1,80}$/.test(model)) {
    return { ok: false, error: "Nom de modèle invalide." };
  }

  return { ok: true, messages, model };
}
