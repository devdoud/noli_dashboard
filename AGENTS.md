# Noli Dashboard

Dashboard d'administration de Noli (SPA web), client de l'API NestJS `../noli-backend`. Interface et échanges avec l'utilisateur en **français**.

## Stack

- **Language / Runtime**: TypeScript strict (6.x), Node 22 LTS (`.nvmrc`)
- **Framework**: React 19 + Vite 8, SPA servie en statique sur Render (`render.yaml`)
- **Key dependencies**: Mantine 9 (UI), React Router 7 (mode bibliothèque), TanStack Query 5, `@mantine/form` + Zod 4 (à installer avec le premier formulaire), Vitest + Testing Library + MSW
- **Package manager**: npm (`package-lock.json` commité, `npm ci` sur Render)
- Décision complète : [spec 0001](docs/specs/0001-stack-architecture/index.md)

## Build approach

Tracer Bullet : chaque fonctionnalité est branchée de bout en bout sur la vraie API et utilisable dès qu'elle est finie, puis on l'épaissit.

## Commands

```bash
npm install          # Install
npm run dev          # Dev server (http://localhost:5173)
npm run build        # Build (tsc -b && vite build)
npm run typecheck    # Typecheck
npm test             # Tests (Vitest, mode watch ; `npx vitest run` pour un passage unique)
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md` (ou `NNNN-title/index.md`). Scope : `docs/scope/scope.md`.

## Rules

- **Style fonctionnel** : composants et fonctions purs par défaut, données immuables (`const`, `readonly`, jamais de mutation en place), effets de bord (réseau, stockage) aux bords et explicites (hooks TanStack Query, client API). Pas de classes quand une fonction suffit ; pas d'état mutable partagé au niveau module.
- **Types stricts** : `strict` + `noUncheckedIndexedAccess`, pas de `any` ; préférer `undefined` et les unions à `null` dans notre code (l'API peut renvoyer `null`).
- **Organisation par fonctionnalité** : `src/features/<feature>/` (pages, composants, hooks de données, tests côte à côte), `src/shared/` pour le commun, `src/app/` pour fournisseurs et routeur. Une fonctionnalité n'importe jamais une autre fonctionnalité ; imports via l'alias `@/`.
- **Exports nommés seulement**, pas d'`export default`. Nommage : PascalCase pour composants et types, camelCase pour fonctions, hooks en `use…`, fichier nommé comme son export principal.
- **Erreurs** : une seule façon de les gérer, tout appel d'API passe par le client partagé de `src/shared/` et ses erreurs typées (détails : spec de la fonctionnalité 3). Messages affichés en français.
- **Variables d'environnement** validées au démarrage (`VITE_API_BASE_URL` absente ou invalide → erreur claire). Les `VITE_*` sont publiques : jamais de secret.
- **Accessibilité WCAG AA** sur chaque écran : clavier, focus visible, libellés, contrastes.
- **Tests** : chaque fonctionnalité arrive avec ses tests unitaires et d'intégration (Vitest + Testing Library, API simulée par MSW via `src/test/`). Toute requête non simulée fait échouer le test.
- **Modules partagés documentés** : un court commentaire en tête de chaque module de `src/shared/`.
- **Commits conventionnels** : `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`. Jamais de secret commité ; `.gitignore` en UTF-8.

## Tooling

Choisi par `/audit`, installé par `/develop tooling` :
- Lint : ESLint (config plate) avec règles TypeScript, React Hooks et accessibilité (jsx-a11y). Formatage : Prettier.
- Avant chaque commit : lint et formatage sur les fichiers modifiés, typecheck du projet.
- CI : GitHub Actions à chaque push (lint, typecheck, tests, build), une fois le dépôt distant créé.

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Agent skills

- [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, bonnes pratiques React (rendu, hooks, performance)
- [mantine-form](.agents/skills/mantine-form/): `mantinedev/skills`, formulaires `@mantine/form` et validation par schéma
- [mantine-combobox](.agents/skills/mantine-combobox/): `mantinedev/skills`, listes de choix et sélecteurs personnalisés Mantine
- [tanstack-query](.agents/skills/tanstack-query/): `tanstack-skills/tanstack-skills`, requêtes, mutations et cache TanStack Query
- [vitest](.agents/skills/vitest/): `antfu/skills`, écriture et configuration des tests Vitest

Declined: skills ESLint, Prettier, GitHub Actions · MCP servers: Render (recommended, à connecter à la mise en ligne)

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
