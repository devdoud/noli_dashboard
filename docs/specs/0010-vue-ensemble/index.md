# 0010. Vue d'ensemble : chiffres de l'accueil et vidéos à traiter

**Date**: 2026-10-16
**Status**: In Progress

## Summary

La page d'accueil du dashboard montre trois chiffres : le nombre de séries, le nombre d'épisodes et le nombre d'épisodes dont la vidéo n'est pas encore « Prête » (avec le détail par état). Chaque chiffre mène à la liste des séries ; le dernier l'ouvre filtrée sur les séries qui ont des vidéos à traiter, grâce à un nouveau filtre « Vidéos » dans la barre de filtres. Les chiffres viennent d'une nouvelle route admin du backend, `GET /series/admin/stats`, qui compte tout en une requête ; le backend est donc modifié d'abord, puis le dashboard.

## Requirements

**User stories**:
- En tant qu'admin, je veux voir dès l'accueil combien de séries et d'épisodes le catalogue contient.
- En tant qu'admin, je veux savoir combien de vidéos d'épisodes restent à traiter, et de quel genre (sans vidéo, en erreur, en cours, ancien lien), pour savoir quel travail m'attend.
- En tant qu'admin, je veux aller en un clic aux séries qui ont des vidéos à traiter, et voir combien chacune en a.

**Acceptance criteria** (le contrat):
- **AC-1**: La page d'accueil `/` (titre « Vue d'ensemble ») montre trois tuiles dans cet ordre : « Séries » (nombre total de séries), « Épisodes » (nombre total d'épisodes, toutes séries confondues), « Vidéos à traiter » (nombre d'épisodes dont la vidéo n'est pas « Prête »). Les nombres viennent de `GET /series/admin/stats` et s'écrivent à la française (`1 234`). Les tuiles sont sur une colonne sur téléphone, trois colonnes à partir de la largeur `sm`, sans défilement horizontal.
- **AC-2**: « Vidéos à traiter » compte chaque épisode dont l'état vidéo (le même que dans la fiche, spec 0006) vaut `none`, `error`, `pending` ou `legacy`. Sous le nombre, une ligne de détail liste les états non nuls, dans cet ordre : « 2 sans vidéo · 1 en erreur · 3 en cours · 4 anciens liens » (au singulier « 1 ancien lien »). Un état à 0 n'apparaît pas.
- **AC-3**: Les tuiles « Séries » et « Épisodes » sont des liens vers `/series`. La tuile « Vidéos à traiter » est un lien vers `/series?videos=a-traiter`. Quand ce nombre vaut 0, la tuile affiche « 0 » et « Tout est prêt » à la place de la ligne de détail, et n'est pas un lien.
- **AC-4**: La barre de filtres de `/series` (spec 0009) gagne un filtre « Vidéos » (choix segmenté « Toutes », « À traiter », « Toutes » par défaut), placé après « Accès ». « À traiter » ne garde que les séries qui ont au moins un épisode dont la vidéo n'est pas « Prête » (une série sans épisode n'en fait pas partie). Il se combine aux autres filtres, vit dans l'adresse sous `videos=a-traiter` (ordre `q`, `categorie`, `acces`, `videos`, `page`), suit les règles d'historique, de retour à la page 1, de compte « N séries trouvées » et de « Effacer les filtres » de la spec 0009 (AC-3, AC-4, AC-6, AC-7). Une autre valeur de `videos` dans l'adresse est retirée sans nouvelle entrée d'historique (comme la spec 0009, AC-5).
- **AC-5**: Quand le filtre « À traiter » est actif, chaque ligne de série montre, sous son titre, le nombre de ses épisodes dont la vidéo n'est pas « Prête » : « 1 vidéo à traiter », « 3 vidéos à traiter ». Sans ce filtre, les lignes ne changent pas.
- **AC-6**: Fraîcheur : les chiffres sont redemandés à chaque arrivée sur l'accueil et quand l'onglet reprend le focus. Toute modification se fait sur une autre page (fiche, catégories), donc revenir à l'accueil après une modification montre toujours des chiffres à jour. Pas de rafraîchissement automatique à intervalle régulier : une vidéo traitée par l'hébergeur pendant que l'admin reste sur l'accueil n'apparaît qu'au retour sur l'onglet ou à la visite suivante.
- **AC-7**: États : pendant le premier chargement, trois tuiles squelettes (zone `aria-busy`) ; en cas d'erreur, l'état d'erreur partagé (`ErrorState`) avec « Réessayer » remplace les tuiles ; la notification de lenteur au réveil de l'API (spec 0002) s'applique comme ailleurs. Un compte non admin n'arrive jamais ici (spec 0004).
- **AC-8**: Accessibilité : la page a un titre de niveau 1 « Vue d'ensemble », chaque tuile un titre de niveau 2 ; chaque tuile lien a un nom accessible qui dit le nombre et la destination (« 48 séries, voir la liste des séries », « 7 vidéos à traiter, voir les séries concernées ») ; la tuile à zéro, qui n'est pas un lien, se lit « 0 vidéo à traiter, tout est prêt » (singulier à 0 et à 1) ; focus visible sur toute la tuile ; tout marche au clavier ; contrastes AA (spec 0003). Le filtre « Vidéos » a un libellé visible et le compte de la ligne est du texte, pas seulement une couleur.
- **AC-9**: Les trois cartes provisoires actuelles de l'accueil (« Séries et épisodes », « Images », « Catégories ») et leur description sont retirées ; la page ne garde que son titre et les tuiles de chiffres.
- **AC-10**: Prérequis backend : `GET /series/admin/stats` existe, réservée aux admins, et ses comptes sont toujours égaux à ce que donnerait `adminVideoStatus` épisode par épisode ; `GET /series/admin` accepte `video=todo` et renvoie alors `videosToProcess` pour chaque série ; `GET /series`, `GET /series/search` et les autres routes publiques ne changent pas ; le tout est testé.
- **AC-11**: La fonctionnalité est en ligne (API puis dashboard). L'engineer contrôle en production, sans rien enregistrer, les trois chiffres, le lien vers la liste filtrée et le compte affiché dans les lignes. Les essais réels se font sur l'API locale branchée sur la base `noli_dev`.

