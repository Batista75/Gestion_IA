import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const file = await readFile(
      path.join(process.cwd(), "docs/specifications-gestion-ia.pdf"),
    );
    return new Response(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'inline; filename="specifications-gestion-ia.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "La spécification est introuvable." },
      { status: 404 },
    );
  }
}
