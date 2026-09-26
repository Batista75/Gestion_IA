export type CompanyDraft = {
  legalName: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  siren: string;
  vatNumber: string;
};

export type LogoFile = {
  mime: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
};

const LIMITS: Record<keyof CompanyDraft, number> = {
  legalName: 160,
  address: 300,
  postalCode: 12,
  city: 80,
  country: 80,
  email: 120,
  phone: 40,
  siren: 9,
  vatNumber: 20,
};

export function cleanCompany(
  input: CompanyDraft,
): { ok: true; value: CompanyDraft } | { ok: false; error: string } {
  const value: CompanyDraft = {
    legalName: squash(input.legalName, LIMITS.legalName),
    address: squash(input.address, LIMITS.address),
    postalCode: squash(input.postalCode, LIMITS.postalCode),
    city: squash(input.city, LIMITS.city),
    country: squash(input.country, LIMITS.country),
    email: squash(input.email, LIMITS.email),
    phone: squash(input.phone, LIMITS.phone),
    siren: input.siren.replace(/\s+/g, ""),
    vatNumber: input.vatNumber.replace(/\s+/g, "").toUpperCase(),
  };
  if (value.legalName.length === 1) {
    return { ok: false, error: "La raison sociale compte au moins 2 caractères." };
  }
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    return { ok: false, error: "L’e-mail de l’entreprise n’est pas lisible." };
  }
  if (value.siren && !/^\d{9}$/.test(value.siren)) {
    return { ok: false, error: "Le SIREN comporte 9 chiffres." };
  }
  if (value.vatNumber && !/^[A-Z0-9]{4,20}$/.test(value.vatNumber)) {
    return { ok: false, error: "Le numéro de TVA n’est pas lisible." };
  }
  if (value.phone && !/^[+0-9][0-9 ./-]{5,39}$/.test(value.phone)) {
    return { ok: false, error: "Le téléphone n’est pas lisible." };
  }
  return { ok: true, value };
}

export function readLogo(bytes: Uint8Array): { ok: true; file: LogoFile } | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "Le fichier du logo est vide." };
  if (bytes.length > 2_000_000) return { ok: false, error: "Le logo dépasse 2 Mo." };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ok: true, file: { mime: "image/png", extension: "png" } };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ok: true, file: { mime: "image/jpeg", extension: "jpg" } };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ok: true, file: { mime: "image/webp", extension: "webp" } };
  }
  return { ok: false, error: "Le logo doit être une image PNG, JPEG ou WebP." };
}

export function sheetHeading(kind: string): string {
  if (kind === "commande_fournisseur") return "Commande fournisseur";
  if (kind === "commande_client") return "Commande client";
  if (kind === "facture") return "Facture client";
  return "Devis client";
}

export function sheetBuys(kind: string): boolean {
  return kind === "commande_fournisseur";
}

function squash(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}