## Decision

**Chosen option**: compter côté backend par une route admin dédiée, `GET /series/admin/stats`, et mener aux séries concernées par un nouveau filtre de la route `GET /series/admin` existante.

Le dashboard ne compte rien lui même : il affiche ce que la route renvoie, et réutilise la liste des séries filtrée (spec 0009) comme « liste concernée » au lieu de créer une page d'épisodes.

**Implementation skills**: `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`)

## Rationale

Raisonnement et options : voir [rationale.md](rationale.md).

## Feature design

### Prérequis backend (`noli-backend`)

**Règle commune « vidéo à traiter »** : un épisode est à traiter quand son état `adminVideoStatus` (fichier `src/series/content-access.ts`) n'est pas `ready`, c'est à dire quand `streamUid` est absent, `null` ou vide. Le détail suit exactement l'ordre de `adminVideoStatus` : `streamUid` présent → `ready` ; sinon `pendingStatus === 'error'` → `error` ; sinon `pendingStreamUid` présent → `pending` ; sinon `videoUrl` présent → `legacy` ; sinon `none`. « Présent » veut dire ni absent, ni `null`, ni chaîne vide, côté JavaScript comme côté MongoDB. Les expressions MongoDB de cette règle vivent dans un seul module (`src/series/video-status-query.ts`) à côté de `adminVideoStatus`, utilisé par les deux routes ci dessous :
- `present(path)` = `{ $ne: [{ $ifNull: [path, ''] }, ''] }` (vrai seulement pour une valeur ni absente, ni `null`, ni vide) ;
- `videoStatusSwitch(e)` = `$switch` dont les branches sont, dans cet ordre : `present(e.streamUid)` → `'ready'` ; `{ $eq: [e.pendingStatus, 'error'] }` → `'error'` ; `present(e.pendingStreamUid)` → `'pending'` ; `present(e.videoUrl)` → `'legacy'` ; `default: 'none'` ;
- `notReady(e)` = `{ $not: [present(e.streamUid)] }` ;
- `notReadyMatch` (filtre de requête, pas une expression) = `{ $elemMatch: { $or: [{ streamUid: null }, { streamUid: '' }] } }` (`null` couvre aussi le champ absent).

