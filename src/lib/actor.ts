import { currentOperatorMark } from "@/domain/operator";
import { readSessionToken, SESSION_COOKIE, type Session } from "@/lib/session";

export async function currentSession(): Promise<Session | null> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return readSessionToken(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function currentActor(): Promise<string> {
  const session = await currentSession();
  if (session?.mark) return session.mark;
  return currentOperatorMark();
}
