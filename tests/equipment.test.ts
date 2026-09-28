import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFits, renderPacket } from "../src/domain/answer-packet.ts";
import { readContractEntry } from "../src/domain/contracts.ts";
import {
  ageCutoff,
  applyProduct,
  equipmentGap,
  equipmentProposalPacket,
  FAMILY_CONFLICT,
  olderFleetPacket,
  previousYearWindow,
  readEquipmentEntry,
  readEquipmentQuestion,
  textForProductMatch,
  warrantyPacket,
  type StoredEquipment,
} from "../src/domain/equipment.ts";
import { readInterventionEntry } from "../src/domain/interventions.ts";
import { uniqueNameMatch } from "../src/domain/knowledge.ts";

const now = new Date("2026-09-28T12:00:00Z");

const SERVER = "Enregistre un serveur installé pour Atelier Nord, désignation Baie 2019, le 2019-04-01, garantie 4 h";
const DESK = "Enregistre un poste installé pour Atelier Nord, désignation Tour accueil, le 2025-06-01, garantie J+1";
const RECENT = "Enregistre un serveur installé pour Atelier Nord, désignation Baie récente, le 2025-02-01, garantie 4 h";
const LAPTOP = "Enregistre un portable installé pour Atelier Nord, désignation Salon 2026, le 2026-01-15, garantie standard";
const WARRANTY = "Quelle extension de garantie J+1 ou 4 h sur le matériel acheté l’an dernier ?";
const AGE = "Quel est le parc de serveurs ou de postes de plus de 5 ans ?";

function piece(patch: Partial<StoredEquipment> & Pick<StoredEquipment, "designation" | "family" | "installedOn" | "warranty">): StoredEquipment {
  return { clientName: "Atelier Nord", ...patch };
}

test("les fenêtres du parc comparent des dates", () => {
  assert.deepEqual(previousYearWindow(now), { from: "2025-01-01", to: "2026-01-01", label: "2025" });
  assert.equal(ageCutoff(now), "2021-09-28");
});

test("une phrase incomplète pose une seule question", () => {
  const sketch = readEquipmentEntry("Enregistre un équipement pour Atelier Nord");
  assert.ok(sketch);
  assert.equal(equipmentGap(sketch), "Indiquez la garantie : 4 h, J+1, standard ou aucune.");
  assert.equal(readEquipmentQuestion("Enregistre un équipement pour Atelier Nord"), null);
});

test("les quatre phrases d’équipement se lisent sans calcul", () => {
  const server = readEquipmentEntry(SERVER);
  assert.ok(server);
  assert.equal(equipmentGap(server), null);
  assert.equal(server.family, "serveur");
  assert.equal(server.designation, "Baie 2019");
  assert.equal(server.installedOn, "2019-04-01");
  assert.equal(server.warranty, "h4");

  const desk = readEquipmentEntry(DESK);
  assert.equal(desk?.family, "poste");
  assert.equal(desk?.warranty, "j1");
  assert.equal(desk?.installedOn, "2025-06-01");

  const recent = readEquipmentEntry(RECENT);
  assert.equal(recent?.designation, "Baie récente");
  assert.equal(recent?.warranty, "h4");
  assert.equal(recent?.installedOn, "2025-02-01");

  const laptop = readEquipmentEntry(LAPTOP);
  assert.equal(laptop?.family, "portable");
  assert.equal(laptop?.warranty, "standard");
  assert.equal(laptop?.installedOn, "2026-01-15");
  assert.equal(laptop?.designation, "Salon 2026");
});

test("deux niveaux ou deux familles posent une question", () => {
  const levels = readEquipmentEntry("Enregistre un serveur installé, désignation Baie, le 2019-04-01, garantie 4 h et J+1");
  assert.equal(equipmentGap(levels!), "Un seul niveau de garantie : 4 h, J+1, standard ou aucune.");
  const families = readEquipmentEntry("Enregistre un serveur et un poste installés, désignation Baie, le 2019-04-01, garantie 4 h");
  assert.equal(equipmentGap(families!), "Une seule famille : serveur, poste, portable, réseau, prestation ou autre.");
});

test("le client et le mot de famille ne citent pas un article", () => {
  const names = [
    "Préparation atelier",
    "Baie Serveur Haute Densité 42U",
    "Latitude 5440",
    "Module IED / Automate de Poste",
    "Installation sur site",
  ];
  assert.equal(uniqueNameMatch(textForProductMatch(LAPTOP, ["Atelier Nord"]), names), null);
  assert.equal(uniqueNameMatch(textForProductMatch(SERVER, ["Atelier Nord"]), names), null);
  assert.equal(uniqueNameMatch(textForProductMatch(DESK, ["Atelier Nord"]), names), null);
  const named = textForProductMatch(
    "Enregistre un portable installé pour Atelier Nord, désignation Latitude 5440, le 2026-01-15, garantie standard",
    ["Atelier Nord"],
  );
  assert.equal(uniqueNameMatch(named, names), "Latitude 5440");
});

