# 0004. Connexion admin et liste des séries

**Date**: 2026-10-14
**Status**: Accepted

## Summary

Premier écran utile du dashboard : une page de connexion pour les admins, la protection de toutes les autres pages, et la liste paginée des séries du catalogue. La connexion et la session reposent sur la brique de la spec 0002 (tokens, renouvellement, partage entre onglets), et l'interface sur le design system de la spec 0003 (`PageHeader`, `DataTable`). La fonctionnalité se termine par la mise en ligne sur Render, à l'adresse `https://admin.nollli.com`, reliée à l'API de production : c'est la preuve que tout le circuit marche.

## Requirements

**User stories**:
- En tant qu'admin, je veux me connecter avec mon email et mon mot de passe, pour accéder au dashboard.
- En tant qu'admin, je veux voir toutes les séries du catalogue, page par page, avec leur état (accès, épisodes, statut), pour savoir où intervenir.
- En tant qu'admin, je veux rester connecté pendant mon travail et retrouver la page où j'étais après une reconnexion.
- En tant que responsable de Noli, je veux qu'un compte non admin ne puisse jamais entrer dans le dashboard.

**Acceptance criteria**:
- **AC-1**: `/connexion` affiche une carte centrée : « Noli », « Espace d'administration », un champ « Email » (focus au chargement), un champ « Mot de passe » (avec bouton afficher ou masquer) et un bouton « Se connecter ». Elle n'utilise pas `AppLayout`.
- **AC-2**: À l'envoi, l'email doit être une adresse valide et le mot de passe non vide ; sinon un message en français s'affiche sous le champ concerné, sans appel à l'API.
- **AC-3**: Un admin qui se connecte (`login()` de la spec 0002) arrive sur l'adresse `retour` si elle est sûre (commence par `/` et pas par `//`), sinon sur `/series`.
- **AC-4**: Des identifiants faux affichent « Email ou mot de passe incorrect. » dans la carte ; un compte non admin affiche « Ce compte n'a pas accès au tableau de bord. » ; aucune session n'est ouverte dans ces deux cas. Pendant l'envoi, le bouton montre un chargement et ne peut pas être cliqué une seconde fois.
- **AC-5**: Toutes les pages sous `AppLayout` (Vue d'ensemble, séries, 404, vitrine) exigent une session : sans session (`anonymous`), redirection vers `/connexion?retour=<chemin actuel avec sa recherche>` ; pendant `restoring`, un chargement plein écran s'affiche (ni la page protégée, ni la connexion).
- **AC-6**: Quand la session se termine avec un message (`expired`, `forbidden`), la page de connexion l'affiche au dessus du formulaire et garde `retour` ; après « Se déconnecter » (`logout`), la page de connexion s'affiche sans message et **sans** `retour` (un autre admin qui se connecte ensuite arrive sur `/series`).
- **AC-7**: Un admin déjà connecté qui ouvre `/connexion` est redirigé vers `retour` (si sûr) ou `/series`.
- **AC-8**: `/series` affiche `PageHeader` « Séries » et un `DataTable` paginé par le serveur, 20 séries par page, avec les colonnes : Couverture et titre, Catégories, Statut, Accès, Épisodes, Note, Mise à jour (détails dans « Colonnes »).
- **AC-9**: La page courante est dans l'adresse (`/series?page=2`) ; un clic de pagination ajoute une entrée d'historique, recharger ou revenir en arrière garde la page ; une valeur absente ou invalide (pas uniquement des chiffres, 0, au delà de 10 000) vaut 1 ; une page au delà de la dernière remplace l'adresse par la dernière page (sans entrée d'historique, sans afficher l'état vide).
- **AC-10**: Chargement, liste vide (« Aucune série pour le moment ») et erreur (`ErrorState` avec « Réessayer ») suivent l'ordre de `DataTable` ; changer de page garde les lignes précédentes grisées jusqu'à l'arrivée des nouvelles.
- **AC-11**: L'entrée « Séries » du menu est active (`ready: true`).
- **AC-12**: Le dashboard est en ligne à `https://admin.nollli.com` (site statique Render, `render.yaml`) et appelle `https://api.nollli.com` sans blocage CORS : l'engineer s'y connecte avec son compte admin de production (il existe déjà) et voit la liste des séries de production.

## Decision

**Chosen option**: Option 1 : routes protégées par un composant de garde qui lit `useSession()`, page de connexion avec `@mantine/form` et Zod, liste lue par TanStack Query et `apiRequest`

La garde, la page de connexion et la liste s'appuient entièrement sur les briques des specs 0002 et 0003 ; les séries vivent dans `src/features/series/`, la connexion dans `src/features/auth/`.

**Implementation skills**: `mantine-form` (`mantinedev/skills`, `.agents/skills/mantine-form/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Le raisonnement et les options comparées sont dans [rationale.md](rationale.md).

## Feature design

### Source du design

`design.md` et la vitrine `/dev/composants` (spec 0003). Aucune nouvelle couleur, police ni taille : uniquement Mantine et `src/shared/ui/`.

### Routes

```
/connexion            LoginPage (hors AppLayout, publique)
RequireSession        garde (route de mise en page sans rendu propre)
  AppLayout
    /                 HomePage (spec 0003)
    /series           SeriesListPage
    /dev/composants   vitrine (développement seulement)
    *                 NotFoundPage
```

- **Emplacements :**
  - `RequireSession` dans `src/shared/session/RequireSession.tsx` ;
  - `FullPageLoader` dans `src/shared/ui/FullPageLoader.tsx` ;
  - `LoginPage` dans `src/features/auth/`, `SeriesListPage` dans `src/features/series/`.
- **Déclaration dans `src/app/routes.tsx` :** `/connexion` est une route sœur de la garde. La garde est une route de mise en page (`element: <RequireSession />`), dont l'enfant est la route `AppLayout` actuelle, avec en plus l'enfant `series`.
- `RequireSession` lit `useSession()` :
  - `restoring` → `FullPageLoader` (un `Loader` Mantine centré, avec un texte « Chargement… » visuellement masqué en `role="status"`) ;
  - `anonymous` avec `endReason === 'logout'` → `<Navigate to="/connexion" replace />`, sans `retour` ;
  - `anonymous` dans les autres cas (pas de session, `expired`, `forbidden`) → `<Navigate to={'/connexion?retour=' + encodeURIComponent(pathname + search)} replace />` ;
  - `authenticated` → `<Outlet />`.
- La page `/connexion` elle même est publique. Une adresse inconnue passe par la garde, puis par `NotFoundPage`.
- **Session finie pendant un chargement :** si la session se termine pendant le chargement d'une page (un `401` refusé ou un `403` sans code, spec 0002), la redirection de la garde l'emporte et aucun écran d'erreur n'est affiché. Un `403` qui porte un code reste une erreur ordinaire (`ErrorState`).
- **Menu :** « Séries » reste active sur `/series?page=2`, parce que la correspondance porte sur le chemin seulement.

### Adresse de retour (sûre)

Fonction pure `safeReturnPath(raw: string | null): string | undefined`, dans `src/features/auth/returnPath.ts`. Elle travaille sur la valeur déjà décodée une fois par `searchParams.get`, sans second décodage. Elle renvoie `undefined`, et l'appelant utilise alors `/series`, si l'une de ces conditions est vraie :
- `raw` est absent, vide, ne commence pas par `/`, ou commence par `//` ;
- `raw` contient un `\` (n'importe où) ou un caractère de contrôle (`\u0000` à `\u001f`, `\u007f`) ;
- `new URL(raw, window.location.origin).origin` diffère de `window.location.origin` ;
- le chemin obtenu vaut `/connexion` ou commence par `/connexion/` ou `/connexion?`.

Sinon, elle renvoie `pathname + search + hash` de l'URL analysée.

### Page de connexion (`src/features/auth/LoginPage.tsx`)

- **Composition :**
  - fond de page ;
  - au centre, une `Paper withBorder` de 400 px au plus, avec « Noli » (Bricolage Grotesque 800, taille `h1`, c'est le seul `h1` de la page) et « Espace d'administration » (texte secondaire) ;
  - éventuellement le message de fin de session (`Alert` d'information, bleu indigo `noliIndigo`) ;
  - le formulaire ;
  - le bouton « Se connecter » sur toute la largeur.
- **Formulaire :**
  - balise `<form noValidate>`, pour que les messages en français de Zod remplacent les bulles du navigateur ;
  - `useForm` de `@mantine/form`, en mode `uncontrolled`, avec `validate: schemaResolver(loginSchema, { sync: true })`. `schemaResolver` est fourni par `@mantine/form` : aucun paquet de plus ;
  - `loginSchema = z.object({ email: z.string().trim().pipe(z.email('Adresse email invalide.')), password: z.string().min(1, 'Mot de passe requis.') })` ;
  - l'email envoyé est la valeur nettoyée (`loginSchema.parse(values).email`).
- **Champs :**
  - `TextInput` « Email », avec `type="email"`, `autoComplete="username"` et `autoFocus` (le focus est sur l'email au chargement, même quand un message de fin de session est affiché) ;
  - `PasswordInput` « Mot de passe », avec `autoComplete="current-password"`. Son bouton afficher ou masquer porte le libellé accessible « Afficher le mot de passe » ou « Masquer le mot de passe ».
- **Envoi :** une mutation TanStack Query (`useMutation`) appelle `login(email, password)` :
  - pendant l'envoi, le bouton est en `loading`, désactivé, et son nom accessible est « Connexion en cours » ;
  - en cas de succès, il n'y a pas de `navigate` dans `onSuccess`. `login()` passe la session à `authenticated`, et c'est la règle « déjà connecté » ci dessous qui redirige : une seule navigation ;
  - en cas d'échec, une `Alert` rouge (`noliRed`) en `role="alert"` dans la carte affiche `toUserMessage(error).message`.
  - Les erreurs `401`, `not-admin`, réseau et `timeout` donnent les textes de la table de la spec 0002. La notification « Le serveur se réveille » de la spec 0002 apparaît d'elle même après 5 s.
  - `login()` vide le cache TanStack Query (`queryClient.clear()`, spec 0002). Un test vérifie que la mutation se termine quand même et que l'état de chargement retombe.
- **Message de fin de session :**
  - il vient de `useSession().endMessage` quand `status === 'anonymous'` ;
  - il s'affiche dans une `Alert` d'information (`noliIndigo`), en `role="status"` ;
  - un état local `dismissed` de `LoginPage` le masque dès le premier envoi du formulaire, sans modifier le store de session.
- **Déjà connecté :** si `status === 'authenticated'`, la page rend `<Navigate to={retour sûr ou '/series'} replace />`. Pendant `restoring`, elle rend `FullPageLoader`.
- **Titre de l'onglet :** « Connexion · Noli Admin », via `usePageTitle`.

### Liste des séries (`src/features/series/SeriesListPage.tsx`)

- `PageHeader`, avec le titre « Séries » et la description « Toutes les séries du catalogue, des plus récentes aux plus anciennes. ». Il n'a pas d'action : « Nouvelle série » arrive avec la fonctionnalité 6.
- La liste est dans une `Paper withBorder`, avec un `DataTable` de légende « Liste des séries » et une taille de page de 20.
- **Données :** le hook `useSeriesPage(page)` dans `src/features/series/api.ts` :
  - `useQuery({ queryKey: ['series', 'list', page], queryFn: ({ signal }) => apiRequest({ method: 'GET', path: '/series', query: { page, limit: 20 }, schema: seriesPageSchema, signal }), placeholderData: keepPreviousData })` ;
  - les réessais suivent la règle de la spec 0002 (`createQueryClient`) : jamais sur un 4xx ni une fin de session ;
  - `rows` passé à `DataTable` vaut `data?.data.series` (donc `undefined` au premier chargement, ce qui affiche les squelettes) ;
  - `total` vaut `data?.data.total ?? 0` ;
  - `isLoading` vaut `isFetching`, mais `error` est prioritaire : pendant un « Réessayer », `ErrorState` reste affiché jusqu'à la réponse ;
  - le résumé et la pagination de `DataTable` utilisent la page **des données affichées** (`data?.data.page ?? page`) : pendant un changement de page, les anciennes lignes grisées gardent leur propre résumé.
- **Page dans l'adresse :** `useSearchParams` de React Router.
  - `parsePage(raw)` (fonction pure, `src/features/series/page.ts`) : la page vaut l'entier si `raw` correspond à `/^\d+$/`, qu'il est un entier sûr et qu'il est compris entre 1 et 10 000 ; sinon elle vaut 1 ;
  - `onPageChange(n)` est un rappel stable (`useCallback`). Il pose `?page=n` dans l'adresse en **ajoutant** une entrée d'historique (`page=1` retire le paramètre), puis appelle `window.scrollTo({ top: 0 })` ;
  - **page au delà de la fin :** quand la réponse a `series` vide, `total > 0` et `page > 1`, la page **remplace** l'adresse par la dernière page (`setSearchParams(…, { replace: true })`, dernière page = `Math.ceil(total / 20)`), et passe `rows={undefined}` à `DataTable` pour garder les squelettes au lieu de l'état vide. Le recadrage interne de `DataTable` (spec 0003) ne se déclenche alors pas, puisque la page s'en charge avant ;
  - **annonce :** un texte visuellement masqué en `aria-live="polite"` annonce « Page 2 sur 3 » après chaque changement de page.
- **Vide :** `EmptyState`, avec le titre « Aucune série pour le moment » et la description « Les séries créées dans le dashboard ou par l'API apparaîtront ici. ».
- **Titre de l'onglet :** « Séries · Noli Admin ».

### Colonnes

| Colonne | Contenu | Source |
|---|---|---|
| Couverture et titre (`title`) | Vignette de 40 × 60 px (2:3, `alt=""`, `loading="lazy"`, `object-fit: cover`, rayon `sm`) suivie du titre en graisse 600 ; sans `coverImage`, un bloc de même taille en surface relevée avec `IconPhoto` (décoratif) | `coverImage`, `title` |
| Catégories | Noms séparés par des virgules ; aucun → « — » | `categories[].name` |
| Statut | `Badge` : « En cours » (`ongoing`, indigo léger) ou « Terminée » (`completed`, gris léger) ; toute autre valeur → « — » | `status` |
| Accès | `Badge` ambre léger « Premium », suivi de « 2 gratuits » (ou « 1 gratuit », « aucun gratuit ») en texte secondaire ; ou un `Badge` gris « Gratuit » | `isPremium`, `freeEpisodeCount` |
| Épisodes | Nombre, aligné à droite | `totalEpisodes` |
| Note | Si `votes > 0` : « 8,4 » suivi de « (120) » en texte secondaire, avec une décimale, en `fr-FR` (une note de 0 avec des votes s'affiche « 0,0 ») ; si `votes` vaut 0 → « — » | `rating`, `votes` |

Les badges utilisent la variante `light` des palettes du thème (`noliAmber`, `noliIndigo`, `gray`), dont les contrastes sont mesurés dans `design.md` (badge Premium : 5,00:1 en clair, 11,93:1 en sombre). Un nouveau couple de couleurs est mesuré avant d'être utilisé.
| Mise à jour | `formatDate(updatedAt)` (spec 0003) | `updatedAt` |

Le titre reste du texte simple. Le lien vers la fiche arrivera avec la fonctionnalité 6.

### Schéma de réponse (Zod, `src/features/series/schemas.ts`)

Schéma **tolérant** : une valeur absente ou `null` sur un champ d'affichage ne doit pas faire échouer toute la page.

```ts
const count = z.number().int().min(0).nullish().transform((value) => value ?? 0)
const seriesSummarySchema = z.object({
  _id: z.string(),
  title: z.string(),
  coverImage: z.string().nullish(),
  categories: z.array(z.object({ _id: z.string(), name: z.string() })).nullish().transform((value) => value ?? []),
  status: z.string().nullish(), // 'ongoing' | 'completed' attendus ; autre valeur → « — »
  isPremium: z.boolean().nullish().transform((value) => value ?? false),
  freeEpisodeCount: count,
  totalEpisodes: count,
  rating: z.number().nullish().transform((value) => value ?? 0),
  votes: count,
  updatedAt: z.string().nullish(), // absent → formatDate affiche « — »
})
const seriesPageSchema = z.object({
  data: z.object({
    total: z.number().int().min(0),
    page: z.number().int(),
    limit: z.number().int(),
    series: z.array(seriesSummarySchema),
  }),
})
```

Les champs inconnus sont acceptés et ignorés (Zod 4 retire les clés en trop par défaut).

### Data model sketch

Pas de stockage propre. L'état est fait de :
- la session (spec 0002) ;
- le cache TanStack Query, avec la clé `['series', 'list', page]` ;
- l'adresse (`?page`, `?retour`).

### API surface

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/login` | POST | `email`, `password` (via `login()` de la spec 0002) | session ouverte | aucune | `401`, `not-admin` |
| `/series` | GET | `page`, `limit=20` | `data.total`, `data.page`, `data.limit`, `data.series[]` | bearer | `400` (page invalide, évitée côté client), `401` (renouvellement, spec 0002), réseau, `timeout` |

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Connexion | email et mot de passe envoyés | champs du formulaire (email sans espaces) |
| Connexion | destination après succès | `safeReturnPath(searchParams.get('retour'))`, sinon `/series` |
| Connexion | message d'erreur | `toUserMessage(error)` (table de la spec 0002) |
| Page de connexion | message de fin de session | `useSession().endMessage` (spec 0002) |
| Garde | adresse de retour | `location.pathname + location.search` au moment de la redirection |
| Liste | page demandée | `?page` de l'adresse, 1 par défaut |
| Liste | lignes et total | `data.series`, `data.total` de `GET /series` |
| Liste | taille de page | constante 20 (décidée ici ; l'API n'impose pas de maximum sur `GET /series`, vérifié avec `limit=60`) |
| Liste | page affichée dans le résumé | `data.data.page` de la réponse affichée, sinon la page demandée |
| Liste | dernière page (recadrage) | `Math.ceil(data.data.total / 20)` |
| Garde | `retour` après déconnexion | aucun (`endReason === 'logout'`) |
| Mise en ligne | compte admin de production | compte existant de l'engineer (il le saisit lui même, jamais stocké ni transmis) |
| Colonnes | toutes les valeurs | table « Colonnes » |
| Mise en ligne | adresse de l'API | variable Render `VITE_API_BASE_URL=https://api.nollli.com` |
| Mise en ligne | origine autorisée par l'API | `CORS_ORIGINS` du backend sur Render, avec `https://admin.nollli.com` |

### Key invariants

- Aucune page sous `AppLayout` ne s'affiche sans session `authenticated`.
- La redirection après connexion ne quitte jamais l'origine du dashboard (`safeReturnPath`).
- Le mot de passe n'est jamais gardé après l'envoi (mode `uncontrolled`, aucun stockage), ni écrit dans la console.
- La liste n'appelle jamais `GET /series` avec une page invalide (hors de 1 à 10 000) ni une autre taille que 20.

### Security model

- Le rôle admin est vérifié à la connexion (spec 0002) et par le backend sur chaque route admin.
- La garde n'est qu'un confort d'interface : la sécurité réelle reste côté API (`403`).
- `retour` est filtré contre les redirections ouvertes.
- La CSP de production (`connect-src` vers `https://api.nollli.com`, `img-src` vers `https://res.cloudinary.com`) couvre les appels et les couvertures.

### Configuration required

- Nouvelle dépendance : `@mantine/form` en version exacte `9.7.1`, la même que les autres paquets Mantine (prévue par la spec 0001). Son `schemaResolver` intégré branche Zod : aucun autre paquet.
- **Mise en ligne, dans cet ordre** (actions de l'engineer, guidées par `/develop`) :
  1. Render, nouveau Blueprint depuis le dépôt `devdoud/noli_dashboard` (`render.yaml`). Saisir `VITE_API_BASE_URL=https://api.nollli.com` quand Render le demande. Comme `sync: false`, une modification ultérieure demande de reconstruire le site à la main.
  2. Render, réglages du site : ajouter le domaine personnalisé `admin.nollli.com`. Il ne se déclare pas dans `render.yaml`.
  3. DNS de `nollli.com` : un enregistrement `CNAME` `admin` vers l'adresse `…onrender.com` indiquée par Render. Attendre la vérification du domaine et le certificat TLS.
  4. Render, service de l'API : ajouter `https://admin.nollli.com` à `CORS_ORIGINS`.
     - La liste est séparée par des virgules et comparée exactement, sans `/` final ni chemin, par exemple `https://admin.nollli.com,http://localhost:5173` si les développeurs testent en local contre la production.
     - Redémarrer l'API.
  5. Contrôle manuel, qui n'est pas un test Vitest :
     - `curl -i -X OPTIONS https://api.nollli.com/auth/login -H "Origin: https://admin.nollli.com" -H "Access-Control-Request-Method: POST"` renvoie `Access-Control-Allow-Origin: https://admin.nollli.com` ;
     - puis une vraie connexion sur `https://admin.nollli.com` avec le compte admin de production.

### Critical test scenarios

- Connexion réussie : un admin avec `?retour=/series?page=2` arrive sur `/series?page=2` ; sans `retour`, il arrive sur `/series`, vérifie **AC-1**, **AC-3**.
- Validation : un email invalide ou un mot de passe vide donnent un message sous le champ et aucun appel à l'API, vérifie **AC-2**.
- Refus : un `401` donne « Email ou mot de passe incorrect. » ; un compte `user` donne « Ce compte n'a pas accès au tableau de bord. » ; dans les deux cas, pas de session, vérifie **AC-4**.
- Double clic : un seul `POST /auth/login` pendant l'envoi, vérifie **AC-4**.
- Garde : `/series?page=3` sans session mène à `/connexion?retour=%2Fseries%3Fpage%3D3` ; pendant `restoring`, le chargement plein écran s'affiche, vérifie **AC-5**.
- Fin de session : `expired` affiche le message sur `/connexion`, `logout` n'en affiche aucun, vérifie **AC-6**.
- Déjà connecté : `/connexion` mène à `/series`, vérifie **AC-7**.
- Retour non sûr : `//evil.com`, `/\evil.com`, `https://evil.com`, `/series\x00`, `/connexion` et `/connexion?retour=/x` mènent tous à `/series` ; `/series?page=2#haut` est gardé, vérifie **AC-3**.
- Formulaire : un email avec espaces autour est envoyé nettoyé ; pas de bulle du navigateur (`noValidate`) ; l'erreur est annoncée (`role="alert"`) ; le chargement retombe après une connexion réussie malgré le vidage du cache, vérifie **AC-2**, **AC-4**.
- Déconnexion : après « Se déconnecter » sur `/series?page=2`, l'adresse est `/connexion` sans `retour`, vérifie **AC-6**.
- Schéma tolérant : une série avec `rating: null`, `votes: null` et `status: 'brouillon'` s'affiche avec « — », sans écran d'erreur, vérifie **AC-8**.
- Fin de session pendant le chargement de la liste : la redirection vers `/connexion` a lieu sans écran d'erreur, vérifie **AC-5**.
- Liste : 45 séries simulées donnent 20 lignes et « 1 à 20 sur 45 » ; une couverture absente affiche le bloc par défaut ; les badges et la note suivent la table « Colonnes », vérifie **AC-8**.
- Pagination : « Page suivante » mène à `?page=2` (nouvelle entrée d'historique) et appelle `GET /series?page=2&limit=20` ; `?page=abc`, `?page=2abc`, `?page=1.5`, `?page=0` et `?page=99999` valent 1 ; `?page=99` (réponse vide, total 45) remplace l'adresse par `?page=3` sans afficher l'état vide ; « Page 2 sur 3 » est annoncé, vérifie **AC-9**.
- États : erreur réseau puis « Réessayer », liste vide, lignes grisées pendant le changement de page, vérifie **AC-10**.
- Menu : l'entrée « Séries » est visible et active sur `/series`, vérifie **AC-11**.
- Production : sur `https://admin.nollli.com`, la requête préalable vers `https://api.nollli.com` renvoie `Access-Control-Allow-Origin: https://admin.nollli.com`, la connexion réelle réussit et la liste s'affiche, vérifie **AC-12**.

## Build plan

Ordonné en Tracer Bullet : d'abord le fil complet le plus mince (garde, connexion, liste minimale branchées sur la vraie API), puis on épaissit (colonnes, pagination dans l'adresse, états), et enfin la mise en ligne qui prouve le circuit de production.

1. Installer `@mantine/form` en version `9.7.1` ; écrire `safeReturnPath`, satisfies **AC-3**
2. `FullPageLoader` et `RequireSession` dans les routes (toutes les pages sous `AppLayout` protégées), satisfies **AC-5**
3. `LoginPage` : carte, formulaire Zod, envoi par `login()`, redirection, erreurs dans la carte, message de fin de session, « déjà connecté », satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-6**, **AC-7**
4. `schemas.ts`, `useSeriesPage`, `SeriesListPage` minimal (titre et pagination) ; entrée « Séries » à `ready: true`, satisfies **AC-8**, **AC-11**
5. Colonnes complètes (vignette et bloc par défaut, catégories, statut, accès, épisodes, note, mise à jour), satisfies **AC-8**
6. Page dans l'adresse, valeurs invalides, retour à la dernière page, lignes gardées pendant le changement de page ; états vide et erreur, satisfies **AC-9**, **AC-10**
7. Mise en ligne : vérifier `render.yaml`, guider la création du site Render (`VITE_API_BASE_URL`, domaine `admin.nollli.com`), le `CNAME` DNS et l'ajout de `https://admin.nollli.com` à `CORS_ORIGINS` de l'API ; contrôler la requête préalable et une vraie connexion en ligne, satisfies **AC-12**

## Consequences

**Positive**:
- Le dashboard devient utile : un admin se connecte et voit le catalogue de production.
- La garde et la page de connexion servent à toutes les fonctionnalités suivantes.
- La mise en ligne valide d'un coup l'hébergement, la CSP, le CORS et la session sur la vraie API.

**Negative / tradeoffs**:
- La liste utilise le catalogue public (`GET /series`) : elle ne montre que les catégories visibles et ne permet ni tri ni filtre (fonctionnalité 10).
- La mise en ligne dépend d'actions que seul l'engineer peut faire (Render, DNS, variables de l'API) : ce jalon peut attendre ces étapes.
- La garde côté client ne protège rien seule : la sécurité repose sur l'API.

**Neutral**:
- `@mantine/form` rejoint les paquets Mantine, en version 9.7.1.
- La fonctionnalité 6 transformera le titre en lien vers la fiche et ajoutera « Nouvelle série ».

## Follow-up

- [ ] Fonctionnalité 6 : lien du titre vers la fiche, bouton « Nouvelle série ».
- [ ] Revoir le message `429` de la spec 0002 si la connexion du backend est un jour limitée en débit.
- [ ] `/sync` : noter dans `AGENTS.md` le dossier `src/features/` (`auth`, `series`) et la règle de protection des routes.
