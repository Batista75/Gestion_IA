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
  rerankModel,
  keyHint,
  chatModels,
  embedModels,
  rerankModels,
}: {
  serverUrl: string;
  chatModel: string;
  embedModel: string;
  rerankModel: string;
  keyHint: string;
  chatModels: string[];
  embedModels: string[];
  rerankModels: string[];
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
      <ModelSelect
        id="chatModel"
        label="Modèle conversationnel"
        hint="Liste limitée aux modèles de conversation du serveur. Automatique : Qwen2.5-14B-Instruct quantifié Q4_K_M, s’il est installé (souvent qwen2.5:14b)."
        value={chatModel}
        options={chatModels}
      />
      <ModelSelect
        id="embedModel"
        label="Modèle d’embeddings"
        hint="Liste limitée aux modèles d’embeddings du serveur. Automatique : bge-m3, s’il est installé. Il se décharge avant la conversation."
        value={embedModel}
        options={embedModels}
      />
      <ModelSelect
        id="rerankModel"
        label="Reranker"
        hint="Liste limitée aux rerankers du serveur. Automatique : bge-reranker-v2-m3, s’il est installé. Il relit les fiches candidates et écarte celles qui ne répondent pas. Sans lui, le tri reste lexical et vectoriel."
        value={rerankModel}
        options={rerankModels}
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

function ModelSelect({
  id,
  label,
  hint,
  value,
  options,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  options: string[];
}) {
  const choices = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={choices.includes(value) ? value : ""}
        className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <option value="">Automatique</option>
        {choices.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <p className="text-xs leading-5 text-muted-foreground">
        {choices.length === 0 ? "Aucun modèle de ce type n’est annoncé par le serveur. " : ""}
        {hint}
      </p>
    </div>
  );
}
