# 0002. Client API, session et erreurs du dashboard

**Date**: 2026-10-08
**Status**: Accepted

## Summary

Tout le dashboard parle à l'API par un seul petit client écrit à la main autour de `fetch`. Ce client ajoute le token, le renouvelle quand il expire, vérifie la forme de chaque réponse avec Zod et transforme chaque erreur en message clair en français. La même brique gère la session de l'admin (connexion, déconnexion, reprise après rechargement, partage entre onglets) et l'attente quand l'API gratuite se réveille. Les écrans (page de connexion, protection des routes) appartiennent à la fonctionnalité 5 : ici, on fournit les outils qu'ils utiliseront.

## Requirements

**User stories**:
- En tant qu'admin, je veux rester connecté pendant que je travaille, même quand mon token d'accès expire, pour ne pas perdre ce que je suis en train de faire.
- En tant qu'admin, je veux des messages d'erreur clairs en français qui me disent quoi faire, pour ne pas devoir lire les réponses brutes de l'API.
- En tant qu'admin, je veux savoir que le serveur se réveille quand il est lent, pour ne pas croire que le dashboard est cassé.
- En tant que développeur d'une fonctionnalité, je veux une seule fonction pour appeler l'API, avec des réponses typées et vérifiées, pour ne pas réécrire tokens, erreurs et vérifications dans chaque écran.

