import { createOpenAI } from "@ai-sdk/openai";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { retrievalContext, sourceLabel } from "@/domain/knowledge";
import { rememberTurn } from "@/lib/conversations";
import { withGpuLane } from "@/lib/gpu-lane";
import { searchKnowledge } from "@/lib/knowledge-store";
import { SYSTEM_PROMPT } from "@/lib/ollama";
import { readTradeInstruction } from "@/lib/trade-steps";
import { loadTechnicalConfig } from "@/lib/technical-settings";

type FieldList = { fields: Array<{ label: string; value: string }> };

type Meta = {
  source: string;
  proposal: FieldList | null;
  sources: Array<{ label: string; title: string }>;
};

type DirectTurn = {
  conversationId: string;
  reply: string;
  source: string;
  step: string;
  proposal?: FieldList | null;
  sources?: Array<{ label: string; title: string }>;
};

export function streamDirect(input: DirectTurn): Response {
  const metadata: Meta = {
    source: input.source,
    proposal: input.proposal ?? null,
    sources: input.sources ?? [],
  };
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const id = "reply";
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });
      writer.write({
        type: "tool-input-available",
        toolCallId: "step",
        toolName: "notice",
        title: input.step,
        input: {},
      });
      writer.write({
        type: "tool-output-available",
        toolCallId: "step",
        output: input.step,
      });
      writer.write({ type: "finish-step" });
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: input.reply });
      writer.write({ type: "text-end", id });
      writer.write({ type: "message-metadata", messageMetadata: metadata });
      await rememberTurn({
        conversationId: input.conversationId,
        role: "assistant",
        content: input.reply,
        source: input.source,
        steps: [input.step],
        proposal: input.proposal,
        sources: input.sources,
      });
      writer.write({ type: "finish", messageMetadata: metadata });
    },
    onError: () => "La réponse n’a pas pu être affichée.",
  });
  return createUIMessageStreamResponse({ stream });
}

export async function streamModel(input: {
  conversationId: string;
  text: string;
  messages: UIMessage[];
  model: string;
  context?: string;
}): Promise<Response> {
  const config = await loadTechnicalConfig();
  const baseUrl = config.serverUrl || process.env.OLLAMA_BASE_URL || "http://192.168.1.5:11434";
  const openai = createOpenAI({
    baseURL: `${baseUrl.replace(/\/$/, "")}/v1`,
    apiKey: config.apiKey || "ollama",
    name: "ollama",
  });
  const side: Meta = { source: "ollama", proposal: null, sources: [] };

  const stream = createUIMessageStream({
    originalMessages: input.messages,
    execute: async ({ writer }) => {
      await withGpuLane(async () => {
        writer.write({ type: "start" });
        writer.write({ type: "start-step" });
        writer.write({
          type: "tool-input-available",
          toolCallId: "lookup",
          toolName: "search_records",
          title: "Recherche dans les fiches",
          input: { query: input.text },
        });
        let docs;
        try {
          docs = await searchKnowledge(input.text, "context");
        } catch {
          writer.write({
            type: "tool-output-available",
            toolCallId: "lookup",
            output: "Recherche interrompue",
          });
          writer.write({ type: "finish-step" });
          await writePlainReply(
            writer,
            input.conversationId,
            "Le modèle n’a pas répondu. Une recherche dans les fiches, par exemple « que sait-on de Marie Dupont », fonctionne sans lui.",
            "dossier",
            ["Serveur injoignable"],
          );
          return;
        }
        side.sources = docs.map((doc) => ({
          label: sourceLabel(doc.sourceType),
          title: doc.title,
        }));
        writer.write({
          type: "tool-output-available",
          toolCallId: "lookup",
          output: side.sources.map((source) => source.title).join(", ") || "Aucune fiche",
        });
        writer.write({ type: "finish-step" });
        const result = streamText({
          model: openai.chat(input.model),
          system: `${SYSTEM_PROMPT}\n\nInstruction métier :\n${readTradeInstruction()}\n\n${input.context ?? ""}\n\n${retrievalContext(docs)}\nTu ne proposes pas d’enregistrement : le catalogue a déjà traité les écritures avant cet appel.`,
          messages: textMessages(input.messages),
          stopWhen: stepCountIs(3),
          temperature: 0.1,
          tools: assistantTools(side),
        });
        await pumpModelStream(result.toUIMessageStream({
          sendStart: false,
          messageMetadata: ({ part }) =>
            part.type === "finish"
              ? {
                  source: side.source,
                  proposal: side.proposal,
                  sources: side.sources,
                }
              : undefined,
        }), writer, input.conversationId, side);
      });
    },
    onError: () => "Le modèle n’a pas répondu. La recherche dans les fiches reste disponible.",
  });
  return createUIMessageStreamResponse({ stream });
}

