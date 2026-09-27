export type DocumentFact = {
  label: string;
  value: string;
  page: number;
  zone: string;
};

type Hit = DocumentFact & { rank: number };

const KINDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bbon de livraison\b/i, label: "Bon de livraison" },
  { pattern: /\bbon de commande\b/i, label: "Bon de commande" },
  { pattern: /\bdemande de prix\b/i, label: "Demande de prix" },
  { pattern: /\bfacture\b/i, label: "Facture" },
  { pattern: /\bavoir\b/i, label: "Avoir" },
  { pattern: /\bdevis\b/i, label: "Devis" },
  { pattern: /\bcommande\b/i, label: "Commande" },
  { pattern: /\btarif\b/i, label: "Tarif" },
];

const NUMBERS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bdevis\s*(?:n[°o]|num[ée]ro|no)?\s*[:.]?\s*([A-Z0-9][\w./-]{2,})/i, label: "Numéro de devis" },
  { pattern: /\bfacture\s*(?:n[°o]|num[ée]ro|no)?\s*[:.]?\s*([A-Z0-9][\w./-]{2,})/i, label: "Numéro de facture" },
  { pattern: /\bcommande\s*(?:n[°o]|num[ée]ro|no)?\s*[:.]?\s*([A-Z0-9][\w./-]{2,})/i, label: "Numéro de commande" },
  { pattern: /\br[ée]f(?:[ée]rence)?\s*[:.]\s*([A-Z0-9][\w./-]{1,})/i, label: "Référence" },
];

const LINE =
  /^(.{2,80}?)\s+(\d+(?:[.,]\d+)?)\s+(pce|pcs|pièces?|unités?|unité|u|kg|m|ml|h|lot)\b\s+(\d{1,3}(?:[ \u00a0.]\d{3})*(?:[,.]\d{2})|\d+(?:[,.]\d{2}))\s*(€|eur)?/i;

const TOTAL =
  /^(?:total(?:\s+ht|\s+ttc)?|montant(?:\s+ht|\s+ttc)?|net [àa] payer)\s*[:.]?\s*(\d{1,3}(?:[ \u00a0.]\d{3})*(?:[,.]\d{2})|\d+(?:[,.]\d{2}))\s*(€|eur)?/i;

/**
 * Lit la pièce seule. La phrase de l’utilisateur n’est pas un argument :
 * elle ne peut ni créer un fait, ni changer un montant.
 */
export function readDocumentFacts(text: string, filename: string, knownNames: string[] = []): { facts: DocumentFact[] } {
  const pages = pagesOf(plainText(text));
  const hits: Hit[] = [];
  let nature = "";
  for (const page of pages) {
    page.lines.forEach((line, index) => {
      const zone = zoneOf(index, page.lines.length);
      if (!nature) {
        const kind = kindOnLine(line);
        if (kind) {
          nature = kind;
          add(hits, 0, "Nature", kind, page.number, zone);
        }
      }
      for (const number of NUMBERS) {
        const match = number.pattern.exec(line);
        if (match?.[1]) add(hits, 1, number.label, match[1], page.number, zone);
      }
      const supplier = /^(?:fournisseur|[ée]metteur)\s*[:.\-]\s*(.{2,80})$/i.exec(line);
      if (supplier?.[1]) add(hits, 2, "Fournisseur", supplier[1], page.number, zone);
      const client = /^(?:client|destinataire)\s*[:.\-]\s*(.{2,80})$/i.exec(line);
      if (client?.[1]) add(hits, 2, "Client", client[1], page.number, zone);
      const date = /\bdate\s*[:.]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/i.exec(line);
      if (date?.[1]) add(hits, 3, "Date", date[1], page.number, zone);
      const validity = /\bvalidit[ée]\s*[:.]?\s*([^.;]{2,40})/i.exec(line);
      if (validity?.[1]) add(hits, 4, "Validité", validity[1], page.number, zone);
      const address = /\badresse\s*[:.]?\s*(.{6,120})/i.exec(line);
      if (address?.[1]) add(hits, 5, "Adresse", address[1], page.number, zone);
      if (!/^(?:total|sous-total|tva|montant|net)\b/i.test(line)) {
        const row = LINE.exec(line);
        if (row) {
          const money = writtenAmount(row[4] ?? "", row[5] ?? "");
          add(hits, 7, "Ligne", `${clean(row[1] ?? "")}, ${row[2]} ${row[3]}, ${money}`, page.number, zone);
        }
      }
      const total = TOTAL.exec(line);
      if (total?.[1]) add(hits, 8, "Montant écrit", writtenAmount(total[1], total[2] ?? ""), page.number, zone);
    });
  }
  if (!nature) {
    const fromName = kindOnLine(filename.replace(/[_.-]+/g, " "));
    if (fromName) add(hits, 0, "Nature", fromName, 1, "nom du fichier");
  }
  for (const name of knownNames) {
    const found = findName(pages, name);
    if (found) add(hits, 9, "Lien possible", found.name, found.page, found.zone);
  }
  const facts = hits
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 16)
    .map(({ label, value, page, zone }) => ({ label, value, page, zone }));
  return { facts };
}