**Acceptance criteria**:
- **AC-1**: Tout appel à l'API passe par `apiRequest` ; l'adresse vient de `VITE_API_BASE_URL` ; l'en tête `Authorization: Bearer <accessToken>` est ajouté à toute requête authentifiée.
- **AC-2**: Si `VITE_API_BASE_URL` est absente ou n'est pas une URL `http(s)` valide, l'application affiche un écran « Configuration invalide » qui nomme la variable, et n'appelle jamais l'API.
- **AC-3**: Une requête authentifiée qui reçoit `401` déclenche un seul appel `POST /auth/refresh`, puis est rejouée une fois avec le nouveau token. Plusieurs requêtes qui reçoivent `401` en même temps partagent ce même appel de renouvellement (un seul appel au total). Une requête partie avec un token déjà remplacé est rejouée directement avec le token actuel, sans nouveau renouvellement.
- **AC-4**: Dans une session active (`authenticated`), si le refresh token est refusé (`401` sur `/auth/refresh`) ou absent, les tokens sont effacés, les requêtes en cours sont annulées, le cache des données est vidé, la session passe à `anonymous` avec la raison `expired`, le message « Votre session a expiré, reconnectez vous. » est disponible pour l'écran de connexion, et les autres onglets sont aussi déconnectés.
- **AC-5**: Une requête authentifiée qui reçoit `403` **sans aucun** `code` dans le corps met fin à la session avec la raison `forbidden` et le message « Ce compte n'a plus accès au tableau de bord. ». Un `403` qui porte un `code` (par exemple `PREMIUM_REQUIRED`) est une erreur `http` ordinaire et ne met pas fin à la session.
- **AC-6**: `login(email, password)` appelle `POST /auth/login`. Pour un compte `admin` : le token d'accès est gardé en mémoire, le refresh token dans `sessionStorage` (clé `noli.admin.refreshToken`), la session passe à `authenticated` avec l'utilisateur. Pour un autre rôle : rien n'est stocké et l'erreur `not-admin` (« Ce compte n'a pas accès au tableau de bord. ») est levée. Mauvais identifiants : erreur « Email ou mot de passe incorrect. ».
- **AC-7**: Au chargement, si un refresh token est présent (dans `sessionStorage` ou reçu d'un autre onglet), la session est reprise sans nouvelle connexion (`POST /auth/refresh` puis `GET /auth/profile`, rôle `admin` vérifié). Tout échec de la reprise (refresh refusé, profil non admin, `403`, erreur réseau) efface les tokens et passe la session à `anonymous` **sans message** (jamais la raison `expired`). Tant que la reprise est en cours, le statut est `restoring`.
- **AC-8**: Un nouvel onglet sans refresh token dans son `sessionStorage` le demande aux autres onglets et l'obtient d'un onglet connecté (attente de 300 ms au plus), puis reprend la session selon AC-7. Une déconnexion dans un onglet déconnecte tous les onglets ouverts.
- **AC-9**: Quand au moins un appel `apiRequest` attend depuis plus de 5 secondes (renouvellement et nouvel essai compris), une notification « Le serveur se réveille, cela peut prendre jusqu'à une minute. » s'affiche, et disparaît quand plus aucun appel n'est lent. Chaque essai d'une requête JSON est abandonné après 70 secondes, d'un envoi de fichier après 120 secondes, avec l'erreur `timeout`.
- **AC-10**: Chaque erreur est traduite en message français selon la table « Messages d'erreur » ci dessous. Une erreur inconnue donne un message générique, et le texte d'origine du backend reste disponible dans un détail repliable.
- **AC-11**: Chaque réponse réussie est vérifiée par le schéma Zod fourni à l'appel. Une réponse qui ne correspond pas lève l'erreur `invalid-response` (« Réponse inattendue du serveur. ») et le détail du problème est écrit dans la console.
- **AC-12**: Les lectures (requêtes TanStack Query) sont relancées 2 fois au plus sur erreur réseau ou `5xx`, 1 fois au plus sur `timeout`, jamais sur un `4xx`, sur `session-ended`, `invalid-response` ou un abandon. Les modifications (mutations) ne sont jamais relancées automatiquement (`retry: 0`).
- **AC-13**: Trois aides d'affichage existent : `ErrorState` (message dans la page, bouton « Réessayer », détail repliable), `notifyError` (notification en coin d'écran pour une action), `applyFieldErrors` (place un message français court sous le bon champ d'un formulaire Mantine pour une erreur `400` ou `409`, et envoie le reste à `notifyError`, avec le texte du backend dans « Détails »).
- **AC-14**: `apiRequest` accepte un corps `FormData` (envoi de fichier) sans fixer lui même l'en tête `Content-Type`.
- **AC-15**: Les tokens n'apparaissent jamais dans une URL, dans la console ni dans un message d'erreur.

## Decision

**Chosen option**: Option 1 : client fait main autour de `fetch`, réponses vérifiées par Zod, session dans un petit store externe

Un module `src/shared/api/` expose `apiRequest` et les erreurs typées, un module `src/shared/session/` gère tokens, connexion et renouvellement, et des aides d'affichage dans `src/shared/ui/` montrent les erreurs en français.

**Implementation skills**: `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `mantine-form` (`mantinedev/skills`, `.agents/skills/mantine-form/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`)

## Rationale

Le raisonnement et les options comparées sont dans [rationale.md](rationale.md).

## Feature design

### Modules et frontières

| Module | Rôle |
|---|---|
| `src/shared/config/env.ts` | Lit et valide `import.meta.env` avec Zod, exporte `env` ou une erreur de configuration. |
| `src/shared/api/errors.ts` | Type `ApiError` (une sous classe d'`Error`, pour garder la pile d'appel ; exception assumée à « pas de classes »), discriminé par `kind`. Garde `isApiError`. |
| `src/shared/api/messages.ts` | `toUserMessage(error)` → `{ message, details? }` en français, fonction pure. |
| `src/shared/api/client.ts` | `apiRequest` : URL, en têtes, corps, délai, renouvellement, vérification Zod, conversion en `ApiError`. |
| `src/shared/api/slowRequests.ts` | Compte les requêtes en attente depuis plus de 5 s (petit store externe). |
| `src/shared/session/store.ts` | État de session (store externe lu par `useSyncExternalStore`) ; token d'accès en mémoire ; refresh token en `sessionStorage`. |
| `src/shared/session/session.ts` | `login`, `logout`, `restoreSession`, `refreshAccessToken` (un seul renouvellement à la fois), `endSession`. |
| `src/shared/session/tabs.ts` | Partage entre onglets par `BroadcastChannel('noli-admin-session')`. |
| `src/shared/session/useSession.ts` | Hook React qui expose l'état de session. |
| `src/shared/query/queryClient.ts` | `createQueryClient()` avec la règle de réessai (AC-12). |
| `src/shared/ui/ErrorState.tsx`, `notifyError.ts`, `applyFieldErrors.ts`, `SlowServerNotice.tsx`, `ConfigErrorScreen.tsx` | Aides d'affichage (AC-2, AC-9, AC-13). |

Les fonctionnalités appellent `apiRequest` depuis leurs propres hooks de données (`src/features/<feature>/api.ts`), avec leurs propres schémas Zod. Elles n'importent jamais `fetch` directement.

**Contrat avec la fonctionnalité 5** (connexion et protection des routes) : elle lit `useSession()`. Quand `status` vaut `anonymous` sur une route protégée, elle redirige vers `/connexion?retour=<chemin actuel encodé>` et affiche `endMessage` s'il existe. Après connexion, elle ne suit `retour` que s'il commence par `/` et pas par `//` (pas de redirection vers un autre site). Pendant `restoring`, elle affiche un chargement, pas la page de connexion.

### Data model sketch

Pas de base de données. L'état vit dans le navigateur :

| Élément | Où | Forme | Durée de vie |
|---|---|---|---|
| Token d'accès | mémoire du module `store.ts` | `string \| undefined` | jusqu'au rechargement de l'onglet |
| Refresh token | `sessionStorage['noli.admin.refreshToken']` | `string` | jusqu'à la fermeture de l'onglet, ou la déconnexion |
| État de session | store externe | `{ status: 'restoring' \| 'anonymous' \| 'authenticated', user?: AdminUser, endReason?: 'expired' \| 'forbidden' \| 'logout', endMessage?: string }` | onglet |
| `AdminUser` | dans l'état de session | `{ id: string, email: string, username: string, role: 'admin' }` | onglet |
| `ApiError` | levée par `apiRequest` | `kind: 'http' \| 'network' \| 'timeout' \| 'invalid-response' \| 'not-admin' \| 'session-ended' \| 'config'`, `status?: number`, `code?: string`, `backendMessage?: string \| string[]`, `body?: unknown`, `issues?: ZodIssue[]` | durée de l'erreur |
| Requêtes lentes | store externe `slowRequests.ts` | compteur entier ≥ 0 | onglet |

### State transitions

Session : `restoring` → `authenticated` (reprise réussie) · `restoring` → `anonymous` (pas de token ou reprise échouée) · `anonymous` → `authenticated` (`login`) · `authenticated` → `anonymous` (`logout`, refresh refusé, `403`, ou message `logout` d'un autre onglet). Au démarrage, l'état est toujours `restoring`.

### API surface

**Appels au backend** (tous via `apiRequest`) :

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/login` | POST | `email`, `password` | `accessToken`, `refreshToken`, `user { id, email, username, role }` | aucune | `401` mauvais identifiants, `400` |
| `/auth/refresh` | POST | `refreshToken` | `accessToken` | aucune | `401` refresh refusé |
| `/auth/profile` | GET | aucun | `user { _id, email, username, role }` | bearer | `401` |

**Fonctions exposées aux fonctionnalités** :

| Fonction | Entrées | Sortie | Erreurs |
|---|---|---|---|
| `apiRequest<T>(options)` | `method`, `path`, `schema: ZodType<T>`, `query?`, `body?` (objet JSON ou `FormData`), `auth?` (défaut `true`), `signal?` | `Promise<T>` (corps brut de la réponse, vérifié par `schema` ; chaque fonctionnalité lit la clé de l'enveloppe qui la concerne : `series`, `data`, `category`…) | `ApiError` |
| `login(email, password)` | identifiants | `Promise<AdminUser>` | `ApiError` (`http` 401, `not-admin`, `network`, `timeout`) |
| `logout()` | aucune | `void` (local seulement : le backend n'a pas de route de déconnexion) | aucune |
| `restoreSession()` | aucune | `Promise<void>` (appelé une fois au démarrage) | aucune (échec → `anonymous`) |
| `useSession()` | aucune | état de session | aucune |
| `toUserMessage(error)` | `unknown` | `{ message: string, details?: string }` | aucune |
| `createQueryClient()` | aucune | `QueryClient` | aucune |
| `notifyError(error)` / `<ErrorState error onRetry />` / `applyFieldErrors(form, error, fieldMap)` | l'erreur (et le formulaire, la correspondance champ → mot clé) | affichage | aucune |

### Messages d'erreur (AC-10)

| Cas | Message affiché |
|---|---|
| `network` (pas de réponse) | Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez. |
| `timeout` | Le serveur ne répond pas. Réessayez dans un instant. |
| `400` | Certaines informations sont invalides. (le détail du backend dans « Détails ») |
| `401` sur une requête non authentifiée (connexion) | Email ou mot de passe incorrect. |
| `not-admin`, `403` à la connexion | Ce compte n'a pas accès au tableau de bord. |
| `session-ended` raison `expired` | Votre session a expiré, reconnectez vous. |
| `session-ended` raison `forbidden` | Ce compte n'a plus accès au tableau de bord. |
| `404` | Élément introuvable. Il a peut être été supprimé. |
| `409` code `CATEGORY_IN_USE` | Cette catégorie est encore utilisée par {seriesCount} série(s). Retirez la de ces séries d'abord. |
| `409` sans code | Cet élément existe déjà (nom ou titre déjà pris). |
| `413` | Fichier trop lourd : 5 Mo au plus. |
| `415` | Format non accepté : JPEG, PNG ou WebP. |
| `429` | Trop de demandes : 10 envois d'images toutes les 10 minutes au plus. Réessayez dans quelques minutes. |
| `503` code `PUSH_UNAVAILABLE` | Les notifications ne sont pas configurées sur le serveur. |
| `503` sans code | Service momentanément indisponible. |
| autre `5xx` | Erreur du serveur. Réessayez dans un instant. |
| `invalid-response` | Réponse inattendue du serveur. |
| tout le reste | Une erreur inattendue est survenue. (le détail du backend dans « Détails ») |

Une fonctionnalité peut remplacer un message pour son contexte (par exemple un `404` précis) en passant ses propres textes à `toUserMessage` ; la table reste la valeur par défaut.

### Comportement de `apiRequest`

1. Construit l'URL : `env.VITE_API_BASE_URL` + `path` + `query` encodée. Les valeurs de `query` sont limitées à `string`, `number` et `boolean` ; les `undefined` sont omises.
2. En têtes : `Accept: application/json` ; `Content-Type: application/json` seulement pour un corps objet ; aucun `Content-Type` pour `FormData` (AC-14) ; `Authorization` si `auth` vaut `true` et qu'un token d'accès existe. Le client retient le token envoyé pour cet essai.
3. Délai, par essai : un `AbortController` propre au client, déclenché par un `setTimeout` de 70 s (120 s pour `FormData`), et relié à la main au `signal` de l'appelant et au signal de session (point 6 des règles). Pas d'`AbortSignal.timeout` ni d'`AbortSignal.any` (testabilité avec de faux minuteurs, navigateurs plus anciens). Un abandon venant de l'appelant ou de la session est relancé tel quel (`AbortError`), sans message ; un abandon par le délai devient `timeout`.
4. Compteur lent : un seul emplacement par appel `apiRequest`, pris par un minuteur de 5 s si l'appel attend encore, rendu dans un `finally` ; il couvre le renouvellement et le nouvel essai.
5. Si `auth` vaut `true` et la réponse est `401` :
   - si le token d'accès actuel diffère de celui envoyé (un autre appel l'a déjà renouvelé), rejouer une fois avec le token actuel ;
   - sinon `refreshAccessToken()` (promesse partagée tant qu'elle est en cours), puis un seul nouvel essai ;
   - si le renouvellement échoue ou s'il n'y a pas de refresh token : `endSession('expired')` (sauf si la session n'est déjà plus `authenticated`), puis `ApiError` `session-ended`.
6. Si `auth` vaut `true` et la réponse est `403` sans aucun `code` : `endSession('forbidden')`, puis `ApiError` `session-ended`.
7. Autre statut non `2xx` : `ApiError` `http` avec `status`, `code`, `backendMessage` et `body`. Si le corps n'est pas du JSON (page HTML d'un `502` ou `503` de Render pendant le réveil, texte brut), il est gardé en texte, sans erreur de lecture, et `code` reste `undefined`.
8. `2xx` : corps JSON vérifié par `schema.safeParse`. Un corps vide (`204`) donne `undefined`, accepté seulement si le schéma l'accepte. Un corps `2xx` qui n'est pas du JSON, ou un échec de vérification : `console.error` des seuls `path` et `code` des problèmes Zod (jamais les données reçues), puis `ApiError` `invalid-response`.
9. `fetch` qui échoue sans réponse : `ApiError` `network`.

### Règles de session et d'onglets

1. **Pas de dépendance circulaire** : `client.ts` ne connaît pas `session.ts`. `session.ts` enregistre auprès du client, au chargement du module, deux fonctions : `refresh()` (renvoie le nouveau token ou échoue) et `onSessionEnd(reason)`. `/auth/login` et `/auth/refresh` sont appelés avec `auth: false` : un `401` sur eux ne déclenche jamais de renouvellement. Pendant la reprise, `GET /auth/profile` est appelé avec le token tout juste obtenu.
2. **Reprise silencieuse** : `restoreSession` utilise son propre chemin. Un échec (refresh refusé, profil non `admin`, `403`, réseau, `timeout`) efface les tokens et donne `anonymous` sans `endReason` ni `endMessage`. Seule une session `authenticated` peut finir en `expired` ou `forbidden`.
3. **Un seul démarrage** : `restoreSession()` est appelé une fois depuis `main.tsx`, hors de React, avant le premier rendu ; il mémorise sa promesse, un second appel ne fait rien (pas de double exécution en mode StrictMode).
4. **Attente entre onglets** : seulement si `sessionStorage` ne contient pas de refresh token. Le nouvel onglet envoie `request`, attend 300 ms au plus, et passe à `anonymous` sans réponse.
5. **Protocole `BroadcastChannel('noli-admin-session')`**, trois messages :
   - `{ type: 'request' }` : seul un onglet `authenticated` répond.
   - `{ type: 'share', refreshToken }` : accepté seulement par un onglet en `restoring` qui attend ; le premier reçu gagne, les suivants sont ignorés. L'onglet l'écrit dans son `sessionStorage` puis reprend selon AC-7.
   - `{ type: 'logout' }` : envoyé par `logout()` et par `endSession` ; un onglet qui le reçoit met fin à sa session (raison `logout`, sans message) **sans le rediffuser**. Reçu pendant `restoring`, il annule la reprise.
   - `login()` ne diffuse rien. Un onglet ne reçoit pas ses propres messages (comportement normal de `BroadcastChannel`).
6. **Fin de session** (`logout` ou `endSession`) : efface les deux tokens, annule les requêtes en cours via un `AbortController` de session (remplacé à chaque nouvelle session), vide le cache TanStack Query (`queryClient.clear()`, le `QueryClient` étant enregistré auprès de la session par `providers.tsx`), puis fixe l'état. La première raison gagne : un `401` arrivé après un `logout` ne remplace pas `logout` par `expired`.
7. **Onglets simultanés** : deux onglets qui reprennent en même temps, ou un onglet dupliqué (qui copie `sessionStorage`), renouvellent chacun leur token d'accès sans conflit, puisque le refresh token n'est jamais remplacé par le backend. Aucun verrou n'est nécessaire.
8. **État de module assumé** : le token d'accès, la promesse de renouvellement en cours, le compteur de requêtes lentes, l'état de session et le canal d'onglets sont des petits stores de module (un objet contrôlé par module, modifié seulement par ses fonctions). C'est une exception assumée à la règle « pas d'état mutable partagé » de `AGENTS.md`, limitée à `src/shared/api/` et `src/shared/session/`.

### Règles d'affichage des erreurs

- **`toUserMessage(error, overrides?)`** : `overrides` est un `Partial<Record<string, string>>` dont les clés sont un `code` (`'CATEGORY_IN_USE'`) ou un statut (`'404'`) ; le `code` est cherché avant le statut, puis la table par défaut. Pour une valeur qui n'est pas une `ApiError` (`TypeError`, `ZodError`, `AbortError`…), il renvoie « Une erreur inattendue est survenue. » **sans détail** (jamais `error.message`, qui pourrait contenir une donnée sensible). Si `seriesCount` manque ou n'est pas un nombre dans un `409` `CATEGORY_IN_USE` : « Cette catégorie est encore utilisée par des séries. Retirez la de ces séries d'abord. ».
- **`applyFieldErrors(form, error, fieldMap)`** : `fieldMap` est un `Record<string, string>` (nom du champ du formulaire → mot clé du backend, par exemple `{ title: 'title' }`). Pour un `400`, chaque phrase de `backendMessage` est associée au premier champ dont le mot clé apparaît dans la phrase (sans tenir compte des majuscules ; les phrases de validation NestJS commencent par le nom de la propriété) ; le champ reçoit « Valeur invalide. ». Pour un `409` sans `code`, le champ indiqué par `fieldMap` reçoit « Déjà utilisé. ». Les phrases sans champ, et toute autre erreur, partent dans `notifyError`, avec le texte du backend dans « Détails ». La fonction renvoie `true` si au moins un champ a reçu une erreur.
- **`notifyError(error, overrides?)`** : notification rouge Mantine avec le message de `toUserMessage` et, s'il existe, le détail repliable.
- **Réessais (AC-12)** : `createQueryClient` fixe pour les lectures `retry: (count, error) => …` selon la règle d'AC-12 et garde le délai par défaut de TanStack Query entre deux essais ; pour les mutations, `retry: 0` explicitement.

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| `apiRequest` | adresse de l'API | `VITE_API_BASE_URL`, validée au démarrage (AC-1, AC-2) |
| `apiRequest` | token d'accès envoyé | store de session en mémoire, rempli par `login`, `refreshAccessToken` ou `restoreSession` |
| `refreshAccessToken` | refresh token envoyé | `sessionStorage['noli.admin.refreshToken']` (rempli par `login` ou par le partage entre onglets) |
| `login` | rôle admin ou non | `user.role` de la réponse `POST /auth/login` |
| `restoreSession` | utilisateur courant et rôle | `user` de `GET /auth/profile` (l'identifiant est sous `_id`, converti en `id`) |
| `endSession` | raison et message de fin | la cause : `401` sur refresh → `expired`, `403` sans code → `forbidden`, `logout()` → `logout` (aucun message) ; messages de la table AC-10 |
| `toUserMessage` | message français | `kind`, `status` et `code` de l'`ApiError`, via la table AC-10 |
| `toUserMessage` | nombre de séries dans le message `CATEGORY_IN_USE` | champ `seriesCount` du corps `409` |
| `toUserMessage` | détail repliable | `backendMessage` (texte ou tableau de textes du backend) |
| `applyFieldErrors` | champ concerné | correspondance `fieldMap` fournie par le formulaire (mot clé du message backend → nom du champ) ; sans correspondance, l'erreur va dans `notifyError` |
| Notification de réveil | affichée ou non | compteur `slowRequests` > 0 (seuil 5 s, décidé ici) |
| Délai d'abandon | 70 s ou 120 s | type de corps : `FormData` → 120 s, sinon 70 s (décidé ici) |
| Partage entre onglets | refresh token d'un autre onglet | message `share` sur `BroadcastChannel('noli-admin-session')`, attendu 300 ms après un message `request` |
| Réessai d'une lecture | relancer ou non | `kind` (`network`, `timeout`) ou `status` ≥ 500, et nombre d'essais < 2 (AC-12) |

### Key invariants

- Un seul renouvellement de token en cours à la fois par onglet ; une requête n'est rejouée qu'une fois.
- Le refresh token n'est jamais écrit dans `localStorage`, une URL, la console ou un message d'erreur ; le token d'accès jamais sur disque. La console ne reçoit jamais un corps de requête ou de réponse (ils peuvent contenir un token ou un email).
- Après une fin de session, aucune donnée de la session précédente ne reste dans le cache.
- Un utilisateur non admin n'a jamais de token stocké.
- Toute erreur levée par `apiRequest` est une `ApiError` (sauf un abandon demandé par l'appelant).
- Aucune fonctionnalité n'appelle `fetch` directement (à vérifier en revue de code).

### Security model

- Seul un compte `role === 'admin'` obtient une session ; le backend reste juge (il relit le rôle à chaque requête et répond `403`).
- Le refresh token est partagé seulement avec les onglets de la même origine (`BroadcastChannel` est limité à l'origine) et seulement par un onglet connecté.
- La déconnexion est locale : le backend n'a pas de route pour révoquer un refresh token (conséquence acceptée dans la spec 0001).
- Aucune donnée réglementée ; les emails des admins sont des données personnelles, jamais écrites dans la console.

### Configuration required

- `VITE_API_BASE_URL` : adresse de l'API (déjà prévue par la spec 0001), maintenant validée au démarrage.
- Nouvelles dépendances : `zod` (version 4) et `@mantine/notifications`.

### Critical test scenarios

- Happy path : `login` d'un admin, puis une lecture authentifiée qui renvoie une réponse valide, vérifie **AC-1**, **AC-6**, **AC-11**.
- Renouvellement : trois lectures reçoivent `401` en même temps, un seul `POST /auth/refresh`, les trois réussissent au second essai ; une quatrième partie avec l'ancien token et revenue en `401` après le renouvellement est rejouée sans nouveau refresh, vérifie **AC-3**.
- Refresh refusé : `401` puis `401` sur refresh, session `anonymous` raison `expired`, tokens effacés, requêtes en cours annulées, cache vidé, message `logout` diffusé, vérifie **AC-4**, **AC-8**.
- Non admin : `login` d'un compte `user`, `sessionStorage` vide, erreur `not-admin`, vérifie **AC-6**.
- Rôle retiré : `403` sans code en pleine session, raison `forbidden` ; `403` avec `code: 'PREMIUM_REQUIRED'`, session intacte, vérifie **AC-5**.
- Reprise : refresh token en `sessionStorage`, statut `restoring` puis `authenticated` après refresh et profil ; refresh refusé pendant la reprise, `anonymous` sans message ; profil `role: 'user'`, `anonymous` et tokens effacés, vérifie **AC-7**.
- Onglets : un onglet connecté répond à `request`, le nouvel onglet reprend ; deux `share` reçus, un seul utilisé ; `logout` reçu, pas rediffusé ; aucun onglet ne répond, `anonymous` après 300 ms, vérifie **AC-8**.
- Lenteur : réponse retardée de 6 s (faux minuteurs), notification visible puis cachée ; réponse jamais arrivée, `timeout` à 70 s ; réponse HTML `503`, erreur `http` sans plantage, vérifie **AC-9**, **AC-10**.
- Messages : chaque ligne de la table donne le bon texte, vérifie **AC-10**.
- Réponse invalide : corps qui ne correspond pas au schéma, `invalid-response`, vérifie **AC-11**.
- Réessais : lecture en `500` relancée 2 fois, `timeout` relancé 1 fois, `404` et `session-ended` jamais, mutation jamais, vérifie **AC-12**.
- Champs : `400` avec `["title must be shorter than 120 characters"]` et `fieldMap { title: 'title' }`, « Valeur invalide. » sous `title` ; phrase sans champ, notification, vérifie **AC-13**.
- Envoi de fichier : `FormData` sans `Content-Type` fixé à la main, vérifie **AC-14**.
- Configuration : `VITE_API_BASE_URL` absente, écran de configuration, aucune requête, vérifie **AC-2**.

## Build plan

Ordonné en Tracer Bullet : d'abord un fil complet et mince (configuration, un appel, une erreur, une vérification Zod, testé de bout en bout avec MSW), puis on l'épaissit.

1. Installer `zod` (v4) et `@mantine/notifications` ; ajouter le `Notifications` de Mantine et ses styles aux fournisseurs, satisfies **AC-9**, **AC-13**
2. `env.ts` : validation Zod de `VITE_API_BASE_URL` ; `main.tsx` affiche `ConfigErrorScreen` si invalide, satisfies **AC-2**
3. `errors.ts` : `ApiError` et `isApiError`, satisfies **AC-10**, **AC-15**
4. `client.ts`, fil mince : URL, en têtes JSON, `fetch`, conversion `network` / `http`, vérification Zod `invalid-response` ; tests MSW, satisfies **AC-1**, **AC-11**
5. `messages.ts` : `toUserMessage` et la table complète ; tests par ligne, satisfies **AC-10**
6. `store.ts` et `session.ts` : tokens, `login` (contrôle du rôle, `auth: false`), `logout`, `useSession`, enregistrement de `refresh` et `onSessionEnd` auprès du client, satisfies **AC-6**, **AC-15**
7. `client.ts` : `Authorization`, `401` → rejeu direct si le token a changé, sinon `refreshAccessToken` partagé et un seul nouvel essai, `endSession('expired')` ; fin de session : abandon des requêtes en cours, `queryClient.clear()`, première raison gagnante, satisfies **AC-1**, **AC-3**, **AC-4**
8. `client.ts` : `403` sans aucun `code` → `endSession('forbidden')`, satisfies **AC-5**
9. `restoreSession` (refresh puis profil, chemin silencieux) appelé une fois depuis `main.tsx`, statut `restoring`, satisfies **AC-7**
10. `tabs.ts` : protocole `request` / `share` / `logout` selon les règles d'onglets, satisfies **AC-4**, **AC-8**
11. Délais par essai (70 s, 120 s) avec `setTimeout` et `AbortController`, abandon par l'appelant, corps non JSON, `slowRequests` et `SlowServerNotice`, satisfies **AC-9**, **AC-10**
12. Corps `FormData`, satisfies **AC-14**
13. `createQueryClient` avec la règle de réessai, branché dans `providers.tsx`, satisfies **AC-12**
14. `ErrorState`, `notifyError`, `applyFieldErrors`, satisfies **AC-13**

## Consequences

**Positive**:
- Une seule porte vers l'API : tokens, erreurs et vérifications sont écrits une fois.
- Une réponse inattendue du backend se voit tout de suite, avec un message clair, au lieu d'un écran cassé plus loin.
- Les admins gardent leur session en rechargeant la page ou en ouvrant un onglet, sans que le refresh token soit écrit dans `localStorage`.

**Negative / tradeoffs**:
- Chaque fonctionnalité doit écrire le schéma Zod de ses réponses à la main (le contrat OpenAPI du backend ne les décrit presque pas), et les tenir à jour quand le backend change.
- La table des messages doit suivre les nouveaux codes d'erreur du backend ; un code oublié tombe sur le message générique.
- Le partage entre onglets ajoute une petite attente (300 ms au plus) à l'ouverture d'un onglet sans session.
- La déconnexion ne révoque rien côté serveur : un refresh token copié reste valable jusqu'à 30 jours.
- Les petits stores de module de `src/shared/api/` et `src/shared/session/` sont une exception à la règle « pas d'état mutable partagé » ; `/sync` devrait la noter dans un `AGENTS.md` de `src/shared/`.
- `ApiError` est une classe, entorse assumée au style fonctionnel, pour garder la pile d'appel des erreurs.

**Neutral**:
- La fonctionnalité 5 consomme `useSession()` et le contrat de redirection décrit plus haut.
- Si le backend complète un jour ses schémas OpenAPI, une génération de types pourra compléter les schémas Zod, sans changer `apiRequest`.

## Follow-up

- [ ] Fonctionnalité 5 : page `/connexion`, protection des routes et lecture de `retour`, selon le contrat ci dessus.
- [ ] Backend (facultatif) : compléter les schémas de réponse de `openapi.json` (8 routes sur 71 décrites), ce qui permettrait de vérifier les schémas Zod contre le contrat.
- [ ] Backend (facultatif) : exposer `Retry-After` en CORS si un compte à rebours précis devient utile pour le `429`.
