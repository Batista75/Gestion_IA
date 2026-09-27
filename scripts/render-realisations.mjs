import { readFileSync, writeFileSync } from "node:fs";
import { realisationPage } from "../src/domain/realisation-page.ts";
import { formatDoneAt, v2Phases, v2Progress } from "../src/domain/v2-progress.ts";

const input = {
  rows: v2Progress,
  phases: v2Phases,
  formatWhen: formatDoneAt,
};

const functional = realisationPage({ audience: "fonctionnel", ...input });
const technical = realisationPage({ audience: "technique", ...input });

const functionalPath = new URL("../docs/fonctionnel/docs/realisations.md", import.meta.url);
const technicalPath = new URL("../docs/technique/docs/realisations.md", import.meta.url);

export function committedRealisations() {
  return {
    functional,
    technical,
    functionalOnDisk: readFileSync(functionalPath, "utf8"),
    technicalOnDisk: readFileSync(technicalPath, "utf8"),
  };
}

if (process.argv[1] && process.argv[1].endsWith("render-realisations.mjs")) {
  writeFileSync(functionalPath, functional);
  writeFileSync(technicalPath, technical);
}
