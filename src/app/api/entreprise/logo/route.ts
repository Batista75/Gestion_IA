import { NextResponse } from "next/server";
import { readCompanyLogo } from "@/lib/company-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const logo = await readCompanyLogo();
  if (!logo) return new NextResponse("Introuvable", { status: 404 });
  return new NextResponse(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "private, no-store",
    },
  });
}
