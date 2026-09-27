export type FieldConfidence = { field: string; confidence: number };

export function copiedFields(fields: Array<{ label: string; value: string }>): FieldConfidence[] {
  return fields.flatMap((field) => {
    const name = field.label.trim().slice(0, 80);
    if (!name || !field.value.trim()) return [];
    return [{ field: name, confidence: 1 }];
  });
}

export function readProvenance(input: {
  modelVersion: string;
  fields: FieldConfidence[];
}): { modelVersion: string; confidence: FieldConfidence[] } | { error: string } {
  const modelVersion = input.modelVersion.trim().slice(0, 80);
  if (!modelVersion) return { error: "La version du modèle est vide." };
  const confidence: FieldConfidence[] = [];
  for (const field of input.fields) {
    const name = field.field.trim().slice(0, 80);
    if (!name) continue;
    if (!Number.isFinite(field.confidence) || field.confidence < 0 || field.confidence > 1) {
      return { error: "La confiance d’un champ est un nombre entre 0 et 1." };
    }
    confidence.push({ field: name, confidence: Math.round(field.confidence * 100) / 100 });
  }
  return { modelVersion, confidence };
}

export function stampProvenance(modelVersion: string, fields: Array<{ label: string; value: string }>): {
  modelVersion: string;
  confidence: FieldConfidence[];
} {
  const read = readProvenance({ modelVersion, fields: copiedFields(fields) });
  if ("error" in read) return { modelVersion: "regle", confidence: [] };
  return read;
}

export function provenanceLabel(modelVersion: string): string {
  if (modelVersion === "lecture") return "Lecture de la pièce";
  if (modelVersion === "regle") return "Règle, sans modèle";
  if (modelVersion === "saisie") return "Saisie";
  if (!modelVersion.trim()) return "";
  return modelVersion.trim();
}

export function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)} %`;
}
