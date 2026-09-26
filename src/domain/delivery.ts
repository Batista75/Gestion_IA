export const DELIVERY_MODES = [
  { value: "", label: "Non précisé" },
  { value: "sur_site", label: "Sur site" },
  { value: "a_distance", label: "À distance" },
  { value: "transporteur", label: "Transporteur" },
  { value: "retrait", label: "Retrait" },
] as const;

export type DeliveryDraft = {
  recipient: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  contact: string;
  phone: string;
  slot: string;
  mode: string;
  note: string;
};

export function cleanDelivery(
  input: DeliveryDraft,
): { ok: true; value: DeliveryDraft } | { ok: false; error: string } {
  const value: DeliveryDraft = {
    recipient: squash(input.recipient, 160),
    address: squash(input.address, 300),
    postalCode: squash(input.postalCode, 12),
    city: squash(input.city, 80),
    country: squash(input.country, 80),
    contact: squash(input.contact, 120),
    phone: squash(input.phone, 40),
    slot: squash(input.slot, 80),
    mode: input.mode.trim(),
    note: squash(input.note, 500),
  };
  if (value.mode && !DELIVERY_MODES.some((item) => item.value === value.mode)) {
    return { ok: false, error: "Le mode de livraison n’est pas reconnu." };
  }
  if (value.phone && !/^[+0-9][0-9 ./-]{5,39}$/.test(value.phone)) {
    return { ok: false, error: "Le téléphone de livraison n’est pas lisible." };
  }
  return { ok: true, value };
}

export function deliveryModeLabel(mode: string): string {
  return DELIVERY_MODES.find((item) => item.value === mode)?.label ?? "Non précisé";
}

export function deliveryFromRecord(record: {
  deliveryRecipient: string;
  deliveryAddress: string;
  deliveryPostalCode: string;
  deliveryCity: string;
  deliveryCountry: string;
  deliveryContact: string;
  deliveryPhone: string;
  deliverySlot: string;
  deliveryMode: string;
  deliveryNote: string;
}): DeliveryDraft {
  return {
    recipient: record.deliveryRecipient,
    address: record.deliveryAddress,
    postalCode: record.deliveryPostalCode,
    city: record.deliveryCity,
    country: record.deliveryCountry,
    contact: record.deliveryContact,
    phone: record.deliveryPhone,
    slot: record.deliverySlot,
    mode: record.deliveryMode,
    note: record.deliveryNote,
  };
}

export function deliverySummary(input: DeliveryDraft): string[] {
  const mode = input.mode ? deliveryModeLabel(input.mode) : "";
  return [
    input.recipient,
    input.address,
    [input.postalCode, input.city].filter(Boolean).join(" "),
    input.country,
    input.contact ? `Contact ${input.contact}` : "",
    input.phone,
    mode && mode !== "Non précisé" ? mode : "",
    input.slot ? `Créneau ${input.slot}` : "",
    input.note,
  ].filter(Boolean);
}

function squash(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}
