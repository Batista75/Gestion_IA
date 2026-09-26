import { getOllamaStatus } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getOllamaStatus();
  return Response.json(status);
}
