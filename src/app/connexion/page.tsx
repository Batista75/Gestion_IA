import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { devAdmin } from "@/domain/account";
import { AuthForm } from "@/components/auth-form";
import { accountCount, ensureDevAdmin } from "@/lib/accounts";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  await ensureDevAdmin();
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) redirect("/");
  const first = (await accountCount()) === 0;
  const proposed = process.env.NODE_ENV === "development" ? devAdmin : null;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <AuthForm mode={first ? "creer" : "entrer"} devAdmin={proposed} />
    </main>
  );
}
