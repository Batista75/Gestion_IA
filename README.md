# Gestion IA

Application locale de gestion pour une petite entreprise : dossiers projet, informations à classer, et calcul déterministe du prix de vente. La documentation est dans [`docs/README.md`](docs/README.md) : la spécification fonctionnelle ([`docs/specifications-gestion-ia.pdf`](docs/specifications-gestion-ia.pdf)) et le manuel utilisateur ([`docs/manuel-utilisateur.md`](docs/manuel-utilisateur.md)), affiché dans l’application.

Ce socle couvre l’accueil, la création d’un projet, le simulateur de taux de marque et l’assistant. L’assistant envoie le texte à Ollama sur le PC hôte. Les achats, la banque et le pilotage chiffré restent décrits dans l’interface, sans données inventées.

## Lancer l’application sur Ubuntu

Le script installe Node.js 22 et PostgreSQL s’ils manquent, crée la base pour le compte Unix courant, puis démarre l’interface.

```bash
cd ~/Gestion_IA
git pull origin main
bash scripts/setup-ubuntu.sh
```

Ouvrez [http://127.0.0.1:3847](http://127.0.0.1:3847).

Sans réinstaller les paquets :

```bash
bash scripts/cloud-agent-start.sh --prepare
npm run dev -- --hostname 0.0.0.0 --port 3847
```

`DATABASE_URL` est écrit dans `.env` pour le compte Unix qui lance le script. Le mot de passe `gestion_ia_local` ne sert qu’au PostgreSQL de cette machine.

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

Quittez Ollama depuis la barre des tâches, relancez-le, puis installez un modèle de conversation d’environ 7 milliards de paramètres et le petit modèle d’index. Les deux ne restent pas en mémoire ensemble : l’index se décharge avant la réponse. Cela tient sur une carte de 16 Go, avec 32 Go de RAM, pour un utilisateur.

```powershell
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

Si `qwen-dgfip-multisec-2ep` est déjà installé, gardez-le pour la conversation. N’utilisez pas Mixtral ni un modèle 14B ou plus sur cette carte. `bge-m3` n’est pas chargé : il est plus lourd que `nomic-embed-text`.

Sur l’Ubuntu, dans `~/Gestion_IA/.env` :

```bash
OLLAMA_BASE_URL="http://192.168.1.5:11434"
OLLAMA_EMBED_MODEL="nomic-embed-text"
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
