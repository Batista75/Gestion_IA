import {
  asksModelToComputeMoney,
  MONEY_RULE_REPLY,
} from "@/domain/ollama-endpoint";
import { chatWithOllama, getOllamaStatus } from "@/lib/ollama";

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
  if (lastUser && asksModelToComputeMoney(lastUser.content)) {
    return Response.json({
      reply: MONEY_RULE_REPLY,
      model: null,
      source: "regle-metier",
    });
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
    const reply = await chatWithOllama({ model, messages: parsed.messages });
    return Response.json({ reply, model, source: "ollama" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "L’inférence a échoué.";
    return Response.json({ error: message }, { status: 502 });
  }
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