export function factsPreface(document: string, facts: DocumentFact[]): string {
  const name = document.trim();
  if (!name) return "";
  if (facts.length === 0) {
    return `${name} : aucune lecture exploitable. Aucun fait n’est tiré de la phrase.`;
  }
  return [
    `Faits de ${name}, lus sans la phrase.`,
    ...facts.map((fact) => `${fact.label} : ${fact.value} — page ${fact.page}, ${fact.zone}`),
    "Les montants sont ceux de la pièce. Ils ne sont pas recalculés.",
  ].join("\n");
}

function plainText(raw: string): string {
  const stripped = raw.replace(/^<!-- lecture:[^>\n]+ -->\n?/, "");
  const cut = stripped.indexOf("<!-- gestion-ia-passages -->");
  return (cut === -1 ? stripped : stripped.slice(0, cut)).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function pagesOf(text: string): Array<{ number: number; lines: string[] }> {
  if (text.includes("\f")) {
    return text
      .split("\f")
      .map((chunk, index) => ({ number: index + 1, lines: contentLines(chunk) }))
      .filter((page) => page.lines.length > 0);
  }
  const marker = /^(?:<!--\s*page:\s*(\d+)\s*-->|---\s*page\s+(\d+)\s*---)$/i;
  const pages: Array<{ number: number; lines: string[] }> = [];
  let current = { number: 1, lines: [] as string[] };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const mark = marker.exec(line);
    if (mark) {
      if (current.lines.length > 0) pages.push(current);
      current = { number: Number(mark[1] || mark[2]), lines: [] };
      continue;
    }
    if (line) current.lines.push(line);
  }
  if (current.lines.length > 0) pages.push(current);
  return pages;
}

function contentLines(chunk: string): string[] {
  return chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function zoneOf(index: number, count: number): string {
  const line = index + 1;
  const place = line <= 6 ? "en-tête" : line > count - 4 && count > 10 ? "pied" : "corps";
  return `${place}, ligne ${line}`;
}

function kindOnLine(line: string): string | null {
  let best: { index: number; length: number; label: string } | null = null;
  for (const kind of KINDS) {
    const match = kind.pattern.exec(line);
    if (!match || match.index === undefined) continue;
    const length = match[0].length;
    if (!best || match.index < best.index || (match.index === best.index && length > best.length)) {
      best = { index: match.index, length, label: kind.label };
    }
  }
  return best?.label ?? null;
}

function add(hits: Hit[], rank: number, label: string, value: string, page: number, zone: string) {
  const cleanValue = clean(value).slice(0, 160);
  if (!cleanValue) return;
  if (hits.some((hit) => hit.label === label && hit.value === cleanValue)) return;
  const same = hits.filter((hit) => hit.label === label).length;
  const limit = label === "Ligne" ? 4 : label === "Lien possible" ? 2 : label === "Montant écrit" ? 2 : 3;
  if (same >= limit) return;
  hits.push({ rank, label, value: cleanValue, page, zone });
}

function writtenAmount(amount: string, unit: string): string {
  const money = clean(amount);
  return /€|eur/i.test(unit) ? `${money} €` : money;
}

function findName(
  pages: Array<{ number: number; lines: string[] }>,
  name: string,
): { name: string; page: number; zone: string } | null {
  const wanted = clean(name);
  if (wanted.length < 4) return null;
  if (KINDS.some((kind) => fold(kind.label) === fold(wanted))) return null;
  for (const page of pages) {
    for (const [index, line] of page.lines.entries()) {
      if (!containsName(line, wanted)) continue;
      return { name: wanted, page: page.number, zone: zoneOf(index, page.lines.length) };
    }
  }
  return null;
}

function containsName(line: string, name: string): boolean {
  const foldedLine = fold(line);
  const foldedName = fold(name);
  let from = 0;
  while (from < foldedLine.length) {
    const at = foldedLine.indexOf(foldedName, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : foldedLine[at - 1] ?? "";
    const after = foldedLine[at + foldedName.length] ?? "";
    if (!letter(before) && !letter(after)) return true;
    from = at + foldedName.length;
  }
  return false;
}

function letter(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}
