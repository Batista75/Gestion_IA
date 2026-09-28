import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { accountCount } from "@/lib/accounts";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) redirect("/");
  const first = (await accountCount()) === 0;
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <AuthForm mode={first ? "creer" : "entrer"} />
    </main>
  );
}
