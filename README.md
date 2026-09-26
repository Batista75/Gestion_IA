# Gestion IA

Application locale de gestion pour une petite entreprise : dossiers projet, informations à classer, et calcul déterministe du prix de vente. La spécification fonctionnelle est dans [`docs/specifications-gestion-ia.pdf`](docs/specifications-gestion-ia.pdf).

Ce premier socle couvre l’accueil, la création d’un projet et le simulateur de taux de marque. L’assistant, les achats, la banque et le pilotage chiffré restent décrits dans l’interface, sans données inventées.

## Prérequis

- Ubuntu avec Node.js 22
- PostgreSQL 16

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
```

## Lancer l’application

```bash
npm ci
bash scripts/cloud-agent-start.sh --prepare
npm run dev -- --hostname 0.0.0.0 --port 3847
```

Ouvrez [http://127.0.0.1:3847](http://127.0.0.1:3847).

`DATABASE_URL` est recopié depuis `.env.example` s’il manque. Le mot de passe `gestion_ia_local` ne sert qu’au PostgreSQL de cette machine.

## Vérifier

```bash
npm test
npm run lint
npm run build
```

L’exemple de prix de la spécification (coût 700 € HT, marque 30 %, remise 10 %) donne un prix affiché de 1 111,11 € HT et un prix net de 1 000,00 € HT.
