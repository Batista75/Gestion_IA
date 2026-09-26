export type SourceType =
  | "client"
  | "supplier"
  | "product"
  | "project"
  | "quote"
  | "piece"
  | "demand"
  | "inbox";

export type KnowledgeDoc = {
  sourceType: SourceType;
  sourceId: string;
  title: string;
  summary: string;
  body: string;
  embedding?: number[] | null;
};

export type RankedDoc = KnowledgeDoc & { score: number };

const STOP = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "ou", "a", "au", "aux",
  "en", "pour", "sur", "dans", "que", "qui", "est", "sont", "on", "tu", "vous",
  "me", "mon", "ma", "mes", "ce", "cette", "ces", "d", "l", "ne", "pas", "plus",
  "avec", "par", "se", "sa", "son", "ses", "quoi", "quel", "quelle", "quels",
  "quelles", "savoir", "sait", "fiche", "fiches", "client", "clients",
  "fournisseur", "fournisseurs", "produit", "produits", "projet", "projets",
  "devis", "montre", "cherche", "retrouve", "liste", "adresse", "telephone",
  "email", "mail", "nouveau", "nouvelle", "the", "of",
]);

const GENERIC_NAME = new Set([
  "gmbh", "sas", "sarl", "sasu", "eurl", "sci", "ltd", "llc", "inc", "spa", "bv", "sa", "ag",
]);

export function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function sourceLabel(type: SourceType): string {
  switch (type) {
    case "client":
      return "Client";
    case "supplier":
      return "Fournisseur";
    case "product":
      return "Produit";
    case "project":
      return "Projet";
    case "quote":
      return "Devis";
    case "piece":
      return "Pièce";
    case "demand":
      return "Demande";
    case "inbox":
      return "À classer";
  }
}

export type AgentIntent = "directory" | "lookup" | "change" | "open";

const DIRECTORY_STOP = new Set([
  "liste", "quels", "quelles", "qui", "sont", "les", "des", "de", "du", "tous", "toutes",
  "nos", "mes", "montre", "cherche", "clients", "client", "fournisseurs", "fournisseur",
  "produits", "produit", "projets", "projet", "devis", "notes", "note", "classer", "dossiers",
  "dossier", "articles", "article", "particuliers", "particulier", "entreprises", "entreprise",
  "pieces", "piece", "fichiers", "fichier", "jointes", "jointe",
  "demandes", "demande", "rfq",
]);

