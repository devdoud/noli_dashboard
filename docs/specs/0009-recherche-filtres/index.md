# 0009. Recherche et filtres de la liste des séries

**Date**: 2026-10-16
**Status**: Accepted

## Summary

La liste des séries gagne une barre de filtres : une recherche dans le titre pendant la frappe (sans tenir compte des accents ni des majuscules), un filtre par catégorie (masquées comprises) et un filtre d'accès (toutes, premium, gratuites). Les filtres se combinent, vivent dans l'adresse de la page et se retrouvent au retour d'une fiche. Comme le backend ne sait pas combiner ces filtres aujourd'hui, une petite route admin `GET /series/admin` est ajoutée d'abord côté backend ; le dashboard l'utilise ensuite pour sa liste.

## Requirements

**User stories**:
- En tant qu'admin, je veux retrouver une série en tapant une partie de son titre, sans me soucier des accents ni des majuscules.
- En tant qu'admin, je veux voir les séries d'une catégorie, même masquée, ou seulement les séries premium ou gratuites.
- En tant qu'admin, je veux garder mes filtres quand j'ouvre une série puis reviens à la liste, et pouvoir partager l'adresse d'une liste filtrée.

**Acceptance criteria** (le contrat):
- **AC-1**: Au dessus du tableau de `/series`, une barre de filtres (zone `role="search"`, nom « Filtres des séries ») propose : « Rechercher un titre » (champ texte avec icône et bouton « Effacer la recherche » quand il n'est pas vide), « Catégorie » (liste avec recherche, « Toutes les catégories » par défaut, catégories masquées suivies de « (masquée) »), « Accès » (choix segmenté « Toutes », « Premium », « Gratuites », « Toutes » par défaut). Sur écran étroit, les filtres s'empilent sans défilement horizontal de la page.
- **AC-2**: La recherche porte sur le titre seulement, « contient », sans tenir compte des accents ni des majuscules (« mensah » et « MENSAH » trouvent « Le Secret du Docteur Mensah », « comedie » trouve « Comédie »). Elle part 300 ms après la dernière frappe, à partir de 2 caractères après nettoyage des espaces du bord ; à 1 caractère, aucun filtre n'est appliqué et le texte d'aide « 2 caractères au moins » s'affiche sous le champ. Le champ accepte 100 caractères au plus. Les espaces internes répétés comptent pour un seul. Les caractères spéciaux (« ( », « * », « ? », « \ », « ] ») sont cherchés tels quels, sans erreur. Hors périmètre : les lettres comme « œ », « æ », « ñ » ne sont pas rapprochées d'une forme sans accent.
- **AC-3**: Les filtres se combinent (titre ET catégorie ET accès). La liste est demandée à `GET /series/admin` avec les filtres actifs, la page et 20 séries par page. Changer un filtre ramène à la page 1. Pendant le chargement, les lignes précédentes restent affichées, grisées (`aria-busy`), comme pour le changement de page (spec 0004).
- **AC-4**: Les filtres vivent dans l'adresse : `?q=…&categorie=<id>&acces=premium|gratuites&page=…` (un filtre absent n'apparaît pas). Recharger la page ou ouvrir l'adresse partagée redonne la même liste filtrée. Ouvrir une série puis cliquer « Retour aux séries » ramène à la même adresse, filtres et page compris. La recherche crée une entrée d'historique quand elle passe d'aucune recherche à une recherche active, puis remplace cette entrée aux frappes suivantes (pas une entrée par lettre) ; changer la catégorie, l'accès, la page, cliquer « Effacer la recherche » ou « Effacer les filtres » crée une entrée (le bouton retour du navigateur revient à l'état précédent).
- **AC-5**: Un filtre invalide dans l'adresse est retiré sans nouvelle entrée d'historique, et la liste s'affiche sans lui : `q` de moins de 2 ou de plus de 100 caractères après nettoyage, `acces` autre que `premium` ou `gratuites`, `categorie` qui n'est pas un identifiant de la liste des catégories (contrôlé seulement une fois cette liste chargée, jamais pendant un rechargement ; si elle ne se charge pas, le filtre est gardé tel quel). Quand l'adresse porte une `categorie`, la liste des séries n'est demandée qu'une fois les catégories chargées (ou en erreur), pour ne jamais afficher un instant « Aucune série » pour une catégorie inconnue.
- **AC-6**: Quand au moins un filtre est actif : le compte « 3 séries trouvées » (« 1 série trouvée », « 0 série trouvée ») s'affiche à côté des filtres, avec un bouton « Effacer les filtres » qui retire tous les filtres et ramène à la page 1. Sans filtre, la liste garde son résumé actuel (« 1 à 20 sur 48 », « Page X sur Y »). Une page au delà de la dernière (par exemple `page=3` avec 5 résultats) ramène à la dernière page en gardant les filtres, sans nouvelle entrée d'historique.
- **AC-7**: Aucun résultat avec des filtres : « Aucune série ne correspond à ces filtres. » avec le bouton « Effacer les filtres ». Sans filtre et sans série, l'état vide actuel (spec 0004) ne change pas.
- **AC-8**: Erreurs : la liste en erreur garde l'état d'erreur avec « Réessayer » (spec 0004), filtres toujours visibles et modifiables. Si la liste des catégories ne se charge pas, le filtre « Catégorie » est désactivé avec l'aide « Catégories indisponibles » ; la recherche et l'accès marchent toujours. Un `400` de la route (filtre refusé par le backend) affiche l'état d'erreur avec « Effacer les filtres » seul, sans « Réessayer » (réessayer redonnerait la même erreur). Dans tous ces états, la barre de filtres reste affichée.
- **AC-9**: La colonne des catégories d'une ligne montre aussi les catégories masquées de la série, suivies de « (masquée) » en texte secondaire, comme sur la fiche (spec 0005).
- **AC-10**: Accessibilité : chaque filtre a un libellé visible ; le compte de résultats est annoncé par une zone `aria-live="polite"`, toujours présente dans la page (vide sans filtre), une fois les nouveaux résultats arrivés (jamais pendant l'affichage des résultats précédents) ; tout se fait au clavier ; « Effacer les filtres » rend le focus au champ de recherche.
- **AC-11**: Prérequis backend : `GET /series/admin` existe en production avec le contrat de ce spec (filtres, pagination, tri stable, catégories masquées comprises), réservée aux admins, testée, et la liste publique `GET /series` ne change pas.
- **AC-12**: La fonctionnalité est en ligne (API puis dashboard). L'engineer contrôle en production, sans rien enregistrer, une recherche, un filtre de catégorie et un filtre d'accès. Les essais réels se font sur l'API locale branchée sur la base `noli_dev`.

## Decision

**Chosen option**: filtrer côté backend par une route admin dédiée, `GET /series/admin`, et garder les filtres dans l'adresse de la page.

Le dashboard ne filtre rien lui même : il traduit l'adresse en paramètres de la route, et la route renvoie une page de résultats déjà filtrée et triée.

**Implementation skills**: `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `mantine-combobox` (`mantinedev/skills`, `.agents/skills/mantine-combobox/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Raisonnement et options : voir [rationale.md](rationale.md).

## Feature design

### Prérequis backend (`noli-backend`) : `GET /series/admin`

- **Route** : `@Get('admin')` dans `SeriesController`, déclarée **avant** `@Get(':id')` (sinon `admin` serait pris pour un identifiant), protégée comme les autres routes admin (jeton puis `assertAdmin`, `403` sinon).
- **Paramètres** (`SeriesAdminQueryDto`, validés par `class-validator`, conversion par `class-transformer`) :
  - `page` : entier ≥ 1, 1 par défaut ;
  - `limit` : entier de 1 à 50, 20 par défaut ;
  - `q` : texte facultatif, nettoyé des espaces du bord et des espaces internes répétés (réduits à un), de 2 à 100 caractères après nettoyage ;
  - `categoryId` : identifiant MongoDB facultatif (`@IsMongoId`) ;
  - `premium` : facultatif, `'true'` ou `'false'`, converti en booléen.
  Une valeur invalide → `400` (message de `class-validator`).
- **Filtre Mongo** (les conditions se combinent) :
  - `q` → `title: { $regex: accentInsensitive(q), $options: 'i' }`, où `accentInsensitive` retire d'abord les accents de `q` (`normalize('NFD')`, plage `̀` à `ͯ`), échappe tous les caractères spéciaux d'expression régulière, puis remplace chaque voyelle et `c` par une classe qui accepte ses formes accentuées (`a` → `[aàâäá]`, `e` → `[eéèêë]`, `i` → `[iîïí]`, `o` → `[oôöó]`, `u` → `[uùûüú]`, `c` → `[cç]`, `y` → `[yÿ]`), chaque lettre (remplacée ou non) étant suivie de `[̀-ͯ]*` pour trouver aussi un titre enregistré avec des accents décomposés ; les remplacements ne s'appliquent qu'aux lettres, jamais aux séquences échappées ;
  - `categoryId` → `categoryIds: categoryId` (catégories masquées comprises) ;
  - `premium=true` → `{ isPremium: true }` ; `premium=false` → `{ isPremium: { $ne: true } }` (couvre aussi une série sans le champ).
- **Réponse** : `{ message, data: { total, page, limit, series } }`, `total` par `countDocuments(filtre)`, séries sans `episodes`, peuplées avec `ADMIN_CATEGORY_POPULATE` et passées par `toAdminCategories` (catégories masquées comprises, avec `isVisible`, comme la fiche admin), triées `{ createdAt: -1, _id: -1 }`, puis `skip` et `limit`.
- **Inchangé** : `GET /series` et `GET /series/search` (utilisés par l'app).
- **Tests backend** : DTO (bornes, `premium`, identifiant invalide), filtre combiné, recherche « comedie » qui trouve « Comédie », « mensah » qui trouve « Mensah », « ( », « \ » et « ] » cherchés sans erreur, « ÉPISODE » qui trouve « épisode », titre à accents décomposés trouvé, catégorie masquée, pagination stable, `403` pour un non admin, route `admin` non captée par `:id`.

### Dashboard

- **Filtres** (`src/features/series/filters.ts`, fonctions pures) :
  - `SeriesFilters` : `{ q?: string; categoryId?: string; access?: 'premium' | 'gratuites' }` ;
  - `parseFilters(searchParams)` : lit `q`, `categorie`, `acces` ; nettoie `q` (espaces du bord, espaces internes répétés réduits à un) et ne le garde que de 2 à 100 caractères ; garde `acces` seulement s'il vaut `premium` ou `gratuites` ; garde `categorie` s'il a la forme d'un identifiant (24 caractères hexadécimaux) ;
  - `withFilters(filters, page)` : construit l'adresse dans l'ordre `q`, `categorie`, `acces`, `page` (page omise si elle vaut 1) ;
  - `hasFilters(filters)`, `toApiQuery(filters, page)` : `{ page, limit: 20, q, categoryId, premium }` (`limit` toujours 20, `page` toujours au moins 1, clés absentes plutôt que `undefined`) (`premium` = `'true'` pour `premium`, `'false'` pour `gratuites`, absent sinon) ;
  - `resultCountText(total)` : « 0 série trouvée », « 1 série trouvée », « 3 séries trouvées ».
- **Données** (`src/features/series/api.ts`) : `useSeriesPage(page, filters)` appelle `GET /series/admin` avec `toApiQuery` ; `seriesKeys.list(page)` devient `seriesKeys.list(page, filters)`, soit `[...seriesListsKey, page, filters]`, avec des filtres normalisés (ordre fixe `q`, `categoryId`, `access`, sans clé `undefined`) et toujours issus de `parseFilters` (jamais l'adresse brute : un `q` d'un caractère n'est jamais envoyé) ; l'invalidation existante par `seriesKeys.lists` ne change pas ; `placeholderData: keepPreviousData` gardé ; `enabled` vaut faux tant qu'une `categorie` attend le chargement des catégories (AC-5). Le schéma des lignes accepte `isVisible` facultatif sur les catégories (absent = visible) ; le type des catégories d'une ligne reçoit `isVisible?: boolean`.
- **Page hors limites** : l'effet actuel de `SeriesListPage` (page vide au delà de la dernière) reconstruit l'adresse avec `withFilters(filtres, lastPage(total))` au lieu de `pageParams(…)`, toujours en remplacement, pour ne pas perdre les filtres.
- **Barre de filtres** (`SeriesFiltersBar`) : au dessus du tableau, `Group` qui passe à la ligne (`wrap`), puis s'empile sur écran étroit.
  - Recherche : `TextInput` contrôlé localement (le texte tel que tapé), recopié dans l'adresse 300 ms après la dernière frappe (`useDebouncedValue` de Mantine). Règles :
    - la valeur écrite est le `q` nettoyé, ou aucun `q` si le texte nettoyé fait moins de 2 caractères (un `q` existant est alors retiré) ;
    - passage d'aucun `q` à un `q` : nouvelle entrée d'historique ; ensuite : remplacement ; dans les deux cas la page revient à 1 ;
    - rien n'est écrit si la valeur attendue est déjà celle de l'adresse ;
    - l'adresse change de l'extérieur (retour arrière, « Effacer les filtres », lien) : l'attente en cours est annulée et le champ reprend le `q` de l'adresse ;
    - changer la catégorie ou l'accès pendant l'attente emporte le texte en cours (le `q` nettoyé est écrit dans la même adresse) ;
    - bouton « Effacer la recherche » (`aria-label`) quand le champ n'est pas vide : agit tout de suite, sans attente, avec une nouvelle entrée.
  - Catégorie : `Select` Mantine `searchable`, `clearable`, données de `useAllCategories` (src/shared) dans l'ordre reçu, étiquette « Nom (masquée) » pour une catégorie masquée (options et valeur choisie), « Toutes les catégories » comme texte d'attente. Tant que les catégories chargent, le champ est vide et désactivé (jamais l'identifiant brut).
  - Accès : `SegmentedControl` `Toutes` / `Premium` / `Gratuites`, avec un libellé visible « Accès ».
  - À droite : la zone `aria-live="polite"` toujours rendue ; quand un filtre est actif et que les résultats ne sont pas ceux de la requête précédente (`isPlaceholderData` faux), elle contient le compte (AC-6) ; le bouton « Effacer les filtres » quand un filtre est actif.
  - La barre reste rendue dans tous les états de la liste (chargement, vide, erreur, `400`), pour que « Effacer les filtres » puisse rendre le focus au champ de recherche.
- **Adresse invalide** (AC-5) : un effet compare l'adresse lue à `withFilters(parseFilters(…), page)` et remplace l'adresse si elle diffère ; pour `categorie`, la comparaison attend que `useAllCategories` ait des données à jour (ni en chargement, ni en rechargement), et retire l'identifiant absent de la liste ; catégories en erreur → l'identifiant est gardé.
- **Lignes** : la colonne des catégories affiche les masquées avec « (masquée) » en texte secondaire (`c="dimmed"`), dans l'ordre reçu.
- **États** : aucun résultat avec filtres → `EmptyState` de l'AC-7 ; erreur → `ErrorState` (spec 0002) avec « Réessayer », plus « Effacer les filtres » si un filtre est actif ; erreur `400` → « Effacer les filtres » seul.

### State transitions

Adresse de la page = état des filtres. `aucun filtre` ⇄ `filtres actifs` par la saisie (après 300 ms), le choix d'une catégorie ou d'un accès, « Effacer la recherche », « Effacer les filtres », ou une adresse ouverte directement. Tout changement de filtre remet `page` à 1.

### API surface

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/series/admin` (nouveau, backend) | GET | `page`, `limit`, `q?`, `categoryId?`, `premium?` | `{ message, data: { total, page, limit, series } }` | admin | 400, 401, 403 |
| `/categories/all` (existant) | GET | aucun | `{ message, categories }` | admin | 403 |

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Filtres affichés | texte, catégorie, accès | adresse de la page (`parseFilters`), la saisie en cours pour le champ texte |
| Requête | paramètres | `toApiQuery(filtres de l'adresse, page de l'adresse)` |
| Liste | séries, total | réponse de `GET /series/admin` |
| Recherche sans accents | correspondance | `accentInsensitive(q)` côté backend |
| Choix de catégorie | options, « (masquée) » | `useAllCategories` (`name`, `isVisible`) |
| Compte | « N séries trouvées » | `data.total` de la réponse |
| Résumé sans filtre | « 1 à 20 sur 48 » | existant (spec 0004), `page`, `total` |
| Catégories d'une ligne | noms, « (masquée) » | `series.categories` de la route admin (`isVisible`) |
| Retour depuis une fiche | adresse de la liste | état `from` posé par le lien de la ligne (spec 0005), qui contient déjà `location.search` |
| Catégorie invalide | identifiant à retirer | comparaison avec `useAllCategories` une fois chargée |

### Key invariants

- Le dashboard ne filtre jamais lui même : la liste affichée est toujours la réponse du backend.
- Un changement de filtre ramène toujours à la page 1.
- L'adresse est la seule source des filtres actifs ; le champ texte n'est qu'une saisie en attente.
- La recherche backend n'interprète jamais le texte saisi comme une expression régulière (texte échappé).
- La liste publique de l'app (`GET /series`, `GET /series/search`) ne change pas.

### Security model

La nouvelle route est réservée aux admins (jeton, puis contrôle du rôle, `403` sinon), comme `GET /series/:id/admin`. Le texte saisi est échappé avant d'entrer dans l'expression régulière, ce qui supprime le risque d'expression régulière malveillante (lenteur ou erreur) ; sa longueur est bornée à 100 caractères. Aucune donnée personnelle.

### Configuration required

Aucune variable nouvelle. Ordre de mise en ligne : API d'abord (le dashboard dépend de la nouvelle route), puis dashboard.

### Critical test scenarios

- Backend : `q=comedie` trouve « Comédie romantique », `q=MENSAH` trouve « … Mensah », `q=(` répond `200`, `categoryId` d'une catégorie masquée, `premium=false` inclut une série sans le champ, combinaison des trois, `limit=51` → `400`, non admin → `403`, `GET /series/admin` non pris pour `/series/:id`, verifies **AC-11**.
- Saisie : depuis la page 3, « me » puis attente de 300 ms → une seule requête avec `q=me`, page 1, une entrée d'historique ; « mens » → entrée remplacée ; retour arrière → page 3 sans recherche et champ vidé ; « m » seul → aucun filtre, `q` retiré, aide « 2 caractères au moins » ; taper puis choisir « Premium » avant 300 ms → l'adresse garde le texte, verifies **AC-2**, **AC-3**, **AC-4**.
- Catégorie et accès : choisir une catégorie masquée puis « Gratuites » → requête avec `categoryId` et `premium=false`, deux entrées d'historique, page 1, verifies **AC-1**, **AC-3**, **AC-4**.
- Adresse : ouvrir `/series?q=x&acces=vip&categorie=<inconnue>` → adresse nettoyée sans nouvelle entrée, liste sans filtre, et aucune requête des séries avant le chargement des catégories ; `q=drame&page=3` avec 5 résultats → page 1 en gardant `q` ; retour depuis une fiche → mêmes filtres et page, verifies **AC-4**, **AC-5**, **AC-6**.
- Compte et effacement : « 1 série trouvée », « Effacer les filtres » → adresse `/series`, focus sur la recherche ; aucun résultat → message et bouton, verifies **AC-6**, **AC-7**, **AC-10**.
- Erreurs : liste en `500` → « Réessayer » avec filtres actifs et barre toujours là ; `400` → « Effacer les filtres » seul, focus rendu à la recherche ; catégories en erreur → filtre désactivé avec « Catégories indisponibles », verifies **AC-8**.
- Lignes : catégorie masquée affichée avec « (masquée) », verifies **AC-9**.

## Build plan

Approche Tracer Bullet : d'abord le fil le plus mince de bout en bout (recherche par titre sur la vraie route), puis on l'épaissit.

1. Backend (`noli-backend`, branche dédiée, seulement ses propres fichiers) : `SeriesAdminQueryDto`, `accentInsensitive`, `SeriesService.listForAdmin`, `@Get('admin')` avant `@Get(':id')`, tests unitaires et HTTP ; essai sur l'API locale (base `noli_dev`), satisfies **AC-11**.
2. Dashboard : `filters.ts` et ses tests ; `useSeriesPage(page, filters)` sur `GET /series/admin` ; champ de recherche avec anti rebond et adresse, de bout en bout, satisfies **AC-2**, **AC-3**, **AC-4**.
3. Filtres catégorie et accès, compte, « Effacer les filtres », aucun résultat, catégories masquées dans les lignes, satisfies **AC-1**, **AC-6**, **AC-7**, **AC-9**.
4. Adresse invalide, erreurs, accessibilité, écran étroit ; tests d'intégration MSW de la page, satisfies **AC-5**, **AC-8**, **AC-10**.
5. Mise en ligne : API (fusion et push, confirmation de l'engineer), puis dashboard ; contrôle en production en lecture seule, satisfies **AC-11**, **AC-12**.

## Consequences

**Positive**:
- Retrouver une série devient immédiat, et la liste filtrée se partage par son adresse.
- Le filtre reste juste quand le catalogue grandit (pagination côté backend), et voit les catégories masquées.
- La recherche par titre devient insensible aux accents et sûre (texte échappé), sans toucher à la recherche de l'app.

**Negative / tradeoffs**:
- Un prérequis backend de plus, à mettre en ligne avant le dashboard.
- La recherche par expression régulière parcourt les titres (pas d'index utilisable) : sans souci pour quelques centaines de séries, à revoir avec un index texte au delà de quelques milliers.
- Les lettres accentuées hors des classes prévues (par exemple « æ », « ñ ») ne sont pas rapprochées de leur forme sans accent.

**Neutral**:
- La liste du dashboard passe de `GET /series` à `GET /series/admin` ; la liste publique ne change pas.
- Pas de tri au choix dans cette version (plus récentes d'abord, comme aujourd'hui).

## Follow-up

- [ ] Si le catalogue dépasse quelques milliers de séries : un champ de titre normalisé indexé, ou un index texte, pour la recherche.
- [ ] La recherche publique de l'app (`GET /series/search`) garde son expression régulière non échappée : à corriger côté backend dans une autre fonctionnalité.
- [ ] Si utile : un tri au choix (titre, note, mise à jour) sur la même route.
