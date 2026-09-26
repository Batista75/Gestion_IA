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
import {
  asksModelToComputeMoney,
  MONEY_RULE_REPLY,
} from "@/domain/ollama-endpoint";
import { applyCatalogCommand } from "@/lib/catalog-store";
import {
  confirmCurrentProposal,
  currentProposal,
  openClientProposal,
  proposeFromParty,
  type ProposalView,
} from "@/lib/client-proposals";
import {
  chatWithOllama,
  getOllamaStatus,
  type OllamaChatMessage,
} from "@/lib/ollama";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 12;
const MAX_CHARS = 4_000;

type IncomingMessage = { role: "user" | "assistant"; content: string };

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
      { error: status.error ?? "Ollama est indisponible." },
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

  try {
    const reply = await runAssistant(model, parsed.messages);
    return Response.json({
      reply: reply.text,
      model: reply.source === "proposition" ? null : model,
      source: reply.source,
      proposal: reply.proposal,
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
  if (pending && !isNewClientBrief(text) && (!command || clientCommand)) {
    if (clientCommand) {
      const opened = await proposeFromParty(clientCommand);
      return proposalResponse(opened);
    }
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

  if (clientCommand) return proposalResponse(await proposeFromParty(clientCommand));
  const identified = identifyClient(text);
  if (identified) return proposalResponse(await openClientProposal(identified));
  if (command) {
    const applied = await applyCatalogCommand(command);
    return { reply: applied.summary, model: null, source: "action" as const };
  }
  return null;
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
): Promise<{
  text: string;
  source: "ollama" | "action" | "proposition";
  proposal?: ProposalView["proposal"];
}> {
  let transcript: OllamaChatMessage[] = incoming.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  const summaries: string[] = [];

  for (let round = 0; round < 3; round += 1) {
    const result = await chatWithOllama({
      model,
      messages: transcript,
      tools: CATALOG_TOOLS,
    });
    const commands = uniqueCommands([
      ...result.toolCalls.map((call) =>
        commandFromTool(call.function.name, parseArguments(call.function.arguments)),
      ),
      ...commandsFromText(result.content),
    ]);
    if (commands.length === 0) {
      return {
        text: joinReply(result.content, summaries),
        source: summaries.length > 0 ? "action" : "ollama",
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
    for (const command of commands) {
      if (command.type === "create_client" || command.type === "update_client") {
        const opened = await proposeFromParty(command);
        return {
          text: joinReply(opened.reply, summaries),
          source: "proposition",
          proposal: opened.proposal,
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
  }

  return { text: joinReply("", summaries), source: "action" };
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
