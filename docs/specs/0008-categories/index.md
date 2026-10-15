# 0008. Gestion des catégories

**Date**: 2026-10-15
**Status**: Proposed

## Summary

Une page « Catégories » permet à l'admin de gérer toutes les catégories du catalogue, masquées comprises : les créer, les renommer, les décrire, les masquer, changer leur ordre d'affichage, changer leur image carrée et les supprimer. Elle s'appuie entièrement sur les routes que le backend expose déjà (spec backend 0003) : aucun changement côté API. Les noms trop proches d'un existant sont signalés avant l'envoi, et une catégorie encore utilisée par des séries ne peut pas être supprimée, ce que la page explique en proposant de la masquer plutôt.

## Requirements

**User stories**:
- En tant qu'admin, je veux voir toutes les catégories dans leur ordre d'affichage, masquées comprises, pour savoir ce que l'app montre.
- En tant qu'admin, je veux créer, renommer et décrire une catégorie sans risquer un doublon à une majuscule ou un accent près.
- En tant qu'admin, je veux masquer une catégorie sans perdre ses séries, et changer l'ordre dans lequel l'app les présente.
- En tant qu'admin, je veux supprimer une catégorie inutile, et comprendre pourquoi c'est refusé quand des séries l'utilisent encore.

**Acceptance criteria** (le contrat):
- **AC-1**: Le menu montre « Catégories », qui ouvre `/categories`. La page affiche le titre « Catégories » (titre de l'onglet compris), le nombre (« 8 catégories », « 1 catégorie » pour 0 et 1, caché pendant le chargement et en erreur), un bouton « Nouvelle catégorie » et un tableau dans l'ordre d'affichage (`displayOrder`) avec les colonnes Ordre, Image, Nom (et la description sur une ligne, en texte secondaire), Adresse (`/slug`), Visible, Actions. Une catégorie masquée porte le badge « Masquée ». Sans catégorie : « Aucune catégorie pour le moment » et « Nouvelle catégorie ». Pendant le chargement, un squelette ; en erreur, l'état d'erreur de la spec 0003 avec « Réessayer ».
- **AC-2**: « Nouvelle catégorie » ouvre une fenêtre avec Nom (obligatoire), Description (facultative, compteur « N / 300 ») et Visible (activé par défaut), plus l'aperçu de l'adresse calculée en direct (« Adresse : /comedie-romantique »). Un envoi valide fait `POST /categories`, ferme la fenêtre, affiche « Catégorie créée. » et ajoute la catégorie en fin de tableau.
- **AC-3**: Le nom est vérifié avant l'envoi, sans appel à l'API, avec le message sous le champ et le focus sur lui : vide après nettoyage → « Nom requis. » ; plus de 50 caractères → « 50 caractères au plus. » ; aucune lettre ni chiffre (a à z, 0 à 9 après retrait des accents) → « Le nom doit contenir au moins une lettre ou un chiffre. » ; forme réservée (`all`, `order`) → « Ce nom est réservé, choisissez en un autre. » ; même forme qu'une autre catégorie (sans accents ni majuscules, ponctuation en tirets) → « Trop proche de la catégorie « Comédie ». » La description de plus de 300 caractères → « 300 caractères au plus. ». Un `409` du backend sur le nom (un autre admin vient de créer la même) → « Trop proche d'une catégorie existante. » sous Nom, fenêtre ouverte.
- **AC-4**: « Modifier » ouvre la même fenêtre préremplie, avec l'image (AC-9) et l'adresse (AC-5). « Enregistrer », actif seulement avec des changements, envoie `PATCH /categories/:id` avec les seuls champs modifiés (description vidée → `null`), puis « Catégorie modifiée. ». Un texte rappelle « Renommer ne change pas l'adresse. ».
- **AC-5**: L'adresse s'affiche en lecture seule (« /comedie-romantique ») avec un bouton « Modifier l'adresse ». Il ouvre un champ prérempli et l'avertissement « Les liens déjà partagés vers cette catégorie ne marcheront plus. ». Règles, vérifiées avant l'envoi : minuscules, chiffres et tirets simples entre des mots (`^[a-z0-9]+(-[a-z0-9]+)*$`) → sinon « Lettres minuscules, chiffres et tirets seulement (par exemple comedie-romantique). » ; `all` ou `order` → « Cette adresse est réservée. » ; adresse d'une autre catégorie → « Adresse déjà utilisée par « Drame ». » ; `409` du backend sur l'adresse → « Adresse déjà utilisée par une autre catégorie. ». L'adresse part dans le même `PATCH` que les autres champs.
- **AC-6**: Chaque ligne a un interrupteur « Visible ». Le désactiver ouvre « Masquer « Drame » ? » : « La catégorie disparaîtra de l'app et de l'étiquette de ses séries. Ses séries restent visibles. », bouton « Masquer » ; après confirmation, `PATCH { isVisible: false }`, badge « Masquée », « Catégorie masquée. ». Le réactiver envoie aussitôt `PATCH { isVisible: true }` et « Catégorie affichée. ». Pendant l'appel, l'interrupteur est désactivé ; en cas d'échec, il revient à sa position.
- **AC-7**: Chaque ligne a « Monter » et « Descendre » (la première ne monte pas, la dernière ne descend pas). Un déplacement change l'ordre à l'écran et fait apparaître un bandeau « Ordre modifié » avec « Enregistrer l'ordre » et « Annuler ». Tant qu'il est là, créer, modifier, masquer et supprimer sont désactivés, avec « Enregistrez ou annulez le nouvel ordre pour continuer. ». « Enregistrer l'ordre » envoie `PUT /categories/order` avec **tous** les identifiants dans le nouvel ordre, puis « Ordre enregistré. » ; « Annuler » revient à l'ordre enregistré sans appel. Un `400` (la liste a changé entre temps) relit la liste et affiche « La liste a changé entre temps : l'ordre enregistré a été rechargé. Recommencez le déplacement. ».
- **AC-8**: « Supprimer » ouvre `confirmDanger` « Supprimer « Drame » ? » : « La catégorie et son image seront supprimées définitivement. », puis `DELETE /categories/:id` et « Catégorie supprimée. ». Un `409 CATEGORY_IN_USE` ouvre « Suppression impossible » : « « Drame » est encore utilisée par 3 séries. Retirez la de ces séries, ou masquez la. » (« 1 série » au singulier), avec « Masquer plutôt » (si elle est visible, qui masque sans autre question) et « Fermer ». Un `404` → « Cette catégorie avait déjà été supprimée. » et la liste est relue.
- **AC-9**: La fenêtre de modification a une partie « Image » : l'emplacement d'image de la spec 0007, forme 1:1, 400 × 400 px au moins, sur `PUT` et `DELETE /categories/:id/image`, indépendant d'« Enregistrer », avec ses contrôles, son aperçu, ses refus et ses textes (« Image mise à jour. », « Image retirée. », « Retirer l'image ? »). Pas d'image à la création. Le tableau montre une miniature carrée de 40 px, ou une icône quand il n'y en a pas.
- **AC-10**: Après toute écriture (création, modification, visibilité, ordre, suppression, image), la page et le choix des catégories du formulaire de série (spec 0005) montrent l'état renvoyé par le backend, sans recharger. Un `404` en modification → « Cette catégorie n'existe plus. », fenêtre fermée, liste relue. Les autres erreurs suivent la spec 0002 (et la spec 0007 pour l'image).
- **AC-11**: Fermer la fenêtre avec des changements non enregistrés (ou une image en attente d'envoi) demande « Abandonner les changements ? ». Un ordre modifié non enregistré, une fenêtre modifiée ou une image en attente activent la protection de la page (« Quitter sans enregistrer ? », `beforeunload` compris).
- **AC-12**: Accessibilité : le tableau a la légende « Catégories dans l'ordre d'affichage » ; chaque bouton a un nom complet (« Monter « Drame » », « Descendre « Drame » », « Modifier « Drame » », « Supprimer « Drame » ») ; l'interrupteur se nomme « Visible : Drame » ; après un déplacement, le focus reste sur le même bouton de la ligne déplacée (ou passe à l'autre bouton s'il devient inactif) et une zone `aria-live` annonce « « Drame » est maintenant en position 2 sur 8. » ; tout se fait au clavier.
- **AC-13**: Sur un écran étroit, le tableau défile dans son cadre ; la page n'a aucun défilement horizontal.
- **AC-14**: La fonctionnalité est en ligne (dashboard seulement). L'engineer contrôle en production, sans rien enregistrer, que la page liste les catégories masquées comprises. Les essais réels d'écriture se font sur l'API locale branchée sur une **base séparée de la production**.

## Decision

**Chosen option**: une page de liste avec fenêtre d'édition, réordonnancement par boutons enregistré en un seul envoi, et contrôles du nom et de l'adresse dans le navigateur avec la même règle que le backend.

Les trois briques communes aux séries et aux catégories (l'emplacement d'image, la protection de la page, la liste des catégories en cache) passent dans `src/shared/`, pour respecter la règle « une fonctionnalité n'importe jamais une autre fonctionnalité ».

**Implementation skills**: `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `mantine-form` (`mantinedev/skills`, `.agents/skills/mantine-form/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Raisonnement et options : voir [rationale.md](rationale.md).

## Feature design

### Ce que le backend fournit (spec backend 0003, en production)

| Route | Méthode | Entrée | Sortie | Erreurs utiles |
|---|---|---|---|---|
| `/categories/all` | GET | aucune | `{ message, categories }`, toutes, triées par `displayOrder`, `createdAt`, `_id` | 403 |
| `/categories` | POST | `name` (req), `description?`, `isVisible?` | `{ message, category }`, placée en dernier | 400 (nom sans lettre ni chiffre, forme réservée), 409 (« A category with this name already exists ») |
| `/categories/:id` | PATCH | `name?`, `description?` (texte ou `null`), `isVisible?`, `slug?` | `{ message, category }` | 400 (rien à modifier, adresse invalide ou réservée), 404, 409 (« A category with this name already exists » ou « … slug … ») |
| `/categories/order` | PUT | `ids` : **tous** les identifiants, une fois chacun | `{ message, categories }` dans le nouvel ordre | 400 (liste incomplète ou en trop) |
| `/categories/:id` | DELETE | aucune | `{ message }` | 404, 409 `{ code: 'CATEGORY_IN_USE', seriesCount }` |
| `/categories/:id/image` | PUT | `file` multipart | `{ message, category }` | comme la spec 0007 (400, 404, 409, 413, 415, 429, 503) |
| `/categories/:id/image` | DELETE | aucune | `{ message, category }` | 404, 409, 429, 503 |

Règle de forme du backend (`slugify`) : `name.normalize('NFD')`, retrait des signes diacritiques (plage `̀` à `ͯ`), minuscules, toute suite d'autres caractères que `a-z0-9` devient un tiret, tirets du bord retirés. La forme d'un nom (`nameKey`) et l'adresse initiale (`slug`) sont ce résultat.

### Données

`categorySchema` (dans `src/shared/api/categories.ts`) : `_id`, `name`, `slug`, `description` (nullish → `undefined`), `imageUrl` (nullish → `undefined`), `displayOrder` (nombre, nullish → 0), `isVisible` (nullish → `true`), `createdAt`, `updatedAt` (facultatifs). Il remplace `allCategoriesSchema` de la fonctionnalité Séries, qui garde son type `CategoryOption` comme sous ensemble (`_id`, `name`, `isVisible`). Le dashboard ne stocke rien : la liste vient de `GET /categories/all`, chaque écriture renvoie la catégorie ou la liste.

### Organisation du code

- **Déplacés dans `src/shared/`** (avec un commentaire d'en tête, règle d'`AGENTS.md`), dans un commit à part, sans changement de comportement :
  - `src/shared/api/categories.ts` : `categoriesKeys`, `categorySchema`, `useAllCategories` (même clé `['categories', 'all']`, même durée de fraîcheur), lus par les séries et les catégories ; `CategoryOption` des séries devient un `Pick` de ce type, pas un second schéma ;
  - `src/shared/api/seriesKeys.ts` : `seriesListsKey = ['series', 'list']`, réutilisé par `seriesKeys.lists` des séries et par les catégories (plus de chaîne copiée) ;
  - `src/shared/images/` : `ImageSlot.tsx`, `imageRules.ts`, `imageDimensions.ts` et leurs tests unitaires. `ImageSlotKind` devient `'cover' | 'banner' | 'thumbnail' | 'category'` ; chaque emplacement de `IMAGE_SLOTS` porte son propre texte de `404` (`gone`) au lieu du choix série ou épisode ; `ImageSlot` reçoit des mutations au type générique (`upload` sur un `File`, `remove` sans argument, `isPending`, résultat ignoré), plus seulement celles des séries. `useImageMutations` et `ImageTarget` restent dans les séries ;
  - `src/shared/ui/useUnsavedChangesGuard.tsx` (spec 0005), inchangé ;
  - `src/test/categoriesApi.ts` : les réponses simulées de `GET /categories/all` (aujourd'hui dans `seriesApi.ts`), réexportées pour les tests des séries.
  Les imports et les `vi.mock` des séries sont mis à jour ; un test de non régression vérifie que le formulaire de série liste toujours les catégories masquées.
- **Emplacement `category`** dans `IMAGE_SLOTS` : `aspectRatio: 1`, `minWidth: 400`, `minHeight: 400` (toutes les proportions jusqu'à 5:1 acceptées, le backend recadre au carré, comme pour la couverture), `title: 'Image'`, `noun: "l'image"`, `empty: 'Aucune image'`, `saved: 'Image mise à jour.'`, `removed: 'Image retirée.'`, `gone: "Cette catégorie n'existe plus."` ; texte alternatif « Image de la catégorie Drame » ; `nameSuffix` « de « Drame » » (boutons « Choisir l'image de « Drame » », « Retirer l'image de « Drame » », confirmation « Retirer l'image de « Drame » ? »).
- **Fonctionnalité `src/features/categories/`** : `CategoriesPage`, `CategoriesTable`, `CategoryModal`, `CategoryInUseModal`, `categoryRules.ts` (fonctions pures), `categoryOrder.ts` (fonctions pures), `api.ts` (écritures et mutations), tests à côté.
- **Routeur** : route `/categories` protégée (comme `/series`). **Menu** : l'entrée « Catégories » passe à `ready: true`.

### Règles pures (`categoryRules.ts`)

- `slugify(text)` : exactement la règle du backend ci dessus, la plage des signes diacritiques écrite avec des échappements `̀` et `ͯ`.
- `nameError(name, others, selfId?)` → message de l'AC-3 ou `undefined`, dans l'ordre : vide, longueur, sans lettre ni chiffre, réservé, trop proche (la première autre catégorie dont `slugify(name)` est égal à `slugify(name)` du nom saisi, en ignorant `selfId`).
- `slugError(slug, others, selfId)` → message de l'AC-5 ou `undefined` : motif, réservé, déjà utilisée (autre catégorie avec ce `slug`).
- `toCategoryPatch(base, values)` → seuls les champs changés : `name` nettoyé, `description` nettoyée (vide → `null`), `isVisible`, `slug` (seulement si le champ d'adresse a été ouvert et modifié).
- `categoryErrorMessage(error, field)` : `409` sur le nom → AC-3 ; `409` sur l'adresse (message du backend contenant `slug`) → AC-5 ; `400` « reserved » → message réservé du champ ; `404` → « Cette catégorie n'existe plus. ».

### Ordre (`categoryOrder.ts`)

- `moveCategory(ids, id, direction)` → nouvelle liste (pure), `samePositions(a, b)`.
- État de la page : `draftIds: string[] | undefined` (undefined = pas d'ordre en cours). Le tableau affiche les catégories dans l'ordre de `draftIds` s'il existe, sinon dans l'ordre du serveur.
- « Enregistrer l'ordre » : `PUT /categories/order { ids: draftIds }` ; succès → `setQueryData(categoriesKeys.all, categories)`, `draftIds` remis à `undefined`. Revenir à l'ordre exact du serveur par des déplacements fait aussi disparaître le bandeau.

### Fenêtre de catégorie (`CategoryModal`)

- `Modal` Mantine, titre « Nouvelle catégorie » ou « Modifier « Drame » », `useForm` en mode non contrôlé avec résolveur (comme la fenêtre d'épisode, spec 0006).
- Champs : Nom (`TextInput`, focus à l'ouverture), Description (`Textarea` autosize, compteur), Visible (`Switch`), aperçu ou bloc Adresse, puis (modification seulement) la partie « Image » hors du `<form>`.
- Boutons : « Annuler » et « Créer la catégorie » ou « Enregistrer » ; « Création en cours », « Enregistrement en cours » ; un drapeau `useRef` empêche un second envoi.
- Fermeture : croix, Échap, clic dehors et « Annuler » passent par la question de l'AC-11 quand la fenêtre est modifiée ou qu'une image attend.

### Fenêtre « Suppression impossible » (`CategoryInUseModal`)

Ouverte par un `409 CATEGORY_IN_USE` : texte de l'AC-8 avec `seriesCount` de la réponse (accord singulier ou pluriel), « Masquer plutôt » (affiché si la catégorie est visible ; envoie `PATCH { isVisible: false }` puis « Catégorie masquée. ») et « Fermer » (focus par défaut).

### Règles détaillées

- **Liste et fraîcheur** : la page force une relecture à l'ouverture (`refetchOnMount: 'always'`) ; pendant une relecture avec des données en cache, rien ne change à l'écran. Pas de relecture au retour sur l'onglet tant qu'un ordre est en cours. « Nouvelle catégorie » est désactivé tant que la liste n'est pas chargée.
- **Tableau** : composants partagés (`TableSkeleton`, tableau dans un cadre qui défile, comme les épisodes) ; colonne Ordre = rang affiché (1, 2, 3…), jamais `displayOrder` ; image 40 × 40, `alt=""` (le nom est à côté), `IconPhoto` sans image ou si l'image ne charge pas ; lignes clées par `_id`.
- **Nettoyage** : le nom et la description sont nettoyés des espaces du bord avant tout contrôle et tout envoi (le backend ne le fait pas) ; les espaces intérieurs sont gardés ; les longueurs (50, 300) se comptent avec `.length` sur le texte nettoyé, comme le backend. À la création, une description vide n'est pas envoyée.
- **Contrôle du nom** : il s'applique à la création et en modification (seulement si le nom a changé après nettoyage) ; « réservé » porte sur la forme (`slugify`), donc « ALL! » est aussi refusé, volontairement plus strict que le backend en modification (une forme `all` stockée bloquerait ensuite une vraie création). La catégorie modifiée est ignorée : renommer « Drame » en « drame » est permis et envoie `{ name }`. Les autres catégories viennent de la liste du serveur la plus récente au moment de l'envoi, jamais de l'ordre en cours. Focus sur le premier champ en erreur dans l'ordre Nom, Description, Adresse.
- **« Enregistrer »** : actif seulement si `toCategoryPatch` n'est pas vide ; Entrée sans changement n'envoie rien. La fenêtre se ferme après un `PATCH` réussi, comme après une création.
- **Copie figée** : la fenêtre prend sa copie à l'ouverture, par identifiant ; une mise à jour du cache (image envoyée, relecture) ne réinitialise pas le formulaire. Si la catégorie disparaît de la liste pendant que la fenêtre est ouverte, rien ne se passe avant l'envoi (le `404` ferme alors la fenêtre).
- **Adresse** : le champ ouvert montre la valeur saisie telle quelle, son erreur dessous, et un bouton « Annuler » qui referme le champ et abandonne la modification.
- **`409` nom ou adresse** : le message du backend (chaîne ou tableau, joint) contient le mot `slug` → adresse (« A category with this slug already exists ») ; sinon → nom (« A category with this name already exists »).
- **Visibilité** : interrupteur non optimiste (il ne change qu'au succès) ; pendant l'appel, cet interrupteur est désactivé, les autres lignes restent utilisables ; la confirmation de masquage passe par `confirmDanger` (« Annuler » par défaut, bouton « Masquer ») ; un échec passe par `notifyError`.
- **Ordre en cours** : si la liste du serveur change pendant un ordre en cours (identifiants différents), l'ordre est abandonné avec « La liste a changé entre temps : l'ordre enregistré a été rechargé. Recommencez le déplacement. ». Pendant l'envoi, le bandeau montre « Enregistrement en cours », tout est désactivé, un drapeau `useRef` empêche un second envoi. Après « Enregistrer l'ordre » ou « Annuler », le focus va au titre de la page. Le bandeau disparaît quand la suite des identifiants redevient celle du serveur (comparaison des identifiants, pas des `displayOrder`). Tout `400` sur l'ordre se traite comme « liste changée », sans `applyFieldErrors`.
- **Actions bloquées par l'ordre en cours** : `aria-disabled` (elles restent atteignables au clavier) avec la raison « Enregistrez ou annulez le nouvel ordre pour continuer. » reliée par `aria-describedby` ; un clic n'a pas d'effet.
- **Focus après un déplacement** : des références par identifiant et par sens, appliquées dans un effet de mise en page après le changement d'ordre (les lignes, clées par `_id`, sont déplacées sans être recréées). La zone d'annonce est permanente (`role="status"`), vidée après un enregistrement ou une annulation ; le bandeau « Ordre modifié » est aussi un `role="status"`.
- **Suppression** : sur un `409`, la confirmation se ferme et « Suppression impossible » s'ouvre. `seriesCount` est lu dans `error.body` par un schéma Zod (`{ code: 'CATEGORY_IN_USE', seriesCount: entier ≥ 1 }`) ; s'il manque : « « Drame » est encore utilisée par des séries. ». « Masquer plutôt » ferme la fenêtre une fois réussi (« Catégorie masquée. »), son `404` suit le chemin « n'existe plus ». Pas de lien vers les séries dans cette version.
- **Question de fermeture** : celle de la spec 0006 (« Abandonner les changements ? », « Vos changements seront perdus. », « Continuer la saisie » par défaut, « Abandonner ») ; la protection de la page (zIndex 300, spec 0007) est active si `draftIds` existe, si la fenêtre est modifiée ou si une image attend.
- **Fin de session** : silencieuse ; la fenêtre ouverte et l'ordre en cours sont perdus.

### API surface (côté dashboard, `src/features/categories/api.ts`)

| Fonction | Route | Après succès |
|---|---|---|
| `createCategory(values)` | `POST /categories` | `setQueryData` en ajoutant la catégorie renvoyée en fin de liste, puis `invalidateQueries(categoriesKeys.all)` |
| `updateCategory(id, patch)` | `PATCH /categories/:id` | remplace la catégorie dans le cache de la liste |
| `reorderCategories(ids)` | `PUT /categories/order` | `setQueryData` avec la liste renvoyée |
| `deleteCategory(id)` | `DELETE /categories/:id` | retire la catégorie du cache, puis relecture de la liste |
| image | `PUT` / `DELETE /categories/:id/image` | remplace la catégorie renvoyée dans le cache |

Toutes par le client partagé (`apiRequest`, spec 0002), réponses validées par Zod. Après un renommage, un changement d'adresse ou d'image, un masquage ou une suppression, la liste des séries est relue (`invalidateQueries` sur `seriesListsKey` de `src/shared/`) ; les fiches de série en cache se mettent à jour à leur prochaine lecture.

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Page | catégories, ordre, nombre | `GET /categories/all` (ordre du backend), `categories.length` ; `draftIds` pendant un ordre en cours |
| Ligne | image, nom, description, adresse, visible | `imageUrl`, `name`, `description`, `slug`, `isVisible` |
| Création | aperçu de l'adresse | `slugify(nom saisi)` |
| Contrôle du nom | « trop proche de X » | `slugify` du nom saisi comparé à `slugify(name)` des autres catégories en cache |
| Contrôle de l'adresse | « déjà utilisée par X » | `slug` des autres catégories en cache |
| Modification | champs envoyés | `toCategoryPatch(copie figée à l'ouverture, valeurs)` |
| Visibilité | nouvel état | interrupteur ; `PATCH { isVisible }` |
| Ordre | identifiants envoyés | `draftIds`, qui contient toujours tous les identifiants de la liste du serveur |
| Annonce d'ordre | position et total | index dans `draftIds` + 1, `draftIds.length` |
| Suppression refusée | nombre de séries | `seriesCount` du corps du `409` |
| Image | règles, textes | `IMAGE_SLOTS.category` ; mutations de l'image de catégorie |
| Formulaire de série | choix des catégories | cache partagé `categoriesKeys.all` |

### Key invariants

- Un envoi d'ordre contient toujours exactement les identifiants de la dernière liste lue, chacun une fois.
- Aucune écriture (création, modification, visibilité, suppression) pendant un ordre en cours.
- Un `PATCH` n'envoie que les champs changés ; il n'envoie l'adresse que si l'admin l'a ouverte et modifiée.
- La règle `slugify` du dashboard est identique à celle du backend ; le backend reste juge (`409`, `400`).
- Une fonctionnalité n'importe jamais une autre : les briques communes vivent dans `src/shared/`.

### Security model

Toutes les routes d'écriture et `GET /categories/all` sont réservées aux admins par le backend (`403` sinon) ; le dashboard passe par le client partagé. Pas de donnée personnelle. Le texte saisi (nom, description) est affiché par React, jamais injecté en HTML.

### Configuration required

Aucune variable nouvelle, aucune dépendance nouvelle. **Prérequis pour les essais réels** : l'API locale (`noli-backend/.env`, `MONGODB_URI`) doit pointer sur une base séparée de la production ; aujourd'hui elle partage le cluster et la base de production.

### Erreurs (dans cet ordre)

- Contrôles du navigateur (AC-3, AC-5) : avant tout appel.
- `409` : nom ou adresse (AC-3, AC-5) ; `CATEGORY_IN_USE` (AC-8) ; image (spec 0007).
- `400` : adresse ou nom réservé, nom sans lettre ni chiffre → message du champ ; tout `400` sur l'ordre → AC-7 ; autre `400` dans la fenêtre → `applyFieldErrors` (spec 0002).
- `404` : suppression → AC-8 ; modification, visibilité, image → « Cette catégorie n'existe plus. », fenêtre fermée, liste relue.
- `429`, `503` sur l'image : textes de la spec 0007.
- Le reste : `notifyError` (spec 0002) ; fin de session silencieuse.

### Critical test scenarios

- Page : ordre du serveur, badge « Masquée », miniature ou icône, état vide, erreur avec « Réessayer », verifies **AC-1**.
- Création : « Comédie romantique » → aperçu `/comedie-romantique`, `POST` avec `name`, `description`, `isVisible`, ligne ajoutée en fin, verifies **AC-2**.
- Nom : vide, 51 caractères, « !!! », « All », « comedie » après « Comédie » → messages, aucun appel ; `409` simulé → message, verifies **AC-3**.
- Modification : seul le nom → `{ name }` ; description vidée → `{ description: null }`, verifies **AC-4**.
- Adresse : « Comedie Romantique », « order », adresse de « Drame » → messages ; une adresse valide part dans le `PATCH`, verifies **AC-5**.
- Visibilité : masquer avec confirmation, réafficher sans ; échec → interrupteur revenu, verifies **AC-6**.
- Ordre : descendre la première, monter la dernière, bandeau, actions désactivées, `PUT` avec tous les ids, « Annuler » sans appel, `400` → liste relue, verifies **AC-7**.
- Suppression : confirmation, `409 CATEGORY_IN_USE` avec `seriesCount: 3` puis « Masquer plutôt », `404`, verifies **AC-8**.
- Image : partie « Image » de la fenêtre, envoi et retrait, miniature dans le tableau, verifies **AC-9**.
- Cache : une catégorie créée apparaît dans le choix du formulaire de série sans recharger, verifies **AC-10**.
- Protections et accessibilité : fenêtre modifiée + Échap, ordre en cours + navigation, focus et annonce après un déplacement, verifies **AC-11**, **AC-12**.

## Build plan

Approche Tracer Bullet : d'abord le fil le plus mince de bout en bout (lister et créer sur la vraie API), puis on l'épaissit.

1. Déplacer dans `src/shared/` (commit à part) l'emplacement d'image et ses règles (type de mutations générique, texte de `404` par emplacement, emplacement `category`), la protection de la page, la liste des catégories en cache (`categorySchema`, `categoriesKeys`, `useAllCategories`), la clé de la liste des séries, et les réponses simulées de `GET /categories/all` ; mettre à jour les imports et les `vi.mock` des séries ; tous les tests existants passent, plus le test de non régression du formulaire de série, satisfies **AC-9**, **AC-10**, **AC-11**.
2. `categoryRules.ts` et `categoryOrder.ts` avec leurs tests unitaires, satisfies **AC-3**, **AC-5**, **AC-7**.
3. Page `/categories`, entrée du menu, tableau en lecture, puis création de bout en bout (fenêtre, contrôles du nom, `POST`, ligne ajoutée), satisfies **AC-1**, **AC-2**, **AC-3**, **AC-10**.
4. Modification (fenêtre préremplie, `PATCH` des champs changés, adresse modifiable à part) et interrupteur de visibilité avec confirmation, satisfies **AC-4**, **AC-5**, **AC-6**.
5. Ordre : boutons, bandeau, actions désactivées, `PUT`, `400` ; suppression avec « Suppression impossible » et « Masquer plutôt », satisfies **AC-7**, **AC-8**.
6. Image dans la fenêtre et miniature du tableau ; protections, accessibilité, écran étroit ; tests d'intégration MSW, satisfies **AC-9**, **AC-11**, **AC-12**, **AC-13**.
7. Base locale séparée de la production (prérequis, par l'engineer), essais réels en local, mise en ligne du dashboard (confirmation avant de pousser), contrôle en production en lecture seule, satisfies **AC-14**.

## Consequences

**Positive**:
- Les admins gèrent les catégories sans Swagger, avec les mêmes garde fous que le backend, expliqués en français.
- L'emplacement d'image, la protection de la page et la liste des catégories deviennent des briques partagées, réutilisables par les prochaines fonctionnalités.
- Aucun changement backend : la mise en ligne ne touche que le dashboard.

**Negative / tradeoffs**:
- Le déplacement vers `src/shared/` touche des fichiers des séries déjà livrés : un risque de régression, couvert par la suite de tests existante.
- Les boutons monter et descendre sont lents pour déplacer une catégorie de bout en bout d'une longue liste (acceptable pour une vingtaine).
- Le tableau ne montre pas combien de séries utilisent chaque catégorie : le backend ne le fournit qu'au refus de suppression.
- Les étiquettes de catégorie des fiches de série déjà en cache ne se mettent à jour qu'à leur prochaine lecture.
- Sans version côté backend, un ordre enregistré écrase sans le dire l'ordre qu'un autre admin aurait enregistré entre temps sur la même liste de catégories ; acceptable pour 1 à 3 admins.
- Comme le backend, `normalize('NFD')` ne décompose pas certaines lettres (`œ`, `ß`, `ø`) : elles deviennent des tirets dans la forme et l'adresse. Un test de parité (« Œuvre », « Ça va », « 日本 », qui donne une forme vide) garde les deux règles identiques.

**Neutral**:
- La règle `slugify` existe en deux exemplaires (backend et dashboard) ; un changement côté backend doit être reporté.
- Pas d'image à la création d'une catégorie : on l'ajoute par « Modifier ».

## Follow-up

- [ ] Prérequis : donner à l'API locale une base séparée de la production avant tout essai réel (voir Configuration required).
- [ ] Si utile : une colonne « Séries » (nombre de séries par catégorie), qui demande au backend d'exposer ce nombre dans `GET /categories/all`.
- [ ] Si la liste grandit beaucoup : glisser déposer pour l'ordre, en plus des boutons.
