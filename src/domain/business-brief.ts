export type VatZone = "france" | "intracom" | "export";
export type MoneyCurrency = "EUR" | "USD";

export type ClientBrief = {
  reference: string;
  name: string;
  country: string;
  sector: string;
  currency: string;
  contactName: string;
  email: string;
};

export type ArticleBrief = {
  reference: string;
  name: string;
  kind: "produit" | "service";
  domain: string;
  unit: string;
  statedPrice: string;
  currency: string;
  vatNote: string;
};

export type ProjectBrief = {
  reference: string;
  name: string;
  clientRef: string;
  primaryClient: string;
  sector: string;
  budgetStated: string;
  status: string;
  lead: string;
  purpose: string;
  currency: string;
};

export type QuoteLineBrief = {
  reference: string;
  name: string;
  quantity: string;
  unit: string;
  statedAmount: string;
  currency: MoneyCurrency;
};

export type QuoteBrief = {
  reference: string;
  clientName: string;
  clientRef: string;
  projectName: string;
  projectRef: string;
  currency: MoneyCurrency;
  vatZone: VatZone;
  conditions: string;
  discountRate: number;
  discountReferences: string[];
  lines: QuoteLineBrief[];
  statedTotalHt: string;
  statedVat: string;
  statedTotalTtc: string;
};

export type BusinessPlan = {
  clients: ClientBrief[];
  articles: ArticleBrief[];
  projects: ProjectBrief[];
  quotes: QuoteBrief[];
};

export function emptyPlan(): BusinessPlan {
  return { clients: [], articles: [], projects: [], quotes: [] };
}

export function planIsEmpty(plan: BusinessPlan): boolean {
  return (
    plan.clients.length === 0 &&
    plan.articles.length === 0 &&
    plan.projects.length === 0 &&
    plan.quotes.length === 0
  );
}

export function parseBusinessBrief(text: string): BusinessPlan {
  const plan = emptyPlan();
  plan.clients = parseClientRows(text);
  plan.articles = [...parseArticleRows(text, "produit"), ...parseArticleRows(text, "service")];
  const spoken = parseSpokenProjects(text);
  const tabulated = parseProjectRows(text);
  plan.projects = dedupeProjects([...spoken, ...tabulated]);
  plan.quotes = parseQuotes(text);
  return plan;
}

export function matchDirectoryName(asked: string, names: string[]): string | null {
  const key = fold(asked);
  if (key.length < 3) return null;
  const exact = uniqueNames(names.filter((name) => fold(name) === key));
  if (exact.length === 1) return exact[0] ?? null;
  const tokens = key.split(" ").filter((token) => token.length >= 3);
  if (tokens.length === 0) return null;
  const hits = uniqueNames(
    names.filter((name) => {
      const folded = fold(name);
      return tokens.every((token) => folded.includes(token));
    }),
  );
  return hits.length === 1 ? hits[0] ?? null : null;
}

function parseSpokenProjects(text: string): ProjectBrief[] {
  const flat = text.replace(/\s+/g, " ").trim();
  const starter = /(?:cr[ée]e(?:r|z)?|ouvre(?:z)?)\s+(?:le\s+)?projet\s*:?\s*/gi;
  const projects: ProjectBrief[] = [];
  for (const match of flat.matchAll(starter)) {
    const start = (match.index ?? 0) + match[0].length;
    const parsed = parseOneProject(flat.slice(start, start + 500));
    if (parsed) projects.push(parsed);
  }
  return projects;
}

function parseOneProject(slice: string): ProjectBrief | null {
  let body = slice.trim();
  let purpose = "";
  const purposeMatch = body.match(/^(.*?)(?:\s*[.]\s*|\s+)le projet consiste [àa]\s+(.+)$/i);
  if (purposeMatch) {
    body = (purposeMatch[1] ?? "").trim();
    purpose = clipPurpose(purposeMatch[2] ?? "");
  } else {
    body = body.split(/[.]/)[0] ?? body;
  }
  const clientMatch = body.match(/^(.*?)\s+pour\s+(?:le\s+)?client\s+(.+)$/i);
  if (!clientMatch) return null;
  const name = clean(clientMatch[1] ?? "");
  const primaryClient = clean(clientMatch[2] ?? "");
  if (name.length < 2 || primaryClient.length < 2) return null;
  if (/^(id|cli-|prd-|srv-|prj-)/i.test(name)) return null;
  return {
    reference: "",
    name,
    clientRef: "",
    primaryClient,
    sector: "",
    budgetStated: "",
    status: "À qualifier",
    lead: "",
    purpose,
    currency: "EUR",
  };
}

function clipPurpose(value: string): string {
  const cut = value.split(/\s+(?=\d+\.\s|Clients\b|Catalogues\b|ID Client\b|ID Produit\b)/)[0] ?? value;
  return clean(cut.replace(/[.\s]+$/, ""));
}

