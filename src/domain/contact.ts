export type ContactName = { firstName: string; lastName: string };

export function splitContactName(full: string): ContactName {
  const parts = full.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: "", lastName: parts[0] ?? "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? "" };
}

export function contactLabel(contact: ContactName & { email?: string }): string {
  const name = [contact.firstName, contact.lastName].map((part) => part.trim()).filter(Boolean).join(" ");
  return name || contact.email?.trim() || "";
}

export function readExtraContact(input: {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
}): { ok: true; value: { firstName: string; lastName: string; role: string; email: string; phone: string } } | { ok: false; error: string } {
  const firstName = input.firstName.trim().replace(/\s+/g, " ").slice(0, 80);
  const lastName = input.lastName.trim().replace(/\s+/g, " ").slice(0, 80);
  const role = input.role.trim().replace(/\s+/g, " ").slice(0, 80);
  const email = input.email.trim().slice(0, 160);
  const phone = input.phone.trim().slice(0, 40);
  if (`${firstName} ${lastName}`.trim().length < 2) {
    return { ok: false, error: "Indiquez le prénom ou le nom de l’interlocuteur." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "L’adresse e-mail de l’interlocuteur n’est pas valide." };
  }
  return { ok: true, value: { firstName, lastName, role, email, phone } };
}
