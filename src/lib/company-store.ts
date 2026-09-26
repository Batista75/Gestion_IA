import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { cleanCompany, readLogo, type CompanyDraft } from "@/domain/company";
import { prisma } from "@/lib/db";

const DATA = path.join(process.cwd(), "data");
const LOGO_NAMES = ["logo.png", "logo.jpg", "logo.webp"];

export type CompanyView = CompanyDraft & {
  hasLogo: boolean;
  logoUrl: string | null;
};

const empty: CompanyDraft = {
  legalName: "",
  address: "",
  postalCode: "",
  city: "",
  country: "",
  email: "",
  phone: "",
  siren: "",
  vatNumber: "",
};

export async function loadCompany(): Promise<CompanyView> {
  const row = await prisma.companyProfile.findUnique({ where: { id: "local" } });
  if (!row) return { ...empty, hasLogo: false, logoUrl: null };
  return {
    legalName: row.legalName,
    address: row.address,
    postalCode: row.postalCode,
    city: row.city,
    country: row.country,
    email: row.email,
    phone: row.phone,
    siren: row.siren,
    vatNumber: row.vatNumber,
    hasLogo: Boolean(row.logoPath),
    logoUrl: row.logoPath ? `/api/entreprise/logo?v=${row.updatedAt.getTime()}` : null,
  };
}

export async function saveCompany(input: {
  draft: CompanyDraft;
  logo: Uint8Array | null;
  clearLogo: boolean;
}): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const cleaned = cleanCompany(input.draft);
  if (!cleaned.ok) return cleaned;
  const current = await prisma.companyProfile.findUnique({ where: { id: "local" } });
  let logoPath = current?.logoPath ?? "";
  let logoMime = current?.logoMime ?? "";
  if (input.logo && input.logo.length > 0) {
    const sniffed = readLogo(input.logo);
    if (!sniffed.ok) return sniffed;
    await clearLogoFiles();
    const relative = `entreprise/logo.${sniffed.file.extension}`;
    const absolute = path.join(DATA, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.logo);
    logoPath = relative;
    logoMime = sniffed.file.mime;
  } else if (input.clearLogo) {
    await clearLogoFiles();
    logoPath = "";
    logoMime = "";
  }
  const data = { ...cleaned.value, logoPath, logoMime };
  await prisma.companyProfile.upsert({
    where: { id: "local" },
    create: { id: "local", ...data },
    update: data,
  });
  return { ok: true, summary: "Identité de l’entreprise enregistrée." };
}

export async function readCompanyLogo(): Promise<{ bytes: Buffer; mime: string } | null> {
  const row = await prisma.companyProfile.findUnique({ where: { id: "local" } });
  if (!row?.logoPath || !row.logoMime) return null;
  const absolute = resolveLogoPath(row.logoPath);
  if (!absolute) return null;
  try {
    return { bytes: await readFile(absolute), mime: row.logoMime };
  } catch {
    return null;
  }
}

function resolveLogoPath(relative: string): string | null {
  if (!/^entreprise\/logo\.(png|jpg|webp)$/.test(relative)) return null;
  const absolute = path.resolve(DATA, relative);
  if (!absolute.startsWith(path.resolve(DATA, "entreprise") + path.sep)) return null;
  return absolute;
}

async function clearLogoFiles(): Promise<void> {
  await Promise.all(
    LOGO_NAMES.map(async (name) => {
      try {
        await unlink(path.join(DATA, "entreprise", name));
      } catch {
        // Le fichier peut déjà être absent.
      }
    }),
  );
}
