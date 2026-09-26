import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json(projects);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    primaryClient?: unknown;
    nextAction?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const primaryClient =
    typeof body?.primaryClient === "string" ? body.primaryClient.trim() : "";
  const nextAction =
    typeof body?.nextAction === "string" && body.nextAction.trim()
      ? body.nextAction.trim()
      : "Qualifier le besoin";

  if (name.length < 2 || primaryClient.length < 2) {
    return Response.json(
      { error: "Le nom du projet et le client principal sont requis." },
      { status: 400 },
    );
  }

  const project = await prisma.project.create({
    data: { name, primaryClient, nextAction },
  });

  return Response.json(project, { status: 201 });
}
