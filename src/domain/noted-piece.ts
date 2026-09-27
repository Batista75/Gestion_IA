export type NotedKind = "livraison" | "facture" | "avoir";

export function notedPieceLabel(kind: string): string {
  if (kind === "livraison") return "Livraison";
  if (kind === "facture") return "Facture";
  if (kind === "avoir") return "Avoir";
  return "";
}

export function readNotedReference(value: string): { reference: string } | { error: string } {
  const reference = value.trim().replace(/\s+/g, " ").slice(0, 80);
  if (reference.length < 2) {
    return { error: "Indiquez la référence écrite sur la pièce. L’application n’en attribue pas." };
  }
  return { reference };
}

export function notedParentAllowed(childKind: string, parentKind: string): boolean {
  if (childKind === "livraison") return parentKind === "commande_client" || parentKind === "commande_fournisseur";
  if (childKind === "facture") {
    return parentKind === "commande_client" || parentKind === "commande_fournisseur" || parentKind === "livraison";
  }
  if (childKind === "avoir") return parentKind === "facture";
  return false;
}

export function planNotedPiece(input: {
  kind: string;
  reference: string;
  parentKind: string;
}): { kind: NotedKind; reference: string } | { error: string } {
  const kind = input.kind.trim();
  if (kind !== "livraison" && kind !== "facture" && kind !== "avoir") {
    return { error: "Choisissez une livraison, une facture ou un avoir." };
  }
  const read = readNotedReference(input.reference);
  if ("error" in read) return read;
  if (!notedParentAllowed(kind, input.parentKind)) return { error: parentHint(kind) };
  return { kind, reference: read.reference };
}

function parentHint(kind: string): string {
  if (kind === "livraison") {
    return "Une livraison se rattache à une commande client ou à une commande fournisseur.";
  }
  if (kind === "facture") {
    return "Une facture se rattache à une commande ou à une livraison déjà rattachée.";
  }
  return "Un avoir se rattache à une facture déjà rattachée. L’application ne lui donne pas de numéro.";
}
