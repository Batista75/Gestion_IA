import { operatorMark } from "@/domain/operator";
import { devAdmin, readAccountDraft, readLogin } from "@/domain/account";
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
      role: "admin",
    },
  });
  const session = { id: row.id, mark, role: "admin" };
  return { token: signSession(session), session };
}

export async function ensureDevAdmin(): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;
  const existing = await prisma.account.findUnique({ where: { email: devAdmin.email } });
  if (existing) {
    if (existing.role !== devAdmin.role) {
      await prisma.account.update({ where: { id: existing.id }, data: { role: devAdmin.role } });
    }
    return;
  }
  await prisma.account.create({
    data: {
      email: devAdmin.email,
      firstName: devAdmin.firstName,
      lastName: devAdmin.lastName,
      passwordHash: hashPassword(devAdmin.password),
      role: devAdmin.role,
    },
  });
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
  const session = { id: row.id, mark, role: row.role };
  return { token: signSession(session), session };
}