- **`GET /series/admin/stats`** :
  - déclarée dans `SeriesController` à côté de `@Get('admin')` (avant `@Get(':id')` par cohérence), avec ses propres `@UseGuards(JwtAuthGuard)` et `@ApiBearerAuth('JWT-auth')` (la garde est posée route par route), puis `assertAdmin` (`403` sinon) ;
  - `series` = `countDocuments({})` ;
  - les autres comptes viennent d'une agrégation sur toute la collection : `{ $unwind: { path: '$episodes', preserveNullAndEmptyArrays: false } }` (une série sans épisode ou sans champ `episodes` disparaît, donc compte 0), `{ $project: { status: videoStatusSwitch('$episodes') } }`, puis un `$group` unique (`_id: null`) avec `episodes: { $sum: 1 }` et, pour chaque état `none`, `error`, `pending`, `legacy`, `{ $sum: { $cond: [{ $eq: ['$status', '<état>'] }, 1, 0] } }` ; `total` = la somme des quatre ; aucun résultat (aucun épisode) → tout à 0 ;
  - réponse : `{ message: 'Series stats retrieved', data: { series, episodes, videosToProcess: { total, none, error, pending, legacy } } }`, tous des entiers ≥ 0.
- **`GET /series/admin`, filtre `video`** :
  - `SeriesAdminQueryDto` gagne `video?: 'todo'` (`@IsIn(['todo'])`, `400` sinon) ;
  - `video=todo` ajoute la clé `filter.episodes = notReadyMatch` au même objet de filtre que `q`, `categoryId` et `premium` (aucune autre partie de `listForAdmin` ne touche `filter.episodes`) ; `countDocuments(filter)` l'utilise donc aussi pour `total` ;
  - le tri et la pagination ne changent pas.
- **`GET /series/admin`, champ `videosToProcess`** : renvoyé **seulement quand `video=todo`** (absent sinon : la réponse sans ce filtre ne change pas). Après le `find` (qui garde `.select('-episodes')`), une agrégation sur les identifiants de la page (`$match: { _id: { $in: ids } }`, les `_id` des lignes `.lean()` étant déjà des `ObjectId`, puis `$project: { videosToProcess: { $size: { $filter: { input: { $ifNull: ['$episodes', []] }, as: 'e', cond: notReady('$$e') } } } }`) donne le compte de chaque série, ajouté à la ligne avant `toAdminSeries` (qui le garde, la ligne étant recopiée). Les épisodes eux mêmes ne sont toujours pas renvoyés.
- **Inchangé** : `GET /series`, `GET /series/search`, `GET /series/:id`, `GET /series/:id/admin` et toutes les routes publiques.
- **Tests backend** :
  - table de parité : pour une série d'épisodes couvrant chaque cas (`streamUid` seul ; `streamUid` avec `pendingStatus: 'error'` ; `pendingStatus: 'error'` sans `streamUid` ; `pendingStreamUid` seul ; `videoUrl` seul ; `videoUrl` avec `pendingStreamUid` ; rien ; chaînes vides), les comptes de `stats` égalent ceux obtenus en appliquant `adminVideoStatus` à chaque épisode ;
  - aucune série, et séries sans épisode → comptes à 0 ;
  - `video=todo` garde une série avec un seul épisode à traiter, écarte une série dont tous les épisodes sont prêts et une série sans épisode, et se combine avec `q`, `categoryId`, `premium` ;
  - avec `video=todo`, chaque ligne a `videosToProcess ≥ 1` ; sans ce filtre, le champ est absent ;
  - sur un jeu de données fixe, la somme des `videosToProcess` des séries filtrées égale `videosToProcess.total` des stats ;
  - `video=autre` → `400` ; `401` sans jeton et `403` pour un non admin, sur les deux routes.

### Dashboard

