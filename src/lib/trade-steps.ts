import { readFileSync } from "node:fs";
import path from "node:path";
import {
  TRADE_STEPS,
  assertProof,
  readStepStatus,
  stepStatusLabel,
  tradeStep,
  type StepRecord,
} from "@/domain/trade-workflow";
import { prisma } from "@/lib/db";

const INSTRUCTION = path.join(process.cwd(), "instructions/metiers/achat-revente-technologies.md");

export function readTradeInstruction(): string {
  try {
    return readFileSync(INSTRUCTION, "utf8");
  } catch {
    return "";
  }
}

export async function listProjectSteps(projectId: string): Promise<StepRecord[]> {
  const rows = await prisma.projectStep.findMany({ where: { projectId } });
  return rows.map((row) => ({
    key: row.stepKey,
    status: readStepStatus(row.status),
    proofRef: row.proofRef,
    proofNote: row.proofNote,
  }));
}

export async function saveProjectStep(input: {
  projectId: string;
  stepKey: string;
  status: string;
  proofRef: string;
  proofNote: string;
}): Promise<string> {
  const step = tradeStep(input.stepKey);
  if (!step) throw new Error("Cette étape ne fait pas partie du métier.");
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new Error("Ce projet est introuvable.");
  const status = readStepStatus(input.status);
  const proofRef = input.proofRef.trim().replace(/\s+/g, " ").slice(0, 160);
  const proofNote = input.proofNote.trim().replace(/\s+/g, " ").slice(0, 500);
  assertProof(status, proofRef);
  await prisma.projectStep.upsert({
    where: { projectId_stepKey: { projectId: project.id, stepKey: step.key } },
    create: {
      projectId: project.id,
      stepKey: step.key,
      status,
      proofRef,
      proofNote,
      recordedAt: status === "fait" ? new Date() : null,
    },
    update: {
      status,
      proofRef,
      proofNote,
      recordedAt: status === "fait" ? new Date() : null,
    },
  });
  await prisma.projectEvent.create({
    data: {
      projectId: project.id,
      kind: "parcours",
      body: `Étape ${step.order}. ${step.title} — ${stepStatusLabel(status)}.${proofRef ? ` Preuve : ${proofRef}.` : ""}`,
    },
  });
  return `Étape ${step.order}. ${step.title} enregistrée : ${stepStatusLabel(status)}.`;
}

export function knownStepKeys(): string[] {
  return TRADE_STEPS.map((step) => step.key);
}
