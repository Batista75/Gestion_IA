import { situationModelGuide } from "@/domain/situation-reading";
import { chatWithOllama } from "@/lib/ollama";

export async function readSituationMentions(input: { model: string; text: string }): Promise<string | null> {
  try {
    const result = await chatWithOllama({
      model: input.model,
      json: true,
      timeoutMs: 20_000,
      messages: [
        { role: "system", content: situationModelGuide() },
        { role: "user", content: input.text },
      ],
    });
    return result.content;
  } catch {
    return null;
  }
}
