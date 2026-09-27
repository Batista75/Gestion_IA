export type PartyInput = {
  name: string;
  siren: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

export type ProductInput = {
  name: string;
  reference: string;
  unit: string;
  description: string;
  supplierName: string;
  kind?: string;
  costStated?: string;
  currency?: string;
  sourceNote?: string;
  sourceUrl?: string;
};

export type CatalogCommand =
  | { type: "create_client"; party: PartyInput }
  | { type: "update_client"; party: PartyInput }
  | { type: "create_supplier"; party: PartyInput }
  | { type: "update_supplier"; party: PartyInput }
  | { type: "create_product"; product: ProductInput }
  | { type: "update_product"; product: ProductInput }
  | {
      type: "create_project";
      name: string;
      primaryClient: string;
      nextAction: string;
    }
  | { type: "record_quote"; title: string; products: ProductInput[] };

export type CommandField = { label: string; value: string };

export function presentCommand(command: CatalogCommand): { reply: string; fields: CommandField[] } {
  const fields = commandFields(command);
  return {
    fields,
    reply: [
      ...fields.map((field) => `${field.label} : ${field.value}`),
      "Rien n’est enregistré avant votre accord.",
      "Confirmez-vous l’enregistrement ?",
    ].join("\n"),
  };
}

function commandFields(command: CatalogCommand): CommandField[] {
  switch (command.type) {
    case "create_client":
    case "update_client":
    case "create_supplier":
    case "update_supplier":
      return [
        { label: "Action", value: command.type.startsWith("update") ? "Mise à jour" : "Création" },
        {
          label: "Fiche",
          value: command.type.includes("client") ? "Client" : "Fournisseur",
        },
        { label: "Nom", value: command.party.name },
        ...filled("E-mail", command.party.email),
        ...filled("Téléphone", command.party.phone),
        ...filled("Adresse", command.party.address),
        ...filled("SIREN", command.party.siren),
      ];
    case "create_product":
    case "update_product":
      return [
        { label: "Action", value: command.type === "update_product" ? "Mise à jour" : "Création" },
        { label: "Fiche", value: "Produit" },
        { label: "Nom", value: command.product.name },
        ...filled("Référence", command.product.reference),
        ...filled("Unité", command.product.unit),
        ...filled("Fournisseur", command.product.supplierName),
      ];
    case "create_project":
      return [
        { label: "Action", value: "Création" },
        { label: "Fiche", value: "Projet" },
        { label: "Nom", value: command.name },
        { label: "Client", value: command.primaryClient },
        ...filled("Prochaine action", command.nextAction),
      ];
    case "record_quote":
      return [
        { label: "Action", value: "Création" },
        { label: "Fiche", value: "Devis" },
        { label: "Titre", value: command.title },
        {
          label: "Produits",
          value: command.products.map((product) => product.name).filter(Boolean).join(", "),
        },
      ];
  }
}

function filled(label: string, value: string): CommandField[] {
  const text = value.trim();
  return text ? [{ label, value: text }] : [];
}

const FIELD_RE =
  /^(email|e-mail|t[ée]l[ée]phone|t[ée]l|siren|siret|adresse|notes|r[ée]f[ée]rence|unit[ée]|description|fournisseur|client|action|produit|article)\b\s*[:=]?\s*([\s\S]*)$/i;

export function productOrigin(source: string, quotes: string[]): string {
  const titles = [...new Set(quotes.map((quote) => quote.trim()).filter(Boolean))];
  if (titles.length > 0) {
    const prefix =
      source === "assistant"
        ? "Saisi par l’assistant · "
        : source === "manuel"
          ? "Saisie manuelle · "
          : "";
    return `${prefix}Devis : ${titles.join(", ")}`;
  }
  if (source === "assistant") return "Saisi par l’assistant";
  if (source === "devis") return "Issu d’un devis";
  if (source === "facture") return "Issu d’une facture";
  if (source === "commande") return "Issu d’une commande";
  if (source === "rfq") return "Issu d’une demande de prix";
  if (source === "fiche") return "Issu d’une fiche technique";
  return "Saisie manuelle";
}

export function nameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function parseCatalogCommand(text: string): CatalogCommand | null {
  const sentence = text.trim().replace(/\s+/g, " ");
  if (!sentence) return null;

  const quote = sentence.match(
    /^(?:enregistre(?:r|z)?\s+(?:un\s+|le\s+)?)?devis\s+([\s\S]+)$/i,
  );
  if (quote) return parseQuote(quote[1] ?? "");

  const update = sentence.match(
    /^(?:mettre\s+[àa]\s+jour|mets\s+[àa]\s+jour|mettez\s+[àa]\s+jour|mise\s+[àa]\s+jour(?:\s+du|\s+de|\s+d['’])?)\s+(?:le\s+|la\s+|du\s+)?(?:compte\s+)?(client|fournisseur|produit)\s+([\s\S]+)$/i,
  );
  if (update) {
    const kind = fold(update[1] ?? "");
    const fields = splitSegments(update[2] ?? "");
    if (kind === "client") return partyCommand("update_client", fields);
    if (kind === "fournisseur") return partyCommand("update_supplier", fields);
    return productCommand("update_product", fields);
  }

  const create = sentence.match(
    /^(?:cr[ée]e(?:r|z)?|ajoute(?:r|z)?|ouvre(?:z)?|cr[ée]ation)\s+(?:d['’]un\s+|d['’]une\s+|d['’]\s+|un\s+|une\s+|le\s+|la\s+|du\s+)?(?:compte\s+)?(client|fournisseur|produit|projet)\s+([\s\S]+)$/i,
  );
  if (!create) return null;
  const kind = fold(create[1] ?? "");
  const fields = splitSegments(create[2] ?? "");
  if (kind === "client") return partyCommand("create_client", fields);
  if (kind === "fournisseur") return partyCommand("create_supplier", fields);
  if (kind === "produit") return productCommand("create_product", fields);
  return projectCommand(fields);
}

export function commandFromTool(
  name: string,
  raw: unknown,
): CatalogCommand | null {
  const args = asRecord(raw);
  if (!args) return null;
  if (
    name === "create_client" ||
    name === "update_client" ||
    name === "create_supplier" ||
    name === "update_supplier"
  ) {
    return {
      type: name,
      party: partyFromRecord(args),
    };
  }
  if (name === "create_product" || name === "update_product") {
    return { type: name, product: productFromRecord(args) };
  }
  if (name === "create_project") {
    return {
      type: "create_project",
      name: text(args.name),
      primaryClient: text(args.primaryClient || args.client),
      nextAction: text(args.nextAction || args.action),
    };
  }
  if (name === "record_quote") {
    const products = Array.isArray(args.products)
      ? args.products.map(productFromRecord)
      : [];
    return { type: "record_quote", title: text(args.title), products };
  }
  return null;
}

export function commandsFromText(source: string): CatalogCommand[] {
  const commands: CatalogCommand[] = [];
  for (const raw of extractJsonObjects(source)) {
    const record = asRecord(raw);
    const tool = record ? text(record.tool || record.name) : "";
    const command = commandFromTool(tool, record?.arguments ?? record);
    if (command) commands.push(command);
  }
  return commands;
}

export function validateParty(
  input: PartyInput,
): { ok: true; value: PartyInput } | { ok: false; error: string } {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    return { ok: false, error: "Indiquez un nom d’au moins 2 caractères." };
  }
  if (name.length > 120) {
    return { ok: false, error: "Le nom dépasse 120 caractères." };
  }
  const email = input.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "L’adresse e-mail n’est pas valide." };
  }
  const siren = input.siren.replace(/\s/g, "");
  if (siren && !/^\d{9}(\d{5})?$/.test(siren)) {
    return {
      ok: false,
      error: "Le SIREN comporte 9 chiffres, le SIRET 14.",
    };
  }
  return {
    ok: true,
    value: {
      name,
      siren,
      email,
      phone: clip(input.phone, 30),
      address: clip(input.address, 300),
      notes: clip(input.notes, 1000),
    },
  };
}

export function validateProduct(
  input: ProductInput,
): { ok: true; value: ProductInput } | { ok: false; error: string } {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    return { ok: false, error: "Indiquez un nom de produit d’au moins 2 caractères." };
  }
  if (name.length > 120) {
    return { ok: false, error: "Le nom du produit dépasse 120 caractères." };
  }
  const unit = input.unit.trim() || "u";
  if (unit.length > 20) {
    return { ok: false, error: "L’unité dépasse 20 caractères." };
  }
  const sourceUrl = readSupplierUrl(input.sourceUrl ?? "");
  if (!sourceUrl.ok) return sourceUrl;
  return {
    ok: true,
    value: {
      name,
      reference: clip(input.reference, 60),
      unit,
      description: clip(input.description, 1000),
      supplierName: input.supplierName.trim().replace(/\s+/g, " "),
      kind: input.kind === "service" ? "service" : "produit",
      costStated: clip(input.costStated ?? "", 80),
      currency: input.currency === "USD" ? "USD" : input.currency === "EUR" ? "EUR" : "",
      sourceNote: clip(input.sourceNote ?? "", 500),
      sourceUrl: sourceUrl.value,
    },
  };
}

/** Lien http ou https vers le site du fournisseur. Vide si rien n’est saisi. */
export function readSupplierUrl(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, value: "" };
  if (value.length > 500) return { ok: false, error: "Le lien dépasse 500 caractères." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Le lien doit commencer par http:// ou https://." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Le lien doit commencer par http:// ou https://." };
  }
  return { ok: true, value: url.toString() };
}

export const CATALOG_TOOLS = [
  tool(
    "create_client",
    "Propose une fiche client (particulier ou entreprise, France ou international). L’enregistrement attend la confirmation de l’utilisateur.",
    partyParameters(),
  ),
  tool(
    "update_client",
    "Propose la mise à jour d’une fiche client identifiée par son nom. Rien n’est écrit avant confirmation.",
    partyParameters(),
  ),
  tool("create_supplier", "Crée un fournisseur.", partyParameters()),
  tool("update_supplier", "Met à jour un fournisseur identifié par son nom.", partyParameters()),
  tool("create_product", "Ajoute un produit au catalogue.", productParameters()),
  tool("update_product", "Met à jour un produit identifié par son nom.", productParameters()),
  tool("create_project", "Crée un projet. Ne crée pas la fiche client : elle passe par une proposition à confirmer.", {
    type: "object",
    properties: {
      name: { type: "string" },
      primaryClient: { type: "string" },
      nextAction: { type: "string" },
    },
    required: ["name", "primaryClient"],
  }),
  tool("record_quote", "Enregistre un devis et ajoute ses produits au catalogue.", {
    type: "object",
    properties: {
      title: { type: "string" },
      products: {
        type: "array",
        items: productParameters(),
      },
    },
    required: ["title", "products"],
  }),
];

function partyCommand(
  type: "create_client" | "update_client" | "create_supplier" | "update_supplier",
  segments: string[],
): CatalogCommand | null {
  const party = partyFromSegments(segments);
  if (!party.name) return null;
  return { type, party };
}

function productCommand(
  type: "create_product" | "update_product",
  segments: string[],
): CatalogCommand | null {
  const product = productFromSegments(segments);
  if (!product.name) return null;
  return { type, product };
}

function projectCommand(segments: string[]): CatalogCommand | null {
  let name = segments[0]?.trim() ?? "";
  if (!name || parseField(name)) return null;
  let primaryClient = "";
  let nextAction = "";
  const inline = name.match(/^(.+?)\s+pour\s+(?:le\s+)?client\s+(.+)$/i);
  if (inline) {
    name = (inline[1] ?? "").trim();
    primaryClient = (inline[2] ?? "").trim();
  }
  for (const segment of segments.slice(1)) {
    const field = parseField(segment);
    if (!field) return null;
    if (field.key === "client") primaryClient = field.value;
    if (field.key === "action") nextAction = field.value;
  }
  if (name.length < 2) return null;
  return { type: "create_project", name, primaryClient, nextAction };
}

function parseQuote(rest: string): CatalogCommand | null {
  const segments = splitSegments(rest);
  const title = segments[0]?.trim() ?? "";
  if (title.length < 2 || parseField(title)) return null;
  const products: ProductInput[] = [];
  let current: ProductInput | null = null;
  for (const segment of segments.slice(1)) {
    const productStart = segment.match(/^(?:produit|article)\s+([\s\S]+)$/i);
    if (productStart) {
      if (current) products.push(current);
      current = emptyProduct(productStart[1] ?? "");
      continue;
    }
    if (!current) return null;
    const field = parseField(segment);
    if (!field) return null;
    assignProduct(current, field.key, field.value);
  }
  if (current) products.push(current);
  if (products.length === 0) return null;
  return { type: "record_quote", title, products };
}

function partyFromSegments(segments: string[]): PartyInput {
  const party = emptyParty(segments[0] ?? "");
  for (const segment of segments.slice(1)) {
    const field = parseField(segment);
    if (!field) {
      party.name = `${party.name}, ${segment}`.trim();
      continue;
    }
    assignParty(party, field.key, field.value);
  }
  return party;
}

function productFromSegments(segments: string[]): ProductInput {
  const product = emptyProduct(segments[0] ?? "");
  for (const segment of segments.slice(1)) {
    const field = parseField(segment);
    if (!field) {
      product.name = `${product.name}, ${segment}`.trim();
      continue;
    }
    assignProduct(product, field.key, field.value);
  }
  return product;
}

function splitSegments(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === "," || character === ";") {
      const after = input.slice(index + 1).trim();
      if (character === ";" || parseField(after)) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseField(segment: string): { key: string; value: string } | null {
  const match = FIELD_RE.exec(segment.trim());
  if (!match) return null;
  return { key: fold(match[1] ?? ""), value: (match[2] ?? "").trim() };
}

function assignParty(party: PartyInput, key: string, value: string) {
  if (key === "email" || key === "e-mail") party.email = value;
  if (key === "telephone" || key === "tel") party.phone = value;
  if (key === "siren" || key === "siret") party.siren = value;
  if (key === "adresse") party.address = value;
  if (key === "notes") party.notes = value;
}

function assignProduct(product: ProductInput, key: string, value: string) {
  if (key === "reference") product.reference = value;
  if (key === "unite") product.unit = value;
  if (key === "description" || key === "notes") product.description = value;
  if (key === "fournisseur") product.supplierName = value;
}

function emptyParty(name: string): PartyInput {
  return { name: name.trim(), siren: "", email: "", phone: "", address: "", notes: "" };
}

function emptyProduct(name: string): ProductInput {
  return {
    name: name.trim(),
    reference: "",
    unit: "",
    description: "",
    supplierName: "",
  };
}

function partyFromRecord(args: Record<string, unknown>): PartyInput {
  return {
    name: text(args.name),
    siren: text(args.siren || args.siret),
    email: text(args.email),
    phone: text(args.phone || args.telephone),
    address: text(args.address || args.adresse),
    notes: text(args.notes),
  };
}

function productFromRecord(raw: unknown): ProductInput {
  const args = asRecord(raw) ?? {};
  return {
    name: text(args.name),
    reference: text(args.reference),
    unit: text(args.unit || args.unite),
    description: text(args.description),
    supplierName: text(args.supplierName || args.fournisseur),
  };
}

function extractJsonObjects(text: string): unknown[] {
  const objects: unknown[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let cursor = index; cursor < text.length; cursor += 1) {
      const character = text[cursor];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") inString = false;
        continue;
      }
      if (character === "\"") inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            objects.push(JSON.parse(text.slice(index, cursor + 1)));
          } catch {
            // Ignore prose that only looks like JSON.
          }
          index = cursor;
          break;
        }
      }
    }
  }
  return objects;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
) {
  return { type: "function", function: { name, description, parameters } };
}

function partyParameters() {
  return {
    type: "object",
    properties: {
      name: { type: "string" },
      siren: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      address: { type: "string" },
      notes: { type: "string" },
    },
    required: ["name"],
  };
}

function productParameters() {
  return {
    type: "object",
    properties: {
      name: { type: "string" },
      reference: { type: "string" },
      unit: { type: "string" },
      description: { type: "string" },
      supplierName: { type: "string" },
    },
    required: ["name"],
  };
}
