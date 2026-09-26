const DEFAULT_OLLAMA_BASE_URL = "http://192.168.1.5:11434";

export function resolveOllamaBaseUrl(
  raw: string | undefined = process.env.OLLAMA_BASE_URL,
): string {
  const value = raw?.trim() || DEFAULT_OLLAMA_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("OLLAMA_BASE_URL n’est pas une adresse valide.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("OLLAMA_BASE_URL doit commencer par http:// ou https://.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("OLLAMA_BASE_URL ne doit contenir qu’une adresse et un port.");
  }
  if (!isPrivateHost(url.hostname)) {
    throw new Error(
      "OLLAMA_BASE_URL doit viser une machine du réseau local. Aucun texte n’est envoyé vers un service public.",
    );
  }

  const path = url.pathname.replace(/\/+$/, "");
  if (path && path !== "/") {
    throw new Error("OLLAMA_BASE_URL ne doit pas contenir de chemin.");
  }

  return `${url.protocol}//${url.host}`;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host.endsWith(".localhost")) {
    return true;
  }

  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }

  const nums = parts.map(Number);
  if (nums.some((part) => part > 255)) return false;
  const [a, b] = nums;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

const MONEY_INTENT =
  /\b(calcul\w*|combien|prix de vente|taux de marque|marge|tva|montant|ht|ttc)\b/;

export function asksModelToComputeMoney(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return MONEY_INTENT.test(normalized) && /\d/.test(normalized);
}

export const MONEY_RULE_REPLY =
  "Les prix, la TVA et la marge ne sont pas calculés par le modèle. Ouvrez Ventes : le simulateur applique le taux de marque sur le coût HT. Exemple de la spécification : un coût de 700 €, une marque de 30 % et une remise de 10 % donnent 1 111,11 € HT affichés et 1 000,00 € HT nets.";
