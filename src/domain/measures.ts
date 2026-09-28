import type { AnswerPacket } from "./answer-packet.ts";

type RankedOffer = { supplierName: string; statedCost: string; lowest: boolean };

export const PRODUCT_FAMILIES = ["serveur", "poste", "portable", "reseau", "prestation", "autre"] as const;
export type ProductFamily = (typeof PRODUCT_FAMILIES)[number];

const FAMILY_LABEL: Record<ProductFamily, string> = {
  serveur: "Serveur",
  poste: "Poste de travail",
  portable: "Portable",
  reseau: "Réseau",
  prestation: "Prestation",
  autre: "Autre",
};

export function familyLabel(family: string): string {
  return FAMILY_LABEL[family as ProductFamily] ?? "";
}

export function readProductFamily(raw: string): ProductFamily | "" {
  const folded = fold(raw);
  return PRODUCT_FAMILIES.find((family) => family === folded) ?? "";
}

export type MeasureQuestion =
  | { kind: "best_tariff"; reference: string }
  | { kind: "average_margin"; families: ProductFamily[]; period: "previous_month" | "unsupported" | "missing" }
  | { kind: "raised_prices" }
  | { kind: "last_order"; client: string }
  | { kind: "reception_report"; client: string };

export function readMeasureQuestion(text: string): MeasureQuestion | null {
  const folded = fold(text);
  if (/\b(proces-verbal|pv de recette)\b/.test(folded)) {
    return { kind: "reception_report", client: namedClient(text) };
  }
  if (/\bdevis\b/.test(folded) && /\b(en attente|attente)\b/.test(folded) && /\b(augment\w*|hausse|grossiste)\b/.test(folded)) {
    return { kind: "raised_prices" };
  }
  if (/\b(meilleur tarif|meilleur prix|moins cher)\b/.test(folded)) {
    return { kind: "best_tariff", reference: namedReference(text) };
  }
  if (/\bmarge\b/.test(folded) && /\b(moyenne|realisee)\b/.test(folded)) {
    return { kind: "average_margin", families: familiesIn(folded), period: marginPeriod(folded) };
  }
  if (/\b(derniere commande|configuration)\b/.test(folded) && /\bcommande\b/.test(folded)) {
    return { kind: "last_order", client: namedClient(text) };
  }
  return null;
}

export function previousMonthWindow(now: Date): { from: Date; to: Date; label: string } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(from);
  return { from, to, label };
}

export type MarginSample = {
  family: string;
  confirmedAt: Date | null;
  marginCents: number | null;
};

export function averageLineMargin(input: {
  lines: MarginSample[];
  families: ProductFamily[];
  from: Date;
  to: Date;
  periodLabel: string;
}): AnswerPacket {
  const wanted = input.families.map(familyLabel).filter(Boolean);
  if (input.families.length === 0) {
    return emptyPacket(
      "Marge brute moyenne",
      input.periodLabel,
      "Indiquez la catégorie : serveur, poste, portable, réseau ou prestation.",
    );
  }
  const inPeriod = input.lines.filter(
    (line) => line.confirmedAt !== null && line.confirmedAt >= input.from && line.confirmedAt < input.to,
  );
  const kept = inPeriod.filter(
    (line) => input.families.includes(line.family as ProductFamily) && line.marginCents !== null,
  );
  const uncategorized = inPeriod.filter((line) => !line.family).length;
  const filters = wanted;
  if (kept.length === 0) {
    return {
      title: "Marge brute moyenne",
      period: input.periodLabel,
      filters,
      measures: [{ label: "Moyenne", value: "aucune ligne" }],
      rows: [],
      sources: ["Lignes de commande client confirmées"],
      missing: [
        "Aucune ligne confirmée de cette catégorie sur cette période.",
        uncategorized > 0 ? `${uncategorized} ligne(s) de la période n’ont pas de catégorie.` : "",
      ].filter(Boolean),
      method: MARGIN_METHOD,
    };
  }
  const sum = kept.reduce((total, line) => total + (line.marginCents ?? 0), 0);
  const average = Math.round(sum / kept.length);
  return {
    title: "Marge brute moyenne",
    period: input.periodLabel,
    filters,
    measures: [
      { label: "Moyenne", value: euro(average) },
      { label: "Lignes retenues", value: String(kept.length) },
      { label: "Marge cumulée", value: euro(sum) },
    ],
    rows: [],
    sources: ["Lignes de commande client confirmées"],
    missing: uncategorized > 0 ? [`${uncategorized} ligne(s) de la période n’ont pas de catégorie.`] : [],
    method: MARGIN_METHOD,
  };
}

