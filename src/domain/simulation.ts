export type SimulationInput = {
  action: string;
  risk: "lecture" | "confirmation" | "brouillon";
  ready: boolean;
  document: string;
  documentType: string;
  project: string;
  supplier: string;
  client: string;
};

/** Aperçu déterministe. Aucun montant n’est calculé, rien n’est écrit. */
export function simulateWrite(input: SimulationInput): string {
  if (!input.ready || input.risk === "lecture" || !input.action.trim()) return "";
  const parts = [`Simulation : ${input.action}.`];
  if (input.document.trim()) parts.push(`Pièce : ${input.document.trim()}.`);
  if (input.documentType.trim()) parts.push(`Type : ${input.documentType.trim()}.`);
  if (input.project.trim()) parts.push(`Projet : ${input.project.trim()}.`);
  if (input.supplier.trim()) parts.push(`Société : ${input.supplier.trim()}.`);
  if (input.client.trim()) parts.push(`Client : ${input.client.trim()}.`);
  if (input.risk === "brouillon") parts.push("Le résultat serait un brouillon, sans envoi.");
  parts.push("Aucun montant n’est calculé. Aucun numéro de facture n’est attribué. Rien n’est écrit.");
  return parts.join(" ");
}
