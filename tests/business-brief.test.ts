import assert from "node:assert/strict";
import test from "node:test";
import { matchDirectoryName, parseBusinessBrief } from "../src/domain/business-brief.ts";

const spoken =
  "Créer le projet : Cartes et kits de développement pour le client grid solutions .le projet consiste à fournir un kit de développement .";

const catalog = `
ID Client	Raison sociale	Pays / Zone	Secteur d'activité	Devise de compte	Contact principal	Email
CLI-B2B-001	Réseau Elec France SA	France	Power Grid / TSO	EUR (€)	Pierre Levêque	p.leveque@reseau-elec.fr
CLI-B2B-002	GridGrid Energy GmbH	Allemagne	Smart Grid / Distribution	EUR (€)	Hans Müller	h.mueller@gridgrid.de
CLI-B2B-003	Apex Cloud Solutions LLC	USA	IT Services & Data Center	USD ($)	Sarah Jenkins	s.jenkins@apexcloud.com
CLI-B2B-004	Nordic Substation Systems AS	Norvège	Power Grid / Infrastructure	EUR (€)	Erik Lindqvist	e.lindqvist@nordicsub.no

ID Produit	Désignation	Domaines	Unité	Prix Unit. HT	Devise	TVA
PRD-IT-001	Baie Serveur Haute Densité 42U	IT / Data Center	Unité	3 800,00	EUR	20,0 %
PRD-GRID-001	Transformateur HT/BT Connecté	Power Grid	Unité	45 000,00	EUR	20,0 %
PRD-GRID-002	Module IED / Automate de Poste	Power Grid / Automation	Unité	2 400,00	EUR	0,0 % (Intracomm.)
PRD-IT-002	Gateway IoT Power Sensor	IT / Smart Grid	Unité	650,00	USD	0,0 % (Export)

ID Service	Désignation	Type	Unité	Prix Unit. HT	Devise	TVA
SRV-IT-001	Migration Cloud & Architecture IT	Prestation	Jour / Homme	950,00	EUR	20,0 %
SRV-GRID-001	Étude d'Intégration Réseau HT	Ingénierie	Jour / Homme	1 200,00	EUR	20,0 %
SRV-GRID-002	Audit de Cybersécurité Ot/SCADA	Ingénierie	Forfait	18 500,00	EUR	0,0 % (Intracomm.)
SRV-IT-002	Licence logicielle SCADA Cloud (1 an)	SaaS	Licence / An	12 000,00	USD	0,0 % (Export)

ID Projet	Nom de l'Affaire	Client	Secteur	Budget Estimé	Statut	Chef de Projet
PRJ-2026-GRID1	Modernisation Poste HT Avoine	CLI-B2B-001	Power Grid (FR)	120 000 €	En négociation	C. Martin
PRJ-2026-GRID2	Substation Cyber-Hardening	CLI-B2B-002	Power Grid (DE)	85 000 €	Gagne	M. Weber
PRJ-2026-IT1	Smart Metering IoT Infrastructure	CLI-B2B-003	IT / Energy (US)	150 000 $	Prospection	J. Smith

Scénario A : Devis Complexe Power Grid (France - Mixte Produit & Ingénierie)
Référence : DEV-2026-001
Client : Réseau Elec France SA (CLI-B2B-001)
Projet : Modernisation Poste HT Avoine (PRJ-2026-GRID1)
Devise : EUR (€)
Lignes :
PRD-GRID-001 (Transformateur HT/BT Connecté) × 2 U = 90 000,00 €
SRV-GRID-001 (Étude d'Intégration Réseau HT) × 10 J/H = 12 000,00 €
PRD-GRID-002 (Module IED / Automate) × 5 U = 12 000,00 €
Conditions commerciales : Remise de 5 % sur le matériel (PRD-GRID-001).
Sous-total HT : 109 500,00 €
TVA (20 %) : 21 900,00 €
Total TTC : 131 400,00 €

Scénario B : Devis International / Intracommunautaire (Allemagne - Services & Licences IT/OT)
Référence : DEV-2026-002
Client : GridGrid Energy GmbH (CLI-B2B-002)
Projet : Substation Cyber-Hardening (PRJ-2026-GRID2)
Devise : EUR (€)
Régime fiscal : Auto-liquidation TVA (Exonération Intracommunautaire Art. 262 ter I du CGI)
Lignes :
SRV-GRID-002 (Audit Cybersécurité OT/SCADA) × 1 Forfait = 18 500,00 €
PRD-GRID-002 (Module IED Automate) × 10 U = 24 000,00 €
SRV-IT-001 (Migration Cloud) × 15 J/H = 14 250,00 €
Total HT : 56 750,00 €
TVA (0 % - Auto-liquidation) : 0,00 €
Total TTC : 56 750,00 €

Scénario C : Devis Export Hors-UE / Multidevises (USA - Software & Hardware IoT)
Référence : DEV-2026-003
Client : Apex Cloud Solutions LLC (CLI-B2B-003)
Projet : Smart Metering IoT Infrastructure (PRJ-2026-IT1)
Devise : USD ($)
Lignes :
PRD-IT-002 (Gateway IoT Power Sensor) ×50 U = 32 500,00$
SRV-IT-002 (Licence logicielle SCADA Cloud) ×2 Ans = 24 000,00$
Total HT : 56 500,00 $
Taxe / VAT (0 % Export) : 0,00 $
Total TTC : 56 500,00 $
`;

