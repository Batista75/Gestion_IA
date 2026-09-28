"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { openFirstAccount, openSession } from "@/lib/accounts";
import { SESSION_COOKIE, sessionMaxAgeSeconds } from "@/lib/session";

export type AuthState = { message: string | null };

async function remember(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds(),
  });
}

export async function createAccountAction(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const opened = await openFirstAccount({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if ("error" in opened) return { message: opened.error };
  await remember(opened.token);
  redirect("/");
}

export async function loginAction(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const opened = await openSession({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if ("error" in opened) return { message: opened.error };
  await remember(opened.token);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/connexion");
}