function parseClientRows(text: string): ClientBrief[] {
  const rows: ClientBrief[] = [];
  let on = false;
  for (const line of text.split(/\n/)) {
    const cells = columns(line);
    if (/^id client\b/i.test(cells[0] ?? line)) {
      on = true;
      continue;
    }
    if (on && /^(id produit|id service|id projet|\d+\.)/i.test(cells[0] ?? "")) {
      on = false;
    }
    if (!on || !/^CLI-/i.test(cells[0] ?? "")) continue;
    const brief = clientFromCells(cells);
    if (brief) rows.push(brief);
  }
  return rows;
}

function clientFromCells(cells: string[]): ClientBrief | null {
  const [reference, name, country, sector, currency, contactName, email] = cells;
  if (!reference || !name || name.length < 2) return null;
  return {
    reference: reference.trim(),
    name: name.trim(),
    country: (country ?? "").trim(),
    sector: (sector ?? "").trim(),
    currency: /usd/i.test(currency ?? "") ? "USD" : "EUR",
    contactName: (contactName ?? "").trim(),
    email: (email ?? "").trim(),
  };
}

function parseArticleRows(text: string, kind: "produit" | "service"): ArticleBrief[] {
  const rows: ArticleBrief[] = [];
  let on = false;
  const header = kind === "produit" ? /^id produit\b/i : /^id service\b/i;
  const prefix = kind === "produit" ? /^PRD-/i : /^SRV-/i;
  for (const line of text.split(/\n/)) {
    const cells = columns(line);
    const head = cells[0] ?? "";
    if (header.test(head)) {
      on = true;
      continue;
    }
    if (on && /^(id client|id produit|id service|id projet|\d+\.)/i.test(head) && !header.test(head)) {
      on = false;
    }
    if (!on || !prefix.test(head)) continue;
    const brief = articleFromCells(cells, kind);
    if (brief) rows.push(brief);
  }
  return rows;
}

function articleFromCells(cells: string[], kind: "produit" | "service"): ArticleBrief | null {
  const reference = cells[0]?.trim() ?? "";
  const name = cells[1]?.trim() ?? "";
  if (name.length < 2) return null;
  if (kind === "produit") {
    const [, , domain, unit, price, currency, vatNote] = cells;
    return {
      reference,
      name,
      kind,
      domain: (domain ?? "").trim(),
      unit: (unit ?? "Unité").trim(),
      statedPrice: (price ?? "").trim(),
      currency: /usd/i.test(currency ?? "") ? "USD" : "EUR",
      vatNote: (vatNote ?? "").trim(),
    };
  }
  const [, , serviceType, unit, price, currency, vatNote] = cells;
  return {
    reference,
    name,
    kind,
    domain: (serviceType ?? "").trim(),
    unit: (unit ?? "").trim(),
    statedPrice: (price ?? "").trim(),
    currency: /usd/i.test(currency ?? "") ? "USD" : "EUR",
    vatNote: (vatNote ?? "").trim(),
  };
}

function parseProjectRows(text: string): ProjectBrief[] {
  const rows: ProjectBrief[] = [];
  let on = false;
  for (const line of text.split(/\n/)) {
    const cells = columns(line);
    const head = cells[0] ?? "";
    if (/^id projet\b/i.test(head)) {
      on = true;
      continue;
    }
    if (on && /^(id |sc[ée]nario|\d+\.)/i.test(head)) on = false;
    if (!on || !/^PRJ-/i.test(head)) continue;
    const [reference, name, clientRef, sector, budgetStated, status, lead] = cells;
    if (!name || name.trim().length < 2) continue;
    const budget = (budgetStated ?? "").trim();
    rows.push({
      reference: (reference ?? "").trim(),
      name: name.trim(),
      clientRef: (clientRef ?? "").trim(),
      primaryClient: "",
      sector: (sector ?? "").trim(),
      budgetStated: budget,
      status: statusOf(status ?? ""),
      lead: (lead ?? "").trim(),
      purpose: "",
      currency: /\$|usd/i.test(budget) ? "USD" : "EUR",
    });
  }
  return rows;
}

function parseQuotes(text: string): QuoteBrief[] {
  const parts = text.split(/(?=R[ée]f[ée]rence\s*:\s*DEV-)/i);
  const quotes: QuoteBrief[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const start = part.search(/R[ée]f[ée]rence\s*:\s*DEV-/i);
    if (start < 0) continue;
    const previous = (parts[index - 1] ?? "").split(/\n/).map((line) => line.trim()).filter(Boolean);
    const heading = previous.at(-1) ?? "";
    const block = (part.slice(start).split(/\n(?=Sc[ée]nario\b)/i)[0] ?? part).slice(0, 2500);
    const parsed = parseQuoteBlock(block, heading);
    if (parsed) quotes.push(parsed);
  }
  return quotes;
}

