export const EXTRA_ADDRESS_KINDS = ["facturation", "livraison", "autre"] as const;

export type ExtraAddressKind = (typeof EXTRA_ADDRESS_KINDS)[number];

export type AddressParts = {
  line: string;
  postalCode: string;
  city: string;
  country: string;
};

export function addressKindLabel(kind: string): string {
  if (kind === "siege") return "Siège";
  if (kind === "facturation") return "Facturation";
  if (kind === "livraison") return "Livraison";
  return "Autre";
}

export function formatAddress(address: AddressParts): string {
  const place = [address.postalCode.trim(), address.city.trim()].filter(Boolean).join(" ");
  return [address.line.trim(), place, address.country.trim()].filter(Boolean).join(", ");
}

export function readExtraAddress(input: AddressParts & { kind: string }):
  | { ok: true; value: AddressParts & { kind: ExtraAddressKind } }
  | { ok: false; error: string } {
  const kind = input.kind.trim();
  if (!EXTRA_ADDRESS_KINDS.includes(kind as ExtraAddressKind)) {
    return { ok: false, error: "Choisissez une adresse de facturation, de livraison, ou une autre adresse." };
  }
  const line = input.line.trim().replace(/\s+/g, " ").slice(0, 300);
  const postalCode = input.postalCode.trim().replace(/\s+/g, " ").slice(0, 20);
  const city = input.city.trim().replace(/\s+/g, " ").slice(0, 80);
  const country = input.country.trim().replace(/\s+/g, " ").slice(0, 80);
  if (line.length < 4 && !(postalCode && city)) {
    return { ok: false, error: "Indiquez la rue, ou le code postal et la ville." };
  }
  return { ok: true, value: { kind: kind as ExtraAddressKind, line, postalCode, city, country } };
}
