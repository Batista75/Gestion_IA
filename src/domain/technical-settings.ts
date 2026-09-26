export type TechnicalDraft = {
  serverUrl: string;
  chatModel: string;
  embedModel: string;
  apiKey: string;
};

export function maskSecret(secret: string): string {
  const value = secret.trim();
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}

export function nextApiKey(
  current: string,
  typed: string,
  clear: boolean,
): { ok: true; value: string } | { ok: false; error: string } {
  if (clear) return { ok: true, value: "" };
  const next = typed.trim();
  if (!next) return { ok: true, value: current };
  if (!/^[\x21-\x7E]{8,200}$/.test(next)) {
    return {
      ok: false,
      error: "La clé d’API comporte 8 à 200 caractères, sans espace.",
    };
  }
  return { ok: true, value: next };
}

export function cleanModelName(
  value: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const name = value.trim();
  if (!name) return { ok: true, value: "" };
  if (!/^[\w.:-]{1,80}$/.test(name)) {
    return { ok: false, error: "Le nom du modèle n’est pas valide." };
  }
  return { ok: true, value: name };
}

export function effectiveSetting(saved: string, fallback: string | undefined): string {
  const value = saved.trim();
  return value || fallback?.trim() || "";
}