export function understandIntent(text: string): AgentIntent {
  if (/(?:nouveau client|cr[ée]er (?:un |le |une )?(?:compte )?client|cr[ée]ation d['’]un compte client|fiche client)/i.test(text)) {
    return "open";
  }
  const folded = foldText(text).replace(/[?!.,]/g, "").trim();
  if (isBareDirectory(folded)) return "directory";
  if (recordFocus(folded) && /^(quels|quelles|liste|qui sont)\b/.test(folded)) return "lookup";
  if (
    /^(qui est|qui sont|que sait|que sais|fiche |adresse |telephone |tel |e-mail |email |mail |cherche |retrouve |montre |ou est )/.test(
      folded,
    ) ||
    /\b(que sait-on|que sais-tu)\b/.test(folded)
  ) {
    return "lookup";
  }
  if (/\b(chang|corrig|desormais|mettre a jour|mets a jour|devient|n est plus)\b/.test(folded)) {
    return "change";
  }
  if (/\b(telephone|tel|e-mail|email|adresse)\b/.test(folded) && /\b(est|c est)\b/.test(folded)) {
    return "change";
  }
  return "open";
}

function isBareDirectory(folded: string): boolean {
  if (!recordFocus(folded)) return false;
  if (!/^(liste|quels|quelles|qui sont|montre|cherche)\b/.test(folded)) return false;
  const leftovers = folded
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !DIRECTORY_STOP.has(token));
  return leftovers.length === 0;
}

export function recordFocus(text: string): SourceType | null {
  const folded = foldText(text);
  if (/\b(clients?|particuliers?|entreprises?)\b/.test(folded)) return "client";
  if (/\bfournisseurs?\b/.test(folded)) return "supplier";
  if (/\b(produits?|articles?)\b/.test(folded)) return "product";
  if (/\b(projets?|dossiers?)\b/.test(folded)) return "project";
  if (/\bdevis\b/.test(folded)) return "quote";
  if (/\b(demandes?|rfq)\b/.test(folded)) return "demand";
  if (/\b(pieces?|fichiers?)\b/.test(folded)) return "piece";
  if (/\b(classer|notes?)\b/.test(folded)) return "inbox";
  return null;
}

export function mentionedNames(text: string, names: string[]): string[] {
  const folded = foldText(text);
  const exact = names.filter((name) => {
    const normalized = foldText(name);
    return normalized.length >= 3 && folded.includes(normalized);
  });
  if (exact.length > 0) return unique(exact);
  return unique(
    names.filter((name) =>
      distinctiveTokens(name).some((token) => new RegExp(`\\b${token}\\b`).test(folded)),
    ),
  );
}

export function uniqueNameMatch(text: string, names: string[]): string | null {
  const hits = mentionedNames(text, names);
  return hits.length === 1 ? hits[0] : null;
}

export function lexicalScore(query: string, doc: Pick<KnowledgeDoc, "title" | "body">): number {
  const wanted = tokens(query);
  if (wanted.length === 0) return 0;
  const hay = new Set(tokens(`${doc.title} ${doc.body}`));
  let hits = 0;
  for (const token of wanted) {
    if (hay.has(token)) hits += 1;
  }
  const title = foldText(doc.title);
  if (title.length >= 3 && foldText(query).includes(title)) hits += 3;
  return hits / (wanted.length + 3);
}

export function cosine(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function rankKnowledge(
  query: string,
  docs: KnowledgeDoc[],
  queryVector: number[] | null,
  limit = 5,
): RankedDoc[] {
  return docs
    .map((doc) => {
      const lexical = lexicalScore(query, doc);
      const vector =
        queryVector && doc.embedding && doc.embedding.length > 0
          ? cosine(queryVector, doc.embedding)
          : 0;
      const score =
        queryVector && doc.embedding && doc.embedding.length > 0
          ? 0.7 * Math.max(vector, 0) + 0.3 * lexical
          : lexical;
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function applyRerank(
  docs: RankedDoc[],
  scores: Array<{ index: number; score: number }>,
): RankedDoc[] {
  const byIndex = new Map<number, number>();
  for (const item of scores) {
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= docs.length) continue;
    if (!Number.isFinite(item.score)) continue;
    byIndex.set(item.index, item.score);
  }
  if (byIndex.size === 0) return docs;
  return docs
    .map((doc, index) => ({ doc, index, rerank: byIndex.get(index) }))
    .sort((left, right) => {
      const leftScore = left.rerank ?? Number.NEGATIVE_INFINITY;
      const rightScore = right.rerank ?? Number.NEGATIVE_INFINITY;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return left.index - right.index;
    })
    .map((item) => ({ ...item.doc, score: item.rerank ?? item.doc.score }));
}

export function renderKnowledge(
  docs: Array<Pick<KnowledgeDoc, "sourceType" | "title" | "summary" | "body">>,
  mode: "lookup" | "directory",
): string {
  if (docs.length === 0) {
    return "Aucune fiche enregistrée ne correspond. Je ne complète pas avec une information absente du dossier.";
  }
  if (mode === "directory") {
    const lines = docs.map(
      (doc) => `${sourceLabel(doc.sourceType)} — ${doc.title}${doc.summary ? ` — ${doc.summary}` : ""}`,
    );
    return ["Voici ce qui est enregistré.", ...lines].join("\n");
  }
  const blocks = docs.map(
    (doc) => `${sourceLabel(doc.sourceType)} — ${doc.title}\n${doc.body}`,
  );
  return ["D’après les fiches enregistrées, sans rien inventer :", ...blocks].join("\n\n");
}

export function retrievalContext(
  docs: Array<Pick<KnowledgeDoc, "sourceType" | "title" | "body">>,
): string {
  if (docs.length === 0) return "Aucun extrait de fiche ne correspond à ce message.";
  let text = docs
    .map((doc) => `[${sourceLabel(doc.sourceType)} : ${doc.title}]\n${doc.body}`)
    .join("\n\n");
  if (text.length > 1_600) text = `${text.slice(0, 1_600)}…`;
  return `Extraits des fiches enregistrées :\n${text}`;
}

function tokens(value: string): string[] {
  return foldText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

function distinctiveTokens(name: string): string[] {
  return foldText(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5 && !GENERIC_NAME.has(token));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