test("une famille de produit ne contredit pas la phrase", () => {
  const sketch = readEquipmentEntry("Enregistre un serveur installé, désignation Baie, le 2019-04-01, garantie 4 h");
  assert.ok(sketch);
  assert.equal(applyProduct(sketch, { name: "Latitude 5440", family: "portable" }).conflict, FAMILY_CONFLICT);
  const empty = readEquipmentEntry("Enregistre un équipement installé, désignation Baie, le 2019-04-01, garantie 4 h");
  assert.ok(empty);
  const filled = applyProduct(empty, { name: "Tour X", family: "poste" });
  assert.equal(filled.conflict, "");
  assert.equal(filled.sketch.family, "poste");
  assert.equal(filled.sketch.designation, "Baie");
  const unnamed = readEquipmentEntry("Enregistre un équipement installé, le 2019-04-01, garantie 4 h");
  assert.equal(applyProduct(unnamed!, { name: "Tour X", family: "poste" }).sketch.designation, "Tour X");
});

test("les questions de garantie et d’âge ne sont pas des écritures", () => {
  const warranty = readEquipmentQuestion(WARRANTY);
  assert.deepEqual(warranty, { kind: "warranty", levels: ["h4", "j1"], period: "previous_year" });
  const age = readEquipmentQuestion(AGE);
  assert.deepEqual(age, { kind: "age", families: ["serveur", "poste"] });
  assert.equal(readEquipmentEntry(WARRANTY), null);
  assert.equal(readEquipmentEntry(AGE), null);
  assert.equal(readEquipmentQuestion(SERVER), null);
  assert.equal(readContractEntry(SERVER), null);
  assert.equal(readInterventionEntry(SERVER), null);
  const both = readEquipmentQuestion("Quelle extension de garantie J+1 sur le parc de serveurs de plus de cinq ans ?");
  assert.equal(both?.kind, "age");
  const open = readEquipmentQuestion("Quelle extension de garantie J+1 ?");
  assert.deepEqual(open, { kind: "warranty", levels: ["j1"], period: "missing" });
});

test("les paquets filtrent l’an dernier et les cinq ans", () => {
  const rows = [
    piece({ designation: "Baie 2019", family: "serveur", installedOn: "2019-04-01", warranty: "h4" }),
    piece({ designation: "Tour accueil", family: "poste", installedOn: "2025-06-01", warranty: "j1" }),
    piece({ designation: "Baie récente", family: "serveur", installedOn: "2025-02-01", warranty: "h4" }),
    piece({ designation: "Salon 2026", family: "portable", installedOn: "2026-01-15", warranty: "standard" }),
    piece({ designation: "Seuil", family: "serveur", installedOn: "2021-09-28", warranty: "standard" }),
  ];
  const year = previousYearWindow(now);
  const subscribed = warrantyPacket({ rows, levels: ["h4", "j1"], ...year, pending: 1 });
  assert.equal(subscribed.title, "Garanties souscrites");
  assert.deepEqual(
    subscribed.rows.map((row) => row.label),
    ["Atelier Nord · Baie récente", "Atelier Nord · Tour accueil"],
  );
  assert.equal(subscribed.measures[0]?.value, "2");
  assert.match(subscribed.missing.join(" "), /n’est pas compté/);
  assert.equal(narrativeFits(subscribed, renderPacket(subscribed)), true);

  const fleet = olderFleetPacket({ rows, families: ["serveur", "poste"], cutoff: ageCutoff(now), pending: 0 });
  assert.equal(fleet.title, "Parc de plus de cinq ans");
  assert.deepEqual(fleet.rows.map((row) => row.label), ["Atelier Nord · Baie 2019"]);
  assert.equal(fleet.measures[0]?.value, "1");
  assert.match(fleet.method, /date d’installation/);
  assert.equal(narrativeFits(fleet, renderPacket(fleet)), true);
  assert.equal(olderFleetPacket({ rows, families: [], cutoff: ageCutoff(now), pending: 0 }).missing[0]?.includes("famille"), true);
});

test("la carte d’équipement n’écrit rien avant confirmation", () => {
  const sketch = readEquipmentEntry(SERVER);
  assert.ok(sketch && sketch.family && sketch.warranty);
  const packet = equipmentProposalPacket({
    clientName: "Atelier Nord",
    productName: "",
    designation: sketch.designation,
    family: sketch.family,
    installedOn: sketch.installedOn,
    warranty: sketch.warranty,
  });
  assert.match(packet.missing.join(" "), /Rien n’est enregistré avant confirmation/);
  assert.equal(narrativeFits(packet, renderPacket(packet)), true);
});
