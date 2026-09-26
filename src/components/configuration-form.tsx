"use client";

import { useActionState } from "react";
import {
  saveConfigurationAction,
  type ConfigurationState,
} from "@/app/configuration/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const emptyState: ConfigurationState = { message: null, ok: false };

export function ConfigurationForm({
  serverUrl,
  chatModel,
  embedModel,
  keyHint,
  chatModels,
  embedModels,
}: {
  serverUrl: string;
  chatModel: string;
  embedModel: string;
  keyHint: string;
  chatModels: string[];
  embedModels: string[];
}) {
  const [state, action, pending] = useActionState(saveConfigurationAction, emptyState);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="serverUrl">Adresse du serveur</Label>
        <Input
          id="serverUrl"
          name="serverUrl"
          required
          defaultValue={serverUrl}
          placeholder="http://192.168.1.5:11434"
          className="h-11"
          autoComplete="off"
        />
        <p className="text-xs leading-5 text-muted-foreground">
          Machine du réseau local uniquement. Exemple VirtualBox en NAT : http://10.0.2.2:11434.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="apiKey">Clé d’API</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="new-password"
          placeholder={keyHint ? "Laisser vide pour conserver la clé" : "Facultative"}
          className="h-11"
        />
        {keyHint ? (
          <p className="text-xs text-muted-foreground">Clé enregistrée {keyHint}. Elle n’est pas réaffichée.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Envoyée seulement vers ce serveur, dans l’en-tête Authorization. Rien n’est transmis à un service public.
          </p>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="clearKey" className="size-4" />
          Retirer la clé enregistrée
        </label>
      </div>
      <ModelField
        id="chatModel"
        label="Modèle de conversation"
        hint="Vide : le premier modèle adapté, de préférence environ 7 milliards de paramètres."
        defaultValue={chatModel}
        options={chatModels}
      />
      <ModelField
        id="embedModel"
        label="Modèle d’index"
        hint="Vide : nomic-embed-text s’il est installé. Il se décharge avant la conversation."
        defaultValue={embedModel}
        options={embedModels}
      />
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm" : "text-sm text-destructive"}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11 w-fit px-4">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

function ModelField({
  id,
  label,
  hint,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  hint: string;
  defaultValue: string;
  options: string[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        list={`${id}-choices`}
        defaultValue={defaultValue}
        placeholder="Automatique"
        className="h-11"
        autoComplete="off"
      />
      <datalist id={`${id}-choices`}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}
