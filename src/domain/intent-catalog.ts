export type IntentId =
  | "register_document"
  | "assign_project"
  | "prepare_customer_quote"
  | "update_cost"
  | "register_order"
  | "match_payment"
  | "answer_question"
  | "import_brief"
  | "price_rule"
  | "confirm_pending"
  | "maintain_record"
  | "read_trade";

export type IntentExecution = "regle" | "recherche" | "absente";

export type IntentSpec = {
  id: IntentId;
  label: string;
  required: string[];
  risk: "lecture" | "confirmation" | "brouillon";
  execution: IntentExecution;
};

/**
 * Liste fermée. Une action nouvelle s’ajoute ici avant de pouvoir écrire.
 * Les lignes « regle » sont exécutées avant le modèle. decideFree ne sert
 * que si aucune de ces règles n’a reconnu la phrase.
 */
export const intentCatalog: IntentSpec[] = [
  { id: "register_document", label: "Enregistrer un document", required: ["document", "type", "société"], risk: "confirmation", execution: "absente" },
  { id: "assign_project", label: "Affecter à un projet", required: ["document", "projet"], risk: "confirmation", execution: "absente" },
  { id: "prepare_customer_quote", label: "Préparer un devis client", required: ["client", "lignes"], risk: "brouillon", execution: "regle" },
  { id: "update_cost", label: "Mettre à jour un coût", required: ["projet", "ligne", "source"], risk: "confirmation", execution: "absente" },
  { id: "register_order", label: "Enregistrer une commande", required: ["devis accepté", "client", "livraison"], risk: "confirmation", execution: "absente" },
  { id: "match_payment", label: "Rapprocher un paiement", required: ["mouvement", "facture ou projet"], risk: "confirmation", execution: "absente" },
  { id: "answer_question", label: "Répondre à une question", required: ["question"], risk: "lecture", execution: "recherche" },
  { id: "import_brief", label: "Enregistrer un tableau ou un projet parlé", required: ["contenu"], risk: "confirmation", execution: "regle" },
  { id: "price_rule", label: "Rappeler la règle de prix", required: ["question"], risk: "lecture", execution: "regle" },
  { id: "confirm_pending", label: "Confirmer ou écarter une proposition", required: ["proposition en attente"], risk: "confirmation", execution: "regle" },
  { id: "maintain_record", label: "Proposer une fiche du répertoire", required: ["fiche", "champs cités"], risk: "confirmation", execution: "regle" },
  { id: "read_trade", label: "Lire le parcours et les preuves", required: ["question"], risk: "lecture", execution: "regle" },
];

export type IntentDecision = {
  id: IntentId | null;
  execution: IntentExecution;
  missing: string[];
};

const WRITE =
  /\b(enregistr\w*|cr[ée]e[rz]?\b|cr[ée]er|ajout\w*|modifi\w*|supprim\w*|rattache\w*|affect\w*|rapproch\w*|num[ée]rot\w*|[ée]met\w*|emet\w*|envoy\w*)\b/i;

const EXPLAIN = /^(comment|pourquoi|qu['’]est-ce|quels?\b|quelles?\b|est-ce|c['’]est quoi)\b/i;

export function decideFree(text: string): IntentDecision {
  const unfinished = matchUnfinished(text);
  if (unfinished) {
    return { id: unfinished.id, execution: "absente", missing: unfinished.missing };
  }
  if (WRITE.test(text) && !EXPLAIN.test(text.trim())) {
    return { id: null, execution: "absente", missing: [] };
  }
  return { id: "answer_question", execution: "recherche", missing: [] };
}

export function absentReply(decision: IntentDecision): string {
  if (!decision.id) {
    return "Aucune action du catalogue ne correspond. Rien n’est enregistré. Une action reconnue commence par exemple par « prépare un devis pour … », « ajouter un fournisseur … » ou « que sait-on de … ».";
  }
  const row = intentCatalog.find((item) => item.id === decision.id);
  const label = row?.label ?? "Cette action";
  if (decision.missing.length === 0) {
    return `${label} est au catalogue. Elle n’est pas encore exécutée. Rien n’est écrit.`;
  }
  return `${label} : il manque ${decision.missing.join(", ")}. Rien n’est écrit.`;
}

function matchUnfinished(text: string): { id: IntentId; missing: string[] } | null {
  const folded = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\brapproch\w*\b/.test(folded) && /\b(paiement|reglement|virement|encaissement)\b/.test(folded)) {
    return { id: "match_payment", missing: missingOf("match_payment", folded) };
  }
  if (/\b(cout|couts|prix d achat)\b/.test(folded) && /\b(mets|mettre|actualis\w*|chang\w*)\b/.test(folded)) {
    return { id: "update_cost", missing: missingOf("update_cost", folded) };
  }
  if (/\b(enregistr\w*|passer|passe[rz]?)\b/.test(folded) && /\bcommande\b/.test(folded)) {
    return { id: "register_order", missing: missingOf("register_order", folded) };
  }
  if (/\b(rattache\w*|affect\w*|associ\w*)\b/.test(folded) && /\bprojet\b/.test(folded)) {
    return { id: "assign_project", missing: missingOf("assign_project", folded) };
  }
  if (/\benregistr\w*\b/.test(folded) && /\b(ca|cela|ci|fichier|piece|document)\b/.test(folded)) {
    return { id: "register_document", missing: missingOf("register_document", folded) };
  }
  return null;
}

function missingOf(id: IntentId, folded: string): string[] {
  const required = intentCatalog.find((item) => item.id === id)?.required ?? [];
  const found = new Set<string>();
  if (/\b(devis|facture|commande|contrat|bon de livraison|rfq)\b/.test(folded)) found.add("type");
  if (/\b(fichier|piece|document|pdf)\b/.test(folded)) found.add("document");
  if (/\bprojet\b/.test(folded)) found.add("projet");
  if (/\b(client|fournisseur)\b/.test(folded)) {
    found.add("société");
    found.add("client");
  }
  if (/\bligne\b/.test(folded)) found.add("ligne");
  if (/\b(devis|piece|document)\b/.test(folded)) found.add("source");
  if (/\b(accepte|signe)\b/.test(folded)) found.add("devis accepté");
  if (/\b(livraison|adresse)\b/.test(folded)) found.add("livraison");
  if (/\b(virement|paiement|reglement)\b/.test(folded)) found.add("mouvement");
  if (/\bfacture\b/.test(folded)) found.add("facture ou projet");
  return required.filter((field) => !found.has(field));
}
