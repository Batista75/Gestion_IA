import { parseBusinessBrief, planIsEmpty } from "./business-brief.ts";
import { readCashQuestion } from "./cash.ts";
import { parseCatalogCommand } from "./catalog.ts";
import { readClaimEntry, readClaimQuestion, readReturnEntry } from "./claims.ts";
import { displayName, identifyClient } from "./client-file.ts";
import { readContractEntry, readContractQuestion } from "./contracts.ts";
import { readDossierQuestion } from "./dossier.ts";
import { readDraftQuestion } from "./drafts.ts";
import { readEquipmentEntry, readEquipmentQuestion } from "./equipment.ts";
import { asksHybridQuote } from "./hybrid-quote.ts";
import { decideFree, intentCatalog } from "./intent-catalog.ts";
import { readInterventionEntry, readTimeQuestion } from "./interventions.ts";
import { recordFocus, understandIntent } from "./knowledge.ts";
import { familyLabel, readMeasureQuestion } from "./measures.ts";
import { asksModelToComputeMoney } from "./ollama-endpoint.ts";
import { readPurchaseEntry, readPurchaseQuestion, readSupplierTerms } from "./purchases.ts";
import { asksTradeWorkflow } from "./trade-workflow.ts";

const FOCUS_LABEL: Record<string, string> = {
  client: "Clients",
  supplier: "Fournisseurs",
  product: "Produits",
  project: "Projets",
  quote: "Devis",
  piece: "Pièces",
  demand: "Demandes",
  inbox: "Notes",
};

/** Titre d’un fil à partir de la règle qui reconnaît le premier message. */
export function proposedThreadTitle(text: string): string {
  const plan = parseBusinessBrief(text);
  if (!planIsEmpty(plan)) {
    const project = plan.projects[0];
    if (project) return titled("Projet", project.name, project.primaryClient);
    const client = plan.clients[0];
    if (client?.name) return titled("Client", client.name);
    const article = plan.articles[0];
    if (article) return titled(article.kind === "service" ? "Service" : "Article", article.name);
    const quote = plan.quotes[0];
    if (quote) return titled("Devis", quote.clientName, quote.projectName);
  }

  const measure = readMeasureQuestion(text);
  if (measure) {
    if (measure.kind === "best_tariff") return titled("Meilleur tarif", measure.reference);
    if (measure.kind === "average_margin") return titled("Marge moyenne", ...measure.families.map(familyLabel));
    if (measure.kind === "raised_prices") return titled("Devis en attente");
    if (measure.kind === "last_order") return titled("Dernière commande", measure.client);
    return titled("Procès-verbal", measure.client);
  }

  const contractQuestion = readContractQuestion(text);
  if (contractQuestion) {
    return titled(contractQuestion.kind === "due" ? "Échéances de contrat" : "Montant récurrent");
  }
  const contract = readContractEntry(text);
  if (contract) return titled("Contrat", namedPour(text), contract.ready ? contractLabel(contract.draft.kind) : "");

  const time = readTimeQuestion(text);
  if (time) {
    if (time.kind === "delay") return titled("Délai d’intervention");
    if (time.kind === "unbilled") return titled("Heures non facturées");
    if (time.kind === "recap") return titled("Récapitulatif d’heures");
    return titled("Taux moyen");
  }
  const intervention = readInterventionEntry(text);
  if (intervention) {
    return titled(
      "Intervention",
      namedPour(text),
      intervention.ready ? intervention.draft.occurredOn : namedProject(text),
    );
  }

  const equipmentQuestion = readEquipmentQuestion(text);
  if (equipmentQuestion) return titled(equipmentQuestion.kind === "age" ? "Parc ancien" : "Garantie");
  const equipment = readEquipmentEntry(text);
  if (equipment) return titled("Matériel", equipment.designation);

  const draft = readDraftQuestion(text);
  if (draft) {
    if (draft.kind === "quote") return titled("Demande de cotation");
    if (draft.kind === "tracking") return titled("Suivi de livraison");
    return titled("Relance de facture");
  }

  const purchaseQuestion = readPurchaseQuestion(text);
  if (purchaseQuestion) return titled(purchaseLabel(purchaseQuestion.kind), namedPour(text));
  const purchase = readPurchaseEntry(text);
  if (purchase) return titled("Achat", purchase.designation, purchase.dossierName || namedPour(text));
  if (readSupplierTerms(text)) return titled("Conditions fournisseur", namedPour(text));

  const claimQuestion = readClaimQuestion(text);
  if (claimQuestion) return titled(claimQuestion.kind === "claims" ? "Réclamations" : "Retours");
  if (readClaimEntry(text)) return titled("Réclamation", namedPour(text));
  if (readReturnEntry(text)) return titled("Retour", namedPour(text));

  const dossier = readDossierQuestion(text);
  if (dossier) return titled(dossierLabel(dossier.kind), namedProject(text));

  if (readCashQuestion(text)) return titled("Trésorerie");
  if (asksModelToComputeMoney(text)) return titled("Règle de prix");
  if (asksHybridQuote(text)) return titled("Devis client", namedPour(text));

  const command = parseCatalogCommand(text);
  if (command) return commandTitle(command);

  if (asksTradeWorkflow(text)) return titled("Parcours", namedProject(text));

  const intent = understandIntent(text);
  if (intent === "lookup" || intent === "directory") {
    const focus = recordFocus(text);
    return titled("Recherche", focus ? FOCUS_LABEL[focus] : "");
  }
  if (intent === "change") return titled("Fiche", namedPour(text));

  const client = identifyClient(text);
  if (client) return titled("Client", displayName(client));

  if (/^(oui|ok|je confirme|je valide)\b/i.test(text.trim())) return titled("Confirmation");
  if (/^(non|annule|annuler)\b/i.test(text.trim()) && text.trim().length < 40) return titled("Refus");

  const decision = decideFree(text);
  const label = intentCatalog.find((item) => item.id === decision.id)?.label ?? "";
  if (decision.id && decision.id !== "answer_question" && label) return titled(label);

  return shortPhrase(text);
}

