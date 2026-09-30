import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DOCLING_DIR = path.join(process.cwd(), "data", "docling");

export type DoclingConversion = {
  markdown: string;
  chunks: string[];
};

let ready: Promise<boolean> | null = null;

export function doclingPython(): string {
  // Joint à l'exécution. Un path.join(process.cwd(), ".venv-docling", "bin", "python")
  // serait une ressource du graphe, et Turbopack suivrait le lien vers /usr/bin.
  const local = [process.cwd(), ".venv-docling", "bin", "python"].join(path.sep);
  return existsSync(local) ? local : "python3";
}

export function doclingReady(): Promise<boolean> {
  ready ??= probe();
  return ready;
}

export async function convertWithDocling(
  files: Array<{ bytes: Buffer; extension: string }>,
): Promise<DoclingConversion[] | null> {
  if (files.length === 0) return [];
  if (!(await doclingReady())) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "docling-"));
  const output = path.join(dir, "result.json");
  const inputs: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const extension = file.extension.replace(/[^a-z0-9]/g, "") || "bin";
      const target = path.join(dir, `document-${index}.${extension}`);
      await writeFile(target, file.bytes);
      inputs.push(target);
    }
    await mkdir(DOCLING_DIR, { recursive: true });
    const script = path.join(process.cwd(), "scripts", "docling_extract.py");
    await execFileAsync(doclingPython(), [script, output, ...inputs], {
      timeout: Math.min(240_000, 90_000 * files.length),
      maxBuffer: 1024 * 1024,
      env: doclingEnv(),
    });
    const parsed = JSON.parse(await readFile(output, "utf8")) as {
      ok?: boolean;
      files?: Array<{ markdown?: unknown; chunks?: unknown }>;
    };
    if (!parsed.ok || !Array.isArray(parsed.files)) return null;
    return files.map((_, index) => {
      const item = parsed.files?.[index];
      const chunks = Array.isArray(item?.chunks)
        ? item.chunks.filter((chunk): chunk is string => typeof chunk === "string")
        : [];
      return {
        markdown: typeof item?.markdown === "string" ? item.markdown : "",
        chunks,
      };
    });
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function doclingEnv(): NodeJS.ProcessEnv {
  const offline = existsSync(path.join(DOCLING_DIR, ".ready"));
  return {
    ...process.env,
    DOCLING_ARTIFACTS_PATH: DOCLING_DIR,
    DOCLING_DEVICE: "cpu",
    DOCLING_NUM_THREADS: "4",
    OMP_NUM_THREADS: "4",
    HF_HOME: path.join(DOCLING_DIR, "hf"),
    HF_HUB_DISABLE_TELEMETRY: "1",
    HF_HUB_OFFLINE: offline ? "1" : "0",
    TRANSFORMERS_OFFLINE: offline ? "1" : "0",
  };
}

async function probe(): Promise<boolean> {
  try {
    await execFileAsync(doclingPython(), [path.join(process.cwd(), "scripts", "docling_extract.py"), "--ready"], {
      timeout: 30_000,
    });
    return true;
  } catch {
    return false;
  }
}