- **Menu** : l'entrée « Vue d'ensemble » (`navItems.ts`) mène déjà à `/` ; rien à ajouter.
- **Nouvelle fonctionnalité `src/features/overview/`** : `OverviewPage.tsx` (la page), `StatTile.tsx` (une tuile), `api.ts` (schéma et hook), `overviewFormat.ts` (fonctions pures de texte), tests à côté. Elle n'importe pas `src/features/series/` : le lien vers la liste filtrée est une adresse écrite en dur (`/series?videos=a-traiter`), vérifiée par un test d'intégration qui suit le lien.
- **Routeur** : la route index de `src/app/routes.tsx` affiche `OverviewPage` ; `src/app/HomePage.tsx` est supprimé (AC-9).
- **Données** (`src/features/overview/api.ts`) :
  - `seriesStatsSchema` (Zod) : `{ series, episodes, videosToProcess: { total, none, error, pending, legacy } }`, chacun `z.number().int().nonnegative()` ;
  - `useSeriesStats()` : `useQuery` sur `GET /series/admin/stats` par `apiRequest`, clé `seriesStatsKey`, `refetchOnMount: 'always'` (redemandé à chaque arrivée sur l'accueil, AC-6), `staleTime` et `refetchOnWindowFocus` laissés aux valeurs du client partagé (`staleTime` 0, rechargement au retour sur l'onglet), pas de `refetchInterval` ; règles de réessai par défaut du client partagé.
- **Clé de cache partagée** (`src/shared/api/seriesKeys.ts`) : `seriesStatsKey = [...seriesListsKey, 'stats']`. Rangée sous le préfixe des listes, elle est invalidée par chaque `invalidateQueries({ queryKey: seriesListsKey })` déjà présent (séries, épisodes, vidéos, envois en arrière plan, catégories), sans toucher ces appels (AC-6). Le commentaire du module le dit. Elle ne peut pas entrer en collision avec `seriesKeys.list(page, filters)`, dont le troisième élément est toujours un nombre.
- **Textes** (`overviewFormat.ts`, fonctions pures) :
  - `formatCount(n)` : `Intl.NumberFormat('fr-FR')` ;
  - `videoDetailText(counts)` : « 2 sans vidéo · 1 en erreur · 3 en cours · 4 anciens liens », états à 0 omis, « 1 ancien lien » au singulier ;
  - `tileLabel` : noms accessibles de l'AC-8, au singulier pour 0 et 1 (« 1 série, voir la liste des séries », « 1 vidéo à traiter, voir les séries concernées », « 0 vidéo à traiter, tout est prêt » pour la tuile sans lien).
- **Tuile** (`StatTile`) : `Paper` avec bordure, icône décorative (`aria-hidden`), titre de niveau 2, nombre en grand, ligne secondaire facultative. Avec `to`, toute la tuile est un lien React Router (`component={Link}`) avec le nom accessible donné ; sans `to`, simple bloc (`role="group"`) qui porte le même genre de nom accessible. Grille `SimpleGrid` `{ base: 1, sm: 3 }`. Pendant le chargement, trois `Skeleton` de même taille dans une zone `aria-busy="true"` ; en erreur, `ErrorState` avec réessai (`refetch`).
- **Filtre « Vidéos »** (`src/features/series/`) :
  - `filters.ts` : nouveau type `SeriesVideos = 'a-traiter'` ; `SeriesFilters` gagne `videos?: SeriesVideos` ; `parseFilters` lit `videos` et ne le garde que s'il vaut `a-traiter` ; `makeFilters` (ordre `q`, `categoryId`, `access`, `videos`), `withFilters` (ordre `q`, `categorie`, `acces`, `videos`, `page`), `hasFilters` et `toApiQuery` en tiennent compte ; `SeriesApiQuery` gagne `video?: 'todo'`, présent seulement quand `videos` vaut `a-traiter` ; la règle de l'AC-5 de la spec 0009 (retirer une valeur invalide sans nouvelle entrée) couvre `videos` ; « Effacer les filtres » le retire avec les autres ; l'état « aucun résultat avec des filtres » de la spec 0009 (AC-7) s'applique tel quel ;
  - `SeriesFiltersBar` : `SegmentedControl` « Vidéos » (« Toutes », « À traiter ») après « Accès », avec libellé visible et même traitement du clavier, du focus, de l'historique et du retour à la page 1 que « Accès » ;
  - `schemas.ts` : un schéma de ligne de liste à part, `seriesListRowSchema = seriesSummarySchema.extend({ videosToProcess: z.number().int().nonnegative().optional() })`, utilisé seulement par `seriesPageSchema` (type `SeriesListRow`) ; `seriesSummarySchema` et `adminSeriesSchema` (fiche, création, modification) ne changent pas. Le champ facultatif évite de casser la liste si le dashboard est en ligne avant l'API ;
  - cellule du titre (`SeriesCells`) : quand le filtre est actif et que la ligne porte `videosToProcess`, texte secondaire sous le titre « 1 vidéo à traiter », « 3 vidéos à traiter » (AC-5) ; champ absent → rien ;
  - à mettre à jour : les données simulées des lignes et le gestionnaire MSW de `GET /series/admin` (filtre `video`) dans `src/test/`, `schemas.test.ts`, `filters.test.ts`, `SeriesListFilters.test.tsx`, et la vitrine `DevComponentsPage` si elle utilise les filtres.

