import { interpreterGuide, parseInterpretation, type Interpretation } from "@/domain/interpreter";
import { chatWithOllama } from "@/lib/ollama";

export async function readModelInterpretation(input: {
  model: string;
  text: string;
  context: string;
}): Promise<Interpretation | null> {
  try {
    const result = await chatWithOllama({
      model: input.model,
      json: true,
      timeoutMs: 20_000,
      messages: [
        { role: "system", content: interpreterGuide() },
        { role: "user", content: `${input.context}\n\nDemande : ${input.text.slice(0, 4_000)}` },
      ],
    });
    return parseInterpretation(result.content);
  } catch {
    return null;
  }
}
