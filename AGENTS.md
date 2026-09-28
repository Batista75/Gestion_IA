<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Gestion IA

Application locale de gestion pour TPE. La spécification est dans `docs/specifications-gestion-ia.pdf`.

- Les montants viennent de `src/domain/pricing.ts`. Ne les faites pas calculer par un modèle de langage.
- L’assistant appelle Ollama sur le réseau local (`OLLAMA_BASE_URL`, par défaut `http://192.168.1.5:11434`). Aucun texte n’est envoyé vers un service d’IA public.
- PostgreSQL tourne sur la machine. `bash scripts/setup-ubuntu.sh` installe Node.js 22 et PostgreSQL sur une Ubuntu neuve, puis lance l’interface sur le port 3847. `bash scripts/cloud-agent-start.sh --prepare` prépare seulement la base.
- Rien n’est classé dans un projet sans une action explicite de l’utilisateur.
- Le manuel affiché dans l’interface est `docs/manuel-utilisateur.md`. Tout changement d’écran ou de règle visible met à jour ce fichier. La spécification d’usage reste `docs/specifications-gestion-ia.pdf`.
- La documentation technique vit dans `docs/technique`. Le DAT (`dat.md`) tient l’architecture, le DCT (`dct.md`) la conception, `modelisation.md` les tables. Un fait n’est écrit que dans la page qui en est responsable. Les autres pages renvoient.
- À la fin de chaque cycle, proposer un seul objectif suivant, choisi dans ce qui vient d’être livré. L’objectif dit pourquoi maintenant, ce qui est tenu pour fini, et ce qui attend le cycle d’après.
