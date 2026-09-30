import { structuredPlanGuide } from "@/domain/structured-plan";
import { chatWithOllama } from "@/lib/ollama";

export async function readStructuredPlan(input: { model: string; text: string }): Promise<string | null> {
  try {
    const result = await chatWithOllama({
      model: input.model,
      json: true,
      timeoutMs: 20_000,
      messages: [
        { role: "system", content: structuredPlanGuide() },
        { role: "user", content: input.text.slice(0, 4_000) },
      ],
    });
    return result.content;
  } catch {
    return null;
  }
}