**Data model sketch**: aucun changement de schéma ni migration. Tout se calcule à la lecture à partir des champs existants de l'épisode intégré à la série : `streamUid`, `pendingStreamUid`, `pendingStatus`, `videoUrl`. Rien n'est stocké (pas de compteur à maintenir).

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/series/admin/stats` | GET | aucun | `series`, `episodes`, `videosToProcess { total, none, error, pending, legacy }` | jeton, admin | `401` (renouvellement, spec 0002), `403` non admin |
| `/series/admin` | GET | existants (spec 0009) + `video: 'todo'` (opt) | existants + `videosToProcess: number` par série, seulement avec `video=todo` | jeton, admin | `400` filtre invalide, `401`, `403` |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Tuile Séries | nombre de séries | `stats.series` = `countDocuments({})` |
| Tuile Épisodes | nombre d'épisodes | `stats.episodes` = somme des tailles de `episodes` (agrégation) |
| Tuile Vidéos à traiter | nombre et détail par état | `stats.videosToProcess`, règle commune (dérivée de `adminVideoStatus`) |
| Tuile Vidéos à traiter | lien ou « Tout est prêt » | dérivé de `videosToProcess.total` (0 ou non) |
| Liens des tuiles | adresse de destination | constantes de la page (`/series`, `/series?videos=a-traiter`), décidées ici |
| Liste filtrée | séries gardées | paramètre d'adresse `videos` → `video=todo` → filtre `$elemMatch` |
| Ligne de série | « N vidéos à traiter » | `videosToProcess` de la ligne, renvoyé avec `video=todo` (agrégation sur les identifiants de la page) |
| Tuile à zéro | nom accessible | `tileLabel`, « 0 vidéo à traiter, tout est prêt » |
| Fraîcheur | moment du rechargement | `refetchOnMount: 'always'`, retour sur l'onglet (défaut du client), invalidations existantes de `seriesListsKey` |
| Nombres affichés | format | `Intl.NumberFormat('fr-FR')` |

**Key invariants**:
- `videosToProcess.total = none + error + pending + legacy`, et `episodes = total + nombre d'épisodes prêts`.
- Un épisode est compté à traiter par `stats` si et seulement si `adminVideoStatus` lui donne un état autre que `ready` (test de parité).
- Sur des données qui ne bougent pas, la somme des `videosToProcess` de toutes les séries gardées par `video=todo` égale `stats.videosToProcess.total` (vérifié en test ; en production, deux lectures séparées peuvent différer si une vidéo change entre les deux).
- Une série gardée par `video=todo` a toujours `videosToProcess ≥ 1`.

**Security model**: les deux routes sont réservées aux admins (jeton valide puis `assertAdmin`), comme les autres routes `/series/admin`. Elles ne renvoient que des comptes et des séries déjà visibles par l'admin ; aucune donnée personnelle, aucun lien de vidéo. Pas de nouveau secret.

**Configuration required**: aucune nouvelle variable d'environnement.