test("la phrase d’ouverture sépare le nom, le client et l’objet", () => {
  const plan = parseBusinessBrief(spoken);
  assert.equal(plan.projects.length, 1);
  assert.equal(plan.projects[0]?.name, "Cartes et kits de développement");
  assert.equal(plan.projects[0]?.primaryClient, "grid solutions");
  assert.equal(plan.projects[0]?.purpose, "fournir un kit de développement");
  assert.equal(
    matchDirectoryName("grid solutions", ["Grid Solutions Oy", "Atelier Cèdre"]),
    "Grid Solutions Oy",
  );
  assert.equal(matchDirectoryName("Horizon", ["Horizon", "Horizon 2"]), "Horizon");
  assert.equal(matchDirectoryName("grid", ["Grid Solutions Oy", "GridGrid Energy GmbH"]), null);
});

test("les tableaux et les trois devis d’exemple sont lus sans recalcul", () => {
  const plan = parseBusinessBrief(`${spoken}\n${catalog}`);
  assert.equal(plan.clients.length, 4);
  assert.equal(plan.clients[2]?.currency, "USD");
  assert.equal(plan.clients[2]?.email, "s.jenkins@apexcloud.com");
  assert.equal(plan.articles.length, 8);
  assert.equal(plan.articles.find((article) => article.reference === "SRV-IT-002")?.kind, "service");
  assert.equal(plan.articles.find((article) => article.reference === "PRD-IT-002")?.statedPrice, "650,00");
  assert.equal(plan.projects.length, 4);
  assert.equal(plan.projects.find((project) => project.reference === "PRJ-2026-GRID2")?.status, "Gagné");
  assert.equal(plan.quotes.length, 3);

  const france = plan.quotes[0];
  assert.equal(france?.vatZone, "france");
  assert.equal(france?.discountRate, 0.05);
  assert.deepEqual(france?.discountReferences, ["PRD-GRID-001"]);
  assert.equal(france?.statedTotalHt, "109 500,00 €");
  assert.equal(france?.lines.length, 3);

  assert.equal(plan.quotes[1]?.vatZone, "intracom");
  assert.equal(plan.quotes[1]?.statedVat, "0,00 €");
  assert.equal(plan.quotes[2]?.vatZone, "export");
  assert.equal(plan.quotes[2]?.currency, "USD");
  assert.equal(plan.quotes[2]?.lines[0]?.statedAmount, "32 500,00$");
});