const MARGIN_METHOD =
  "Moyenne arithmétique des marges de ligne déjà calculées (prix de vente HT moins coût HT), sur les commandes client confirmées. Une ligne sans coût est écartée. Cette lecture additionne des centimes déjà enregistrés.";

export type PendingCost = {
  documentTitle: string;
  clientName: string;
  productName: string;
  reference: string;
  costCents: number | null;
  issuedAt: Date;
  offers: Array<{ cents: number | null; at: Date; supplierName: string; statedCost: string }>;
};

export function raisedWholesalePrices(lines: PendingCost[]): AnswerPacket {
  const rows = lines.flatMap((line) => {
    if (line.costCents === null) return [];
    const raised = line.offers
      .filter((offer) => offer.cents !== null && offer.at > line.issuedAt && (offer.cents ?? 0) > (line.costCents ?? 0))
      .sort((left, right) => right.at.getTime() - left.at.getTime());
    const next = raised[0];
    if (!next) return [];
    return [
      {
        label: line.reference || line.productName,
        detail: `${line.documentTitle}, ${line.clientName}. Coût du devis ${euro(line.costCents)}. Offre plus tardive ${next.statedCost || euro(next.cents)} chez ${next.supplierName}.`,
      },
    ];
  });
  return {
    title: "Devis en attente et coûts plus élevés",
    period: "Devis encore en cours",
    filters: [],
    measures: [{ label: "Lignes concernées", value: String(rows.length) }],
    rows,
    sources: ["Devis en cours", "Offres fournisseur"],
    missing: rows.length === 0 ? ["Aucun devis en cours n’a de coût unitaire dépassé par une offre plus tardive."] : [],
    method:
      "Le coût unitaire du devis est comparé au centime déjà lu sur une offre fournisseur datée après le devis. Les lignes ne sont pas additionnées.",
  };
}

export type CustomerOrder = {
  title: string;
  clientName: string;
  at: Date;
  lines: Array<{ name: string; quantity: number; supplierName: string; family: string }>;
};

export function lastCustomerOrder(orders: CustomerOrder[], clientQuery: string): AnswerPacket {
  const query = fold(clientQuery);
  if (!query) {
    return emptyPacket("Dernière commande", "", "Indiquez le client, par exemple « client Nordic ».");
  }
  const matches = orders
    .filter((order) => fold(order.clientName).includes(query))
    .sort((left, right) => right.at.getTime() - left.at.getTime());
  const order = matches[0];
  if (!order) {
    return emptyPacket("Dernière commande", "", `Aucune commande client pour « ${clientQuery.trim()} ».`);
  }
  return {
    title: `Dernière commande de ${order.clientName}`,
    period: order.at.toLocaleDateString("fr-FR", { timeZone: "UTC" }),
    filters: [order.title],
    measures: [{ label: "Lignes", value: String(order.lines.length) }],
    rows: order.lines.map((line) => ({
      label: line.name,
      detail: `quantité ${line.quantity}${line.supplierName ? `, ${line.supplierName}` : ""}${line.family ? `, ${familyLabel(line.family)}` : ""}`,
    })),
    sources: ["Commandes client"],
    missing: ["Une option n’est pas une ligne séparée : la liste est celle enregistrée sur la commande."],
    method: "La commande retenue est la plus récente dont le nom du client contient la demande.",
  };
}

export function marginPeriodPacket(period: "unsupported" | "missing"): AnswerPacket {
  return emptyPacket(
    "Marge brute moyenne",
    "",
    period === "missing"
      ? "Indiquez la période. Le mois dernier est lu."
      : "Cette période n’est pas encore lue. Le mois dernier est disponible.",
  );
}

