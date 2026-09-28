import { operatorMark } from "@/domain/operator";
import { readAccountDraft, readLogin } from "@/domain/account";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { signSession, type Session } from "@/lib/session";

export async function accountCount(): Promise<number> {
  return prisma.account.count();
}

export async function openFirstAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<{ token: string; session: Session } | { error: string }> {
  const draft = readAccountDraft(input);
  if ("error" in draft) return draft;
  const existing = await prisma.account.count();
  if (existing > 0) {
    return { error: "Un accès existe déjà. Entrez avec l’adresse e-mail et le mot de passe." };
  }
  const mark = operatorMark(draft.firstName, draft.lastName);
  if (!mark) return { error: "Indiquez le prénom et le nom. Ils signeront les modifications." };
  const row = await prisma.account.create({
    data: {
      email: draft.email,
      firstName: draft.firstName,
      lastName: draft.lastName,
      passwordHash: hashPassword(draft.password),
    },
  });
  const session = { id: row.id, mark };
  return { token: signSession(session), session };
}

export async function openSession(input: {
  email: string;
  password: string;
}): Promise<{ token: string; session: Session } | { error: string }> {
  const draft = readLogin(input);
  if ("error" in draft) return draft;
  const row = await prisma.account.findUnique({ where: { email: draft.email } });
  if (!row || !verifyPassword(draft.password, row.passwordHash)) {
    return { error: "Ces identifiants ne correspondent pas. Vérifiez l’adresse e-mail et le mot de passe." };
  }
  const mark = operatorMark(row.firstName, row.lastName) || row.email;
  const session = { id: row.id, mark };
  return { token: signSession(session), session };
}
