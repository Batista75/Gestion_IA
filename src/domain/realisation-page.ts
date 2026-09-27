export type RealisationRow = {
  domain: string;
  point: string;
  status: "fait" | "pas";
  doneAt: string;
};

export type RealisationPhase = {
  order: number;
  title: string;
  state: "fait" | "pas";
  summary: string;
  doneAt: string;
};

/** Même tableau pour le fonctionnel et la technique. Seul le chapeau change. */
export function realisationPage(input: {
  audience: "fonctionnel" | "technique";
  rows: RealisationRow[];
  phases: RealisationPhase[];
  formatWhen: (iso: string) => string;
}): string {
  const intro =
    input.audience === "fonctionnel"
      ? "Chaque ligne est une demande. L’état est celui du tableau Plus de l’application, pas une seconde liste."
      : "Chaque ligne est la même demande. L’état dit si le socle l’exécute. Il n’y a pas d’autre liste.";
  const phases = input.phases
    .map(
      (phase) =>
        `| ${phase.order} | ${escapeCell(phase.title)} | ${statusLabel(phase.state)} | ${escapeCell(input.formatWhen(phase.doneAt) || "—")} |`,
    )
    .join("\n");
  const rows = input.rows
    .map(
      (row) =>
        `| ${escapeCell(row.domain)} | ${escapeCell(row.point)} | ${statusLabel(row.status)} | ${escapeCell(input.formatWhen(row.doneAt) || "—")} |`,
    )
    .join("\n");
  return [
    "# Réalisations",
    "",
    intro,
    "",
    "Le fonctionnel, la technique et ce tableau utilisent les mêmes libellés et les mêmes états.",
    "",
    "## Phases",
    "",
    "| Phase | Intitulé | État | Réalisé |",
    "| --- | --- | --- | --- |",
    phases,
    "",
    "## Demandes",
    "",
    "| Domaine | Demande | État | Réalisé |",
    "| --- | --- | --- | --- |",
    rows,
    "",
  ].join("\n");
}

function statusLabel(status: "fait" | "pas"): string {
  return status === "fait" ? "Fait" : "Pas fait";
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
