import { currentOperatorMark } from "@/domain/operator";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function currentActor(): Promise<string> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const session = readSessionToken(jar.get(SESSION_COOKIE)?.value);
    if (session?.mark) return session.mark;
  } catch {
    // Hors d’une requête HTTP, le journal garde la marque par défaut.
  }
  return currentOperatorMark();
}