function commandTitle(command: ReturnType<typeof parseCatalogCommand>): string {
  if (!command) return shortPhrase("");
  if (command.type === "create_client" || command.type === "update_client") return titled("Client", command.party.name);
  if (command.type === "create_supplier" || command.type === "update_supplier") return titled("Fournisseur", command.party.name);
  if (command.type === "create_product" || command.type === "update_product") return titled("Produit", command.product.name);
  if (command.type === "create_project") return titled("Projet", command.name, command.primaryClient);
  return titled("Devis reçu", command.title);
}

function purchaseLabel(kind: string): string {
  if (kind === "gap") return "Écart fournisseur";
  if (kind === "overdue") return "Reliquats";
  if (kind === "direct") return "Livraison directe";
  if (kind === "outstanding") return "Encours fournisseur";
  if (kind === "subcontract") return "Sous-traitance";
  return "Volume fournisseur";
}

function dossierLabel(kind: string): string {
  if (kind === "profit") return "Rentabilité";
  if (kind === "stock") return "Stock atelier";
  if (kind === "received") return "Réceptions";
  return "Achats non repris";
}

function contractLabel(kind: string): string {
  if (kind === "infogerance") return "Infogérance";
  if (kind === "location") return "Location";
  return "Maintenance";
}

function titled(label: string, ...details: string[]): string {
  const seen = new Set<string>([label.toLowerCase()]);
  const parts = [label];
  for (const detail of details) {
    const value = detail.trim().replace(/\s+/g, " ");
    const key = value.toLowerCase();
    if (value.length < 2 || value.length > 40 || seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
    if (parts.length === 3) break;
  }
  const text = parts.join(" · ");
  return text.length <= 80 ? text : `${text.slice(0, 79).trimEnd()}…`;
}

function namedAfter(text: string, pattern: RegExp): string {
  const value = pattern.exec(text)?.[1]?.trim().replace(/\s+/g, " ").replace(/^(?:un|une|le|la|les|ce|cette)\s+/i, "") ?? "";
  if (value.length < 2 || value.length > 40 || value.split(" ").length > 6) return "";
  return value;
}

function namedProject(text: string): string {
  return namedAfter(text, /\b(?:projet|dossier)\s+([^,?.!]{2,40})/i);
}

function namedPour(text: string): string {
  return namedAfter(text, /\bpour\s+([^,?.!]{2,40})/i);
}

function shortPhrase(text: string): string {
  const line = text.trim().split("\n")[0]?.replace(/\s+/g, " ") ?? "";
  if (!line) return "Fil sans titre";
  return line.length <= 48 ? line : `${line.slice(0, 47).trimEnd()}…`;
}