function parseQuoteBlock(block: string, preamble: string): QuoteBrief | null {
  const reference = block.match(/R[ée]f[ée]rence\s*:\s*(DEV-[\w-]+)/i)?.[1] ?? "";
  if (!reference) return null;
  const clientRaw = labeled(block, "client") ?? "";
  const projectRaw = labeled(block, "projet") ?? "";
  const client = splitRef(clientRaw);
  const project = splitRef(projectRaw);
  const devise = labeled(block, "devise") ?? "";
  const currency: MoneyCurrency = /usd|\$/i.test(devise) ? "USD" : "EUR";
  const context = `${preamble}\n${block}`;
  const vatZone: VatZone = /intracom|auto-liquidation|autoliquidation/i.test(context)
    ? "intracom"
    : /export|hors[-\s]ue/i.test(context)
      ? "export"
      : "france";
  const conditions = labeled(block, "conditions commerciales") ?? "";
  const discount = conditions.match(/remise de\s+(\d+(?:[.,]\d+)?)\s*%[^(]*\(([^)]+)\)/i);
  const lines = block
    .split(/\n/)
    .map((line) => parseQuoteLine(line, currency))
    .filter((line): line is QuoteLineBrief => line !== null);
  if (lines.length === 0) return null;
  return {
    reference,
    clientName: client.name,
    clientRef: client.ref,
    projectName: project.name,
    projectRef: project.ref,
    currency,
    vatZone,
    conditions: conditions.trim(),
    discountRate: discount ? Number((discount[1] ?? "0").replace(",", ".")) / 100 : 0,
    discountReferences: (discount?.[2] ?? "")
      .split(/[,/]/)
      .map((item) => item.trim())
      .filter(Boolean),
    lines,
    statedTotalHt: amountLabel(block, /(?:sous-total|total)\s+ht\s*:\s*(.+)/i),
    statedVat: amountLabel(block, /(?:tva|taxe)[^\n:]*:\s*(.+)/i),
    statedTotalTtc: amountLabel(block, /total\s+ttc\s*:\s*(.+)/i),
  };
}

function parseQuoteLine(line: string, currency: MoneyCurrency): QuoteLineBrief | null {
  const match = line
    .trim()
    .match(/^((?:PRD|SRV)-[\w-]+)\s*\(([^)]+)\)\s*[×x]\s*(\d+)\s*([^=]+?)\s*=\s*(.+)$/i);
  if (!match) return null;
  return {
    reference: (match[1] ?? "").trim(),
    name: (match[2] ?? "").trim(),
    quantity: (match[3] ?? "").trim(),
    unit: (match[4] ?? "").trim(),
    statedAmount: (match[5] ?? "").trim(),
    currency: /\$|usd/i.test(match[5] ?? "") ? "USD" : currency,
  };
}

function amountLabel(block: string, pattern: RegExp): string {
  return (block.match(pattern)?.[1] ?? "").trim();
}

function labeled(block: string, label: string): string | null {
  const match = block.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function splitRef(value: string): { name: string; ref: string } {
  const match = value.match(/^(.*?)\s*\(([A-Z]{2,5}-[\w-]+)\)\s*$/);
  if (!match) return { name: value.trim(), ref: "" };
  return { name: (match[1] ?? "").trim(), ref: (match[2] ?? "").trim() };
}

function columns(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("|---")) return [];
  if (trimmed.includes("\t")) return trimmed.split("\t").map((cell) => cell.trim()).filter(Boolean);
  if (trimmed.includes("|")) {
    return trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);
  }
  return trimmed.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
}

function statusOf(raw: string): string {
  const folded = fold(raw);
  if (!folded) return "À qualifier";
  if (folded === "gagne") return "Gagné";
  return raw.trim();
}

function dedupeProjects(projects: ProjectBrief[]): ProjectBrief[] {
  const kept: ProjectBrief[] = [];
  for (const project of projects) {
    const key = project.reference ? fold(project.reference) : fold(project.name);
    const same = kept.find((item) => (item.reference ? fold(item.reference) : fold(item.name)) === key);
    if (!same) {
      kept.push(project);
      continue;
    }
    if (!same.purpose && project.purpose) same.purpose = project.purpose;
    if (!same.primaryClient && project.primaryClient) same.primaryClient = project.primaryClient;
    if (!same.reference && project.reference) same.reference = project.reference;
  }
  return kept;
}

function uniqueNames(names: string[]): string[] {
  return [...new Map(names.map((name) => [fold(name), name])).values()];
}

function clean(value: string): string {
  return value.replace(/^:\s*/, "").replace(/[.\s]+$/, "").replace(/\s+/g, " ").trim();
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
