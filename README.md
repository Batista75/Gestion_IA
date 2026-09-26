# Gestion IA

Application locale de gestion pour une petite entreprise : dossiers projet, informations à classer, et calcul déterministe du prix de vente. La spécification fonctionnelle est dans [`docs/specifications-gestion-ia.pdf`](docs/specifications-gestion-ia.pdf).

Ce socle couvre l’accueil, la création d’un projet, le simulateur de taux de marque et l’assistant. L’assistant envoie le texte à Ollama sur le PC hôte. Les achats, la banque et le pilotage chiffré restent décrits dans l’interface, sans données inventées.

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

Pour laisser l’application tourner après la préparation :

```bash
npm run build
npm run start -- --hostname 0.0.0.0 --port 3847
```

## Ollama sur le PC hôte

L’application tourne sur l’Ubuntu. L’inférence tourne sur le PC Windows `192.168.1.5`, via Ollama et la carte graphique. Aucun texte n’est envoyé vers un service d’IA public.

Sur le PC hôte, dans un PowerShell :

```powershell
[System.Environment]::SetEnvironmentVariable("OLLAMA_HOST", "0.0.0.0:11434", "User")
New-NetFirewallRule -DisplayName "Ollama LAN" -Direction Inbound -Protocol TCP -LocalPort 11434 -RemoteAddress 192.168.1.0/24 -Action Allow
```

Quittez Ollama depuis la barre des tâches, relancez-le, puis :

```powershell
ollama pull qwen2.5:14b
```

Sur l’Ubuntu, dans `~/Gestion_IA/.env` :

```bash
OLLAMA_BASE_URL="http://192.168.1.5:11434"
```

Vérifiez le lien avant d’ouvrir l’assistant :

```bash
curl -fsS http://192.168.1.5:11434/api/tags
```

Si cette commande échoue et que l’Ubuntu est une machine virtuelle VirtualBox en NAT, le PC hôte se joint par la passerelle, pas par son adresse du réseau :

```bash
OLLAMA_BASE_URL="http://10.0.2.2:11434"
```

L’écran Assistant affiche alors si Ollama répond et quels modèles sont installés. Une question de prix chiffrée n’est pas envoyée au modèle : le calcul reste dans Ventes.

## Vérifier

```bash
npm test
npm run lint
npm run build
```

L’exemple de prix de la spécification (coût 700 € HT, marque 30 %, remise 10 %) donne un prix affiché de 1 111,11 € HT et un prix net de 1 000,00 € HT.