async function pumpModelStream(
  source: ReadableStream<UIMessageChunk>,
  writer: { write: (part: UIMessageChunk) => void },
  conversationId: string,
  side: Meta,
): Promise<void> {
  const reader = source.getReader();
  const steps = ["Recherche dans les fiches"];
  const texts: string[] = [];
  let toolReply = "";
  let failure = "";
  let persisted = false;
  const persist = async () => {
    if (persisted) return;
    persisted = true;
    const content = texts.join("").trim() || toolReply.trim() || failure.trim() || "Le modèle n’a pas répondu.";
    await rememberTurn({
      conversationId,
      role: "assistant",
      content,
      source: side.source,
      steps,
      proposal: side.proposal,
      sources: side.sources,
    });
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === "text-delta") texts.push(value.delta);
      if (value.type === "error") failure = value.errorText;
      if (
        value.type === "tool-output-available" &&
        value.toolCallId !== "lookup" &&
        typeof value.output === "string"
      ) {
        toolReply = value.output;
      }
      if (value.type === "tool-input-available") {
        const title = value.title || toolTitle(value.toolName);
        if (!steps.includes(title)) steps.push(title);
        writer.write(value.title ? value : { ...value, title });
        continue;
      }
      if (value.type === "finish") {
        await persist();
        writer.write(value);
        continue;
      }
      writer.write(value);
    }
  } finally {
    reader.releaseLock();
    await persist();
  }
}

async function writePlainReply(
  writer: { write: (part: UIMessageChunk) => void },
  conversationId: string,
  reply: string,
  source: string,
  steps: string[],
): Promise<void> {
  const id = "reply";
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: reply });
  writer.write({ type: "text-end", id });
  await rememberTurn({ conversationId, role: "assistant", content: reply, source, steps });
  writer.write({ type: "finish" });
}

function textMessages(messages: UIMessage[]) {
  return messages.flatMap((message) => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("\n")
      .trim();
    return content ? [{ role: message.role, content }] : [];
  });
}

function assistantTools(side: Meta) {
  return {
    search_records: tool({
      description: "Relit les fiches déjà enregistrées avant de citer une information. N’écrit rien.",
      inputSchema: jsonSchema<{ query: string }>({
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      }),
      execute: async ({ query }) => {
        const { renderKnowledge } = await import("@/domain/knowledge");
        const found = await searchKnowledge(query, "lookup");
        side.sources = found.map((doc) => ({ label: sourceLabel(doc.sourceType), title: doc.title }));
        return renderKnowledge(found, "lookup");
      },
    }),
    search_client_agreements: tool({
      description: "Lit les conditions commerciales d’un seul client. Le filtre client est obligatoire.",
      inputSchema: jsonSchema<{ clientId: string }>({
        type: "object",
        properties: { clientId: { type: "string" } },
        required: ["clientId"],
      }),
      execute: async ({ clientId }) => {
        const { readClientAgreements } = await import("@/lib/hybrid-quote");
        const prepared = await readClientAgreements(clientId);
        side.sources = prepared.sources;
        return prepared.reply;
      },
    }),
    get_product_info: tool({
      description: "Lit le catalogue SQL : référence, désignation, prix indiqué et stock. Ne calcule rien.",
      inputSchema: jsonSchema<{ searchTerm: string }>({
        type: "object",
        properties: { searchTerm: { type: "string" } },
        required: ["searchTerm"],
      }),
      execute: async ({ searchTerm }) => {
        const { prisma } = await import("@/lib/db");
        const products = await prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { reference: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
          take: 8,
        });
        if (products.length === 0) return "Aucun article ne correspond.";
        return products
          .map((product) =>
            [
              product.reference || "sans référence",
              product.name,
              product.statedPrice.trim() ? `prix indiqué ${product.statedPrice}` : "prix catalogue non indiqué",
              product.stockQty === null ? "stock non indiqué" : `stock ${product.stockQty}`,
              product.kind === "service" ? "service" : "matériel",
            ].join(" · "),
          )
          .join("\n");
      },
    }),
  };
}

function toolTitle(name: string): string {
  switch (name) {
    case "search_records":
      return "Recherche dans les fiches";
    case "search_client_agreements":
      return "Conditions du client";
    case "get_product_info":
      return "Catalogue";
    default:
      return "Étape";
  }
}
