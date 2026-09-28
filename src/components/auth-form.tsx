"use client";

import { useActionState, useState } from "react";
import { createAccountAction, loginAction, type AuthState } from "@/app/connexion/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: AuthState = { message: null };

export function AuthForm({ mode }: { mode: "creer" | "entrer" }) {
  if (mode === "creer") return <CreateAccess />;
  return <EnterAccess />;
}

function CreateAccess() {
  const [state, action, pending] = useActionState(createAccountAction, initial);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const ready =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.includes("@") &&
    password.length >= 8 &&
    password === confirm;
  return (
    <form action={action} className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-card p-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Créer l’accès</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Premier passage sur cette machine. Le prénom et le nom signeront les modifications. Ensuite, l’adresse et le mot de passe seront demandés à chaque visite.
        </p>
      </div>
      <Field id="firstName" label="Prénom" value={firstName} onChange={setFirstName} autoComplete="given-name" />
      <Field id="lastName" label="Nom" value={lastName} onChange={setLastName} autoComplete="family-name" />
      <Field id="email" label="Adresse e-mail" value={email} onChange={setEmail} type="email" autoComplete="username" />
      <Field id="password" label="Mot de passe" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
      <Field id="confirm" label="Confirmation" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" />
      <p className="text-xs leading-5 text-muted-foreground">Au moins 8 caractères. Les deux saisies doivent être identiques.</p>
      <Button type="submit" disabled={!ready || pending} className="min-h-11 px-4">
        {pending ? "Création…" : "Créer l’accès"}
      </Button>
      <Notice message={state.message} />
    </form>
  );
}

function EnterAccess() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const ready = email.trim().length > 0 && password.length > 0;
  return (
    <form action={action} className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-card p-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Entrez l’adresse et le mot de passe de cette machine. Les dossiers restent fermés tant que la connexion n’est pas faite.
        </p>
      </div>
      <Field id="email" label="Adresse e-mail" value={email} onChange={setEmail} type="email" autoComplete="username" />
      <Field id="password" label="Mot de passe" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
      <Button type="submit" disabled={!ready || pending} className="min-h-11 px-4">
        {pending ? "Vérification…" : "Entrer"}
      </Button>
      <Notice message={state.message} />
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete: string;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11"
      />
    </div>
  );
}

function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm leading-6 text-destructive">
      {message}
    </p>
  );
}