export function bestTariffPacket(reference: string, rows: RankedOffer[], note: string): AnswerPacket {
  const label = reference.trim();
  if (!label) {
    return emptyPacket("Meilleur tarif", "", "Indiquez la référence, par exemple « meilleur tarif pour NL-440 ».");
  }
  const lowest = rows.find((row) => row.lowest);
  return {
    title: `Meilleur tarif pour ${label}`,
    period: "",
    filters: [label],
    measures: [
      {
        label: "Prix le plus bas",
        value: lowest ? lowest.statedCost || "non indiqué" : "aucune offre",
      },
    ],
    rows: rows.map((row) => ({
      label: row.supplierName || "Fournisseur non nommé",
      detail: row.statedCost || "prix non lu",
    })),
    sources: ["Offres fournisseur"],
    missing: rows.length === 0 ? [`Aucune offre enregistrée pour ${label}.`] : [],
    method: note,
  };
}

export function receptionReportPacket(
  client: string,
  hits: Array<{ title: string; excerpt: string }>,
): AnswerPacket {
  const name = client.trim();
  if (!name) return emptyPacket("Procès-verbal", "", "Indiquez le client, par exemple « procès-verbal chez le client Portuaire ».");
  return {
    title: `Procès-verbal pour ${name}`,
    period: "",
    filters: [name],
    measures: [{ label: "Pièces", value: String(hits.length) }],
    rows: hits.slice(0, 8).map((hit) => ({ label: hit.title, detail: hit.excerpt })),
    sources: ["Pièces indexées"],
    missing: hits.length === 0 ? [`Aucun procès-verbal indexé ne cite ${name}.`] : [],
    method: "La recherche reprend le texte déjà extrait. Elle ne crée pas de coordonnées ni de numéro.",
  };
}

function emptyPacket(title: string, period: string, missing: string): AnswerPacket {
  return {
    title,
    period,
    filters: [],
    measures: [],
    rows: [],
    sources: [],
    missing: [missing],
    method: "Rien n’est calculé tant qu’il manque cet élément.",
  };
}

function familiesIn(folded: string): ProductFamily[] {
  const found: ProductFamily[] = [];
  if (/\bserveurs?\b/.test(folded)) found.push("serveur");
  if (/\bpostes?\b/.test(folded)) found.push("poste");
  if (/\bportables?\b/.test(folded)) found.push("portable");
  if (/\breseaux?\b|\bswitches?\b|\brouteurs?\b/.test(folded)) found.push("reseau");
  if (/\bprestations?\b/.test(folded)) found.push("prestation");
  return found;
}

function marginPeriod(folded: string): "previous_month" | "unsupported" | "missing" {
  if (/\bmois dernier\b|\bmois precedent\b/.test(folded)) return "previous_month";
  if (/\b(trimestre|semestre|cette semaine|cette annee)\b/.test(folded)) return "unsupported";
  return "missing";
}

function namedClient(text: string): string {
  const client = text.match(/\bclient\s+([^\n,?.!]{2,80})/i);
  const chez = text.match(/\bchez\s+([^\n,?.!]{2,80})/i);
  const raw = (client?.[1] ?? chez?.[1] ?? "").replace(/^le\s+/i, "");
  return raw.replace(/\s+(lors|pour|qui|dont|sur|dans|avec)\b[\s\S]*$/i, "").trim();
}

function namedReference(text: string): string {
  const labeled = text.match(/\br[ée]f[ée]rence\s+([A-Za-z0-9][A-Za-z0-9-]{1,40})/i);
  if (labeled && !/^(de|du|des|cette|ce|un|une)$/i.test(labeled[1] ?? "")) return labeled[1] ?? "";
  const code = text.match(/\b([A-Z]{2,}(?:-[A-Z0-9]{2,})+)\b/);
  return code?.[1] ?? "";
}

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function euro(cents: number | null): string {
  if (cents === null) return "non indiqué";
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const major = Math.floor(absolute / 100);
  const minor = String(absolute % 100).padStart(2, "0");
  const grouped = String(major).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${minor} €`;
}
