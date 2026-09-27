import { readCardCorrection, understandingCard } from "@/domain/completeness";
import {
  documentKey,
  memoryApplies,
  memoryNotice,
  mergeMemory,
} from "@/domain/document-memory";
import { asksHybridQuote } from "@/domain/hybrid-quote";
import { decideFree, intentCatalog } from "@/domain/intent-catalog";
import { plainQuestion } from "@/domain/interpreter";
import { simulateWrite } from "@/domain/simulation";
import { evaluateShortMessages, type ShortRow } from "@/domain/short-eval";
import { nextOverrides, resumeKind, taskSteps } from "@/domain/task-path";

export function runShortEvaluation(): ShortRow[] {
  return evaluateShortMessages({
    decide: decideFree,
    catalog: (id) => {
      const row = intentCatalog.find((item) => item.id === id);
      return row ? { required: row.required, risk: row.risk, label: row.label } : null;
    },
    card: (input) => {
      const card = understandingCard({
        action: input.action,
        required: input.required,
        text: input.text,
        projectName: input.projectName,
        projectClient: "",
        attachments: input.attachments,
        selectedLabel: "",
        selectedKind: "",
        projectChoices: [],
        overrides: input.societe ? { projet: "", type: "", société: input.societe } : undefined,
      });
      return {
        confirm: card.confirm,
        understood: card.understood,
        supplier: card.supplier,
        documentType: card.documentType,
        project: card.project,
      };
    },
    simulate: simulateWrite,
    steps: taskSteps,
    resume: resumeKind,
    keepAnswer: (field, kind, text, proposed) => {
      const moved = nextOverrides({ projet: "", type: "", societe: "" }, {}, field, kind, text, proposed);
      return { kept: moved.kept, accepted: moved.accepted };
    },
    isQuestion: (text) => plainQuestion(text) !== null,
    isHybridQuote: asksHybridQuote,
    remember: (file, societe) => {
      const memory = mergeMemory(null, { document: file, projet: "", type: "", societe });
      return { document: memory?.document ?? documentKey(file), societe: memory?.societe ?? "" };
    },
    applies: (memory, file) => memoryApplies({ document: memory.document, projet: "", type: "", societe: memory.societe }, file),
    notice: memoryNotice,
    correction: (text) => {
      const read = readCardCorrection(text);
      return read ? { societe: read.société } : null;
    },
  });
}