**Critical test scenarios**:
- Happy path : l'accueil affiche « 12 » séries, « 140 » épisodes, « 7 » vidéos à traiter avec « 2 sans vidéo · 1 en erreur · 4 anciens liens », un clic sur la troisième tuile ouvre `/series?videos=a-traiter` avec le filtre « À traiter » actif et « 3 vidéos à traiter » dans une ligne, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**
- Zéro : `total = 0` → « Tout est prêt », pas de lien, nom accessible « 0 vidéo à traiter, tout est prêt », verifies **AC-3**, **AC-8**
- Fraîcheur : arriver sur l'accueil redemande les chiffres même s'ils sont en cache ; après une modification sur une fiche (qui invalide `seriesListsKey`), revenir à l'accueil affiche les nouveaux chiffres, verifies **AC-6**
- Failure case : la route des stats répond `500` → `ErrorState` avec « Réessayer », qui redemande et affiche les tuiles, verifies **AC-7**
- Adresse : `?videos=nimporte` est retiré sans nouvelle entrée d'historique ; « Effacer les filtres » retire aussi `videos`, verifies **AC-4**
- Parité backend : la table des cas donne les mêmes comptes que `adminVideoStatus`, verifies **AC-10**
- Auth/permission : un non admin reçoit `403` sur `/series/admin/stats` et sur `/series/admin?video=todo`, verifies **AC-10**

## Build plan

Tracer Bullet : le backend d'abord (le dashboard n'a rien à afficher sans lui), puis un premier fil complet accueil → liste filtrée, puis on l'épaissit.

1. Backend : module `video-status-query.ts`, route `GET /series/admin/stats`, filtre `video=todo` et champ `videosToProcess` de `GET /series/admin`, tests (parité, filtre, somme, `400`, `401`, `403`), essai sur l'API locale branchée sur `noli_dev`, satisfies **AC-10**
2. Accueil de bout en bout : `src/features/overview/` (schéma, `useSeriesStats`, `seriesStatsKey` partagée, `StatTile`, `OverviewPage`), route index, suppression de `HomePage`, trois tuiles avec nombres, détail et liens, cas « Tout est prêt », satisfies **AC-1**, **AC-2**, **AC-3**, **AC-9**
3. Liste des séries : filtre « Vidéos » (`filters.ts`, barre, adresse, historique, valeur invalide), `videosToProcess` dans le schéma des lignes et le compte sous le titre, satisfies **AC-4**, **AC-5**
4. Fraîcheur, états de chargement et d'erreur, accessibilité, écran étroit, satisfies **AC-6**, **AC-7**, **AC-8**
5. Mise en ligne de l'API puis du dashboard, contrôle en production en lecture seule, satisfies **AC-11**

## Consequences

**Positive**:
- L'admin voit le travail en attente dès l'arrivée, et y va en un clic.
- Une seule requête légère pour l'accueil, quel que soit le nombre de séries.
- La liste des séries gagne un filtre utile au quotidien, même sans passer par l'accueil.
- Aucune donnée stockée en plus : les chiffres ne peuvent pas devenir faux par oubli de mise à jour.

**Negative / tradeoffs**:
- La règle « vidéo prête » existe maintenant deux fois au backend (`adminVideoStatus` en JavaScript, expressions MongoDB) ; seul le test de parité les garde d'accord. Toute évolution de `adminVideoStatus` doit toucher les deux.
- L'agrégation des stats parcourt toute la collection à chaque visite de l'accueil. C'est négligeable pour quelques centaines de séries, à revoir au delà de quelques milliers.
- La clé `seriesStatsKey` rangée sous le préfixe des listes est un raccourci : quelqu'un qui invaliderait une page précise de liste sans passer par le préfixe ne rafraîchirait pas les chiffres, et un futur `setQueriesData` sur ce préfixe attraperait aussi l'objet des stats (aucun aujourd'hui).
- Le filtre `$elemMatch` sur `streamUid: null` ne profite pas de l'index clairsemé existant : il parcourt toute la collection, sans gêne à quelques centaines de séries.
- La tuile « Épisodes » mène à la liste des séries, pas à une liste d'épisodes (qui n'existe pas).

**Neutral**:
- Le backend doit être mis en ligne avant le dashboard (sinon l'accueil est en erreur et le filtre « À traiter » est refusé en `400`) ; `videosToProcess` facultatif dans le schéma évite au moins de casser la liste sans filtre.
- `src/app/HomePage.tsx` disparaît ; l'accueil devient une fonctionnalité à part entière.

## Follow-up

- [ ] Si le catalogue dépasse quelques milliers de séries, mesurer la durée de l'agrégation des stats avant d'ajouter un cache ou un compteur.
- [ ] Liste de tous les épisodes à traiter (série, saison, numéro, état) si filtrer par série ne suffit plus.
