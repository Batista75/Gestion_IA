import assert from "node:assert/strict";
import test from "node:test";
import { readCardCorrection, understandingCard } from "../src/domain/completeness.ts";
import { documentKey, memoryApplies, memoryNotice, mergeMemory } from "../src/domain/document-memory.ts";
import { asksHybridQuote } from "../src/domain/hybrid-quote.ts";
import { decideFree, intentCatalog } from "../src/domain/intent-catalog.ts";
import { plainQuestion } from "../src/domain/interpreter.ts";
import { evaluateShortMessages, shortEvaluationHolds } from "../src/domain/short-eval.ts";
import { simulateWrite } from "../src/domain/simulation.ts";
import { nextOverrides, resumeKind, taskSteps } from "../src/domain/task-path.ts";

test("les messages courts tiennent sans écrire ni numéroter", () => {
  const rows = evaluateShortMessages({
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
  assert.equal(shortEvaluationHolds(rows), true);
  assert.equal(rows.length, 10);
  assert.ok(rows.some((item) => item.phrase === "Enregistre ça"));
  assert.equal(rows.some((item) => item.check.includes("numéro")), true);
});
