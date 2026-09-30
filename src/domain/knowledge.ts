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
    if (/\b(dossier|projet|affaire)\b/.test(folded) && /\b(pour|chez|client)\b/.test(folded)) return "open";
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

export function bareNameQuestion(text: string, titles: string[]): string | null {
  if (understandIntent(text) !== "open") return null;
  const folded = foldText(text).replace(/[?!.,]/g, "").trim();
  if (
    /\b(creer|cree|creez|ajoute|ajouter|ajoutez|ouvre|ouvrir|ouvrez|modifi\w*|chang\w*|supprim\w*|confirm\w*|devis|mettre|mets|mettez|nouveau|nouvelle|enregistrer|enregistre)\b/.test(
      folded,
    )
  ) {
    return null;
  }
  const hits = mentionedNames(text, titles);
  if (hits.length !== 1) return null;
  const name = hits[0] ?? "";
  const nameTokens = new Set(
    foldText(name)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
  const queryTokens = folded.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
  if (queryTokens.length === 0 || queryTokens.length > 4) return null;
  if (!queryTokens.every((token) => nameTokens.has(token))) return null;
  return `${name} est déjà enregistré. Voulez-vous consulter la fiche ou la modifier ?`;
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

export function recallCandidates(
  query: string,
  docs: KnowledgeDoc[],
  queryVector: number[] | null,
  limit = 12,
): RankedDoc[] {
  const scored = docs.map((doc) => {
    const lexical = lexicalScore(query, doc);
    const vector =
      queryVector && doc.embedding && doc.embedding.length > 0
        ? Math.max(cosine(queryVector, doc.embedding), 0)
        : 0;
    const score = vector > 0 ? 0.7 * vector + 0.3 * lexical : lexical;
    return { doc, lexical, vector, score };
  });
  const byHybrid = [...scored].filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const byLexical = [...scored].filter((item) => item.lexical > 0).sort((a, b) => b.lexical - a.lexical);
  const byVector = [...scored].filter((item) => item.vector > 0).sort((a, b) => b.vector - a.vector);
  const seen = new Set<string>();
  const merged: RankedDoc[] = [];
  for (const item of [...byHybrid.slice(0, 8), ...byLexical.slice(0, 8), ...byVector.slice(0, 8)]) {
    const key = `${item.doc.sourceType}:${item.doc.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...item.doc, score: item.score });
    if (merged.length >= limit) break;
  }
  return merged;
}

export function rerankPassage(
  query: string,
  doc: Pick<KnowledgeDoc, "title" | "summary" | "body">,
): string {
  const excerpt = focusExcerpt(query, doc.body, 480);
  const head = [doc.title, doc.summary].filter(Boolean).join(" — ");
  return `${head}\n${excerpt}`.trim().slice(0, 700);
}

export function selectReranked(
  docs: RankedDoc[],
  scores: Array<{ index: number; score: number }>,
  limit: number,
): RankedDoc[] | null {
  const byIndex = new Map<number, number>();
  for (const item of scores) {
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= docs.length) continue;
    if (!Number.isFinite(item.score)) continue;
    byIndex.set(item.index, item.score);
  }
  if (byIndex.size === 0) return null;
  const values = [...byIndex.values()];
  const distinct = new Set(values.map((value) => value.toFixed(4))).size;
  if (docs.length > 1 && distinct < 2) return null;
  const ranked = [...byIndex.entries()]
    .map(([index, score]) => ({ doc: docs[index], score }))
    .filter((item): item is { doc: RankedDoc; score: number } => Boolean(item.doc))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0]?.score;
  if (best === undefined) return null;
  const probabilistic = values.every((value) => value >= 0 && value <= 1);
  if (probabilistic && best < 0.05) return [];
  const lowest = Math.min(...values);
  const floor = probabilistic ? Math.max(0.15, best * 0.35) : best - Math.max(0.5, (best - lowest) * 0.5);
  const kept = ranked.filter((item) => item.score >= floor);
  const chosen = (kept.length > 0 ? kept : ranked.slice(0, 1)).slice(0, limit);
  return chosen.map((item) => ({ ...item.doc, score: item.score }));
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

function focusExcerpt(query: string, body: string, max: number): string {
  const lines = body
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  const wanted = new Set(focusTokens(query));
  let bestIndex = 0;
  let bestHits = 0;
  lines.forEach((line, index) => {
    const hits = focusTokens(line).filter((token) => wanted.has(token)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestIndex = index;
    }
  });
  const start = bestHits > 0 ? Math.max(0, bestIndex - 1) : 0;
  return lines.slice(start, start + 4).join("\n").slice(0, max);
}

function focusTokens(value: string): string[] {
  return foldText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
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
