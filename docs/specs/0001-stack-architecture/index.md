# 0001. Pile du dashboard : SPA React + Vite + Mantine sur Render Static Site

**Date**: 2026-10-08
**Status**: Accepted

## Summary

Le dashboard sera une application monopage (SPA : tout s'affiche dans le navigateur, servie comme de simples fichiers) écrite en TypeScript strict avec React, Vite et la bibliothèque de composants Mantine. Elle parle directement à l'API NestJS existante et sera hébergée comme site statique sur Render, à côté de l'API. Ce choix vise un outil interne simple à construire et à faire tourner pour 1 à 3 admins, sans serveur à gérer. Pour construire, chaque fonctionnalité du scope s'ajoute dans son propre dossier sous `src/features/`, sur cette base commune.

## Decision

**Chosen option**: Option 1 : SPA React + Vite + Mantine, sur Render Static Site

Le dashboard est une SPA TypeScript (React, Vite, Mantine, React Router, TanStack Query), servie en fichiers statiques par Render et branchée sur l'API NestJS de production.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `mantine-form` (`mantinedev/skills`, `.claude/skills/mantine-form/`) · `mantine-combobox` (`mantinedev/skills`, `.claude/skills/mantine-combobox/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.claude/skills/tanstack-query/`) · `vitest` (`antfu/skills`, `.claude/skills/vitest/`)

## Rationale

Le raisonnement et les options comparées sont dans [rationale.md](rationale.md).

## Proposed stack

Les numéros de version sont ceux connus au 2026-10-08. Ce domaine évolue vite : au scaffold, prenez la dernière version majeure stable de chaque outil et notez les versions réelles dans `package.json`.

| Layer | Choice | Reason |
|---|---|---|
| Type d'application | SPA (rendu dans le navigateur, fichiers statiques) | Outil interne derrière connexion : aucun besoin de SEO ni de serveur, donc rien à faire tourner à part des fichiers. |
| Langage | TypeScript en mode strict | Même langage que le backend ; les types des réponses peuvent venir de `openapi.json`. |
| Runtime de dev | Node 22 LTS, fixé dans `.nvmrc` et `package.json` (`engines`) | La version déjà installée sur votre machine ; la même sur Render (variable `NODE_VERSION`). |
| Gestionnaire de paquets | npm, avec `package-lock.json` commité | Déjà utilisé par le backend ; `npm ci` sur Render pour des builds reproductibles. |
| Outil de build | Vite (modèle React + TypeScript) | Serveur de dev instantané, build statique dans `dist/`, standard actuel pour une SPA React. |
| Framework d'interface | React (19 ou plus récent) | Le plus répandu, le plus de ressources, et les Agent Skills installés le couvrent. |
| Composants | Mantine (`@mantine/core`, `@mantine/hooks`, puis `@mantine/notifications`, `@mantine/modals`, `@mantine/dropzone` quand une fonctionnalité en a besoin) | Tableaux, formulaires, modales, notifications et zone de dépôt de fichiers déjà prêts, sans Tailwind. |
| Icônes | Tabler Icons (`@tabler/icons-react`) | Le jeu d'icônes utilisé dans la documentation de Mantine, donc cohérent visuellement. |
| Routage | React Router en mode bibliothèque (`createBrowserRouter`) | Le standard pour une SPA ; les routes protégées et les paramètres de filtre dans l'URL sont simples à faire. |
| Données serveur | TanStack Query | Chargement, erreurs, cache et rechargement après chaque modification, au même endroit. |
| Formulaires | `@mantine/form` + Zod 4, branché comme le recommande la documentation actuelle de `@mantine/form` (voir le skill `mantine-form`) ; la façon retenue et les versions sont notées dans `package.json` | Le formulaire se branche directement sur les champs Mantine ; Zod décrit les règles une seule fois. |
| Langue de l'interface | Textes en français écrits directement dans le code, sans bibliothèque de traduction | Une seule langue prévue ; une bibliothèque i18n coûterait sans rien apporter. |
| Stockage des tokens | Token d'accès en mémoire seulement ; refresh token dans `sessionStorage` (clé `noli.admin.refreshToken`) | L'API renvoie les tokens dans le corps, sans cookie, et le refresh token n'est ni renouvelé ni révocable : `sessionStorage` survit au rechargement mais disparaît à la fermeture du navigateur, ce qui raccourcit la vie d'un token volé. Le détail du renouvellement appartient à la spec « Client API & erreurs ». |
| Client API | À décider dans la spec de la fonctionnalité 3, « Client API & erreurs » | Le choix entre client généré depuis `openapi.json` et client écrit à la main est une décision à part. |
| Tests | Vitest + Testing Library (`@testing-library/react`, environnement `jsdom`) + MSW pour simuler l'API | Vitest est natif à Vite ; MSW simule les réponses de l'API sans toucher au code. Pas de Playwright pour l'instant. |
| Lint, formatage, contrôles avant commit | À décider par `/audit` puis `/develop tooling` (fonctionnalité 2) | Choisis à partir du vrai projet une fois le scaffold fait. |
| Suivi des erreurs | Aucun service pour l'instant : messages clairs à l'écran et console du navigateur | 1 à 3 admins qui vous signalent directement un problème. |
| Hébergement | Render Static Site | Même fournisseur que l'API ; gratuit pour un site statique, HTTPS fourni. |
| Versionnage | Son propre dépôt Git, `.gitignore` en UTF-8 | Déploiement indépendant, comme le backend et l'app mobile. |

### Organisation du code

Organisation par fonctionnalité, qui suit les lignes du scope :

```
src/
  app/            point d'entrée, fournisseurs (Mantine, TanStack Query), routeur, mise en page
  features/       un dossier par fonctionnalité du scope (auth, series, episodes, images, categories, …)
    <feature>/    ses pages, ses composants, ses appels et hooks de données, ses tests
  shared/         ce qui sert à plusieurs fonctionnalités : client API, composants de base, utilitaires
  test/           configuration des tests (MSW, rendu avec les fournisseurs)
```

Règle : une fonctionnalité peut importer depuis `shared/`, jamais depuis une autre fonctionnalité. Ce qui sert à deux fonctionnalités passe dans `shared/`.

### Squelette minimal (ce que le scaffold installe, et rien de plus)

- `git init` sur la branche `main` ; `.gitignore` en UTF-8 avec `node_modules/`, `dist/`, `.env` et `.env.*` (sauf `!.env.example`). Le dépôt distant s'ajoute quand vous le créez.
- Scripts `package.json` : `dev` (`vite`), `build` (`tsc -b && vite build`), `preview` (`vite preview`), `typecheck` (`tsc -b --noEmit` ou équivalent), `test` (`vitest`).
- Alias d'import `@/` vers `src/`, déclaré dans `tsconfig` et dans la config Vite.
- Mantine installé selon sa documentation pour Vite : preset PostCSS de Mantine, import des feuilles de style de Mantine, `MantineProvider` dans `src/app/`.
- Vitest configuré (environnement `jsdom`, Testing Library, MSW dans `src/test/`) avec un test d'exemple qui passe.
- Premier écran : une coquille vide (routeur, fournisseurs Mantine et TanStack Query, une page d'accueil provisoire). La connexion, la mise en page admin et tout le reste appartiennent aux fonctionnalités 3, 4 et 5.
- Rien d'autre : notifications, modales, dropzone, icônes, client API s'installent avec la fonctionnalité qui en a besoin.

### Configuration

| Variable | Où | Rôle |
|---|---|---|
| `VITE_API_BASE_URL` | `.env.local` en local (`http://localhost:3000`), variable d'environnement Render en production | Adresse de l'API. Elle est **intégrée au code envoyé au navigateur** : n'y mettez jamais de secret. |
| `NODE_VERSION` | `render.yaml` | `22`, pour que Render construise avec la même version que vous. |

- Un fichier `.env.example` commité liste les variables avec des valeurs à remplacer, jamais devinées.
- `VITE_API_BASE_URL` est figée **au moment du build** : la changer sur Render demande un nouveau déploiement, pas seulement une modification de variable.
- En local, pointez vers l'API locale. Un `.env.local` qui pointe vers l'API de production fait modifier du **vrai contenu** à chaque test.

**Valeurs à fournir** (elles n'existent pas encore ; le scaffold laisse des valeurs à remplacer, clairement marquées) :
- l'adresse de l'API de production sur Render (`https://<service>.onrender.com`) ;
- l'adresse du dashboard sur Render (ou un domaine personnalisé), connue après la création du site.

### Hébergement sur Render

La configuration vit dans un fichier `render.yaml` commité à la racine, pour qu'elle soit relue comme le reste du code :
- Commande de build : `npm ci && npm run build` ; dossier publié : `dist` ; `NODE_VERSION` à `22`.
- Règle de réécriture : `/*` vers `/index.html`, pour que le rechargement d'une page comme `/series/123` ne donne pas une erreur 404.
- En têtes HTTP sur toutes les routes (en têtes, pas balise meta, sinon `frame-ancestors` est ignoré) :
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://res.cloudinary.com blob: data:; connect-src 'self' <adresse de l'API>; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. `'unsafe-inline'` pour les styles est nécessaire car Mantine injecte ses variables CSS et des styles en ligne. Les images de l'API sont servies par Cloudinary ; `blob:` et `data:` servent aux aperçus avant envoi.
  - `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`.
  - `X-Robots-Tag: noindex`, en plus de `<meta name="robots" content="noindex">` dans `index.html`.
- Si une fonctionnalité ajoute une origine (polices, autre hébergeur d'images), elle met à jour cette CSP.

### Ce que le backend doit changer

- Activer CORS dans `../noli-backend/src/main.ts` avec `app.enableCors({ origin: <liste> })`, la liste venant d'une nouvelle variable d'environnement `CORS_ORIGINS` (origines séparées par des virgules, par exemple `http://localhost:5173,https://<dashboard>.onrender.com`).
- Réglages : méthodes `GET, POST, PATCH, PUT, DELETE`, en tête `Authorization` et `Content-Type` autorisés, **pas** de `credentials` (aucun cookie n'est utilisé).
- Sans cela, le navigateur bloque tous les appels du dashboard.

### Ce qui revient à la spec « Client API & erreurs » (fonctionnalité 3)

- L'API gratuite de Render peut mettre environ 50 secondes à se réveiller : un délai d'attente assez long et un message « serveur en cours de réveil » dès la connexion.
- Un seul renouvellement de token à la fois, même si plusieurs requêtes reçoivent `401` en même temps.

## Consequences

**Positive**:
- Aucun serveur à faire tourner pour le dashboard : des fichiers statiques, gratuits, servis en HTTPS.
- Une seule pile TypeScript entre le backend et le dashboard ; les types de l'API peuvent venir du contrat OpenAPI.
- Mantine couvre presque tous les besoins du scope (tableaux, formulaires, modales, notifications, dépôt d'images) sans assembler de composants.
- Chaque fonctionnalité vit dans son dossier : ajouter une ligne du scope ne touche pas aux autres.

**Negative / tradeoffs**:
- Le refresh token dans `sessionStorage` reste lisible par un script injecté (XSS). Le backend ne le renouvelle pas et n'offre aucune route pour le révoquer : un token volé reste valable jusqu'à son expiration (`JWT_REFRESH_EXPIRATION`), sauf réinitialisation du mot de passe. La politique de sécurité de contenu et l'absence de HTML brut injecté réduisent le risque, sans l'éliminer. Passer à un cookie httpOnly demanderait de modifier l'authentification du backend.
- `sessionStorage` impose une nouvelle connexion à chaque ouverture du navigateur.
- `style-src 'unsafe-inline'` affaiblit un peu la CSP, à cause de Mantine ; les scripts, eux, restent limités au site.
- Une SPA affiche une page blanche le temps de charger le code ; acceptable pour quelques admins, pas pour un site public.
- Sans service de suivi d'erreurs, un plantage chez un admin n'est connu que s'il vous le signale.
- Le site statique gratuit de Render et l'API gratuite (si elle l'est) peuvent avoir un premier appel lent quand l'API s'est endormie ; le dashboard doit afficher un état de chargement clair.
- Les tests n'utilisent pas de vrai navigateur : un problème qui n'apparaît qu'en vrai navigateur peut passer, jusqu'à l'ajout éventuel de tests de bout en bout.

**Neutral**:
- Le backend doit activer CORS avant que le dashboard en ligne puisse l'appeler.
- Le choix du client API et des outils de lint et de formatage est renvoyé à leurs fonctionnalités (3 et 2).

## Follow-up

- [ ] Au scaffold, vérifiez les dernières versions majeures stables de Vite, React, Mantine, React Router, TanStack Query, Vitest et MSW, et confirmez que Render Static Site est toujours gratuit et gère les règles de réécriture et les en têtes.
- [ ] Activer CORS côté backend (`../noli-backend/src/main.ts`) avec la variable `CORS_ORIGINS`, puis l'ajouter aux variables Render du backend.
- [ ] Fournir l'adresse de l'API de production et, une fois le site créé, celle du dashboard (`.env`, `render.yaml`, `CORS_ORIGINS`).
- [ ] Si l'équipe grandit : demander au backend une route de déconnexion qui révoque le refresh token, ou passer à un cookie httpOnly.
- [ ] `vercel-react-best-practices`, `mantine-form`, `mantine-combobox`, `tanstack-query` et `vitest` ne sont pas encore dans le `AGENTS.md` racine, `## Agent skills` : ces conventions s'appliquent à tout le projet et ont leur place à la racine.
- [ ] `vercel-react-best-practices` est installé dans `.agents/skills/` mais n'apparaît pas dans `.claude/skills/` : vérifiez qu'il est bien chargé par Claude Code.
- [ ] Serveur MCP Render : à connecter dans vos réglages MCP au moment de la mise en ligne, pour voir services, déploiements et variables depuis l'agent (vérifiez qu'il s'agit bien du serveur officiel de Render).
- [ ] Réévaluer un service de suivi d'erreurs et des tests de bout en bout (Playwright) si l'équipe d'admins grandit.
