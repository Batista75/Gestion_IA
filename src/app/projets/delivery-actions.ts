"use server";

import { revalidatePath } from "next/cache";
import { cleanDelivery, deliverySummary } from "@/domain/delivery";
import { prisma } from "@/lib/db";

export type DeliveryState = { message: string | null; ok: boolean };

export async function saveDeliveryAction(
  _previous: DeliveryState,
  formData: FormData,
): Promise<DeliveryState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const cleaned = cleanDelivery({
    recipient: String(formData.get("recipient") ?? ""),
    address: String(formData.get("address") ?? ""),
    postalCode: String(formData.get("postalCode") ?? ""),
    city: String(formData.get("city") ?? ""),
    country: String(formData.get("country") ?? ""),
    contact: String(formData.get("contact") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    slot: String(formData.get("slot") ?? ""),
    mode: String(formData.get("mode") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!cleaned.ok) return { message: cleaned.error, ok: false };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { message: "Ce projet est introuvable.", ok: false };
  const next = cleaned.value;
  const same =
    project.deliveryRecipient === next.recipient &&
    project.deliveryAddress === next.address &&
    project.deliveryPostalCode === next.postalCode &&
    project.deliveryCity === next.city &&
    project.deliveryCountry === next.country &&
    project.deliveryContact === next.contact &&
    project.deliveryPhone === next.phone &&
    project.deliverySlot === next.slot &&
    project.deliveryMode === next.mode &&
    project.deliveryNote === next.note;
  if (same) return { message: "La livraison est déjà enregistrée ainsi.", ok: true };
  await prisma.project.update({
    where: { id: project.id },
    data: {
      deliveryRecipient: next.recipient,
      deliveryAddress: next.address,
      deliveryPostalCode: next.postalCode,
      deliveryCity: next.city,
      deliveryCountry: next.country,
      deliveryContact: next.contact,
      deliveryPhone: next.phone,
      deliverySlot: next.slot,
      deliveryMode: next.mode,
      deliveryNote: next.note,
    },
  });
  const lines = deliverySummary(next);
  await prisma.projectEvent.create({
    data: {
      projectId: project.id,
      kind: "livraison",
      body: lines.length > 0 ? `Livraison : ${lines.join(", ")}.` : "Livraison retirée du dossier.",
    },
  });
  revalidatePath(`/projets/${project.id}`);
  revalidatePath("/projets");
  return { message: "Livraison enregistrée.", ok: true };
}
