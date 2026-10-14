# 0005. Fiche série : créer, modifier et supprimer une série

**Date**: 2026-10-14
**Status**: Proposed

## Summary

Les admins peuvent maintenant créer une série, la modifier sur sa fiche et la supprimer. Tout se passe sur deux pages dédiées : `/series/nouvelle` pour créer, `/series/:id` pour la fiche, avec un seul formulaire toujours modifiable qui contient aussi les réglages premium. Un titre déjà pris s'affiche sous le champ, les changements non enregistrés sont protégés, et la suppression (définitive, avec épisodes, vidéos, images et historique) demande de retaper le titre. Un petit changement du backend vient d'abord : la réponse admin d'une série doit garder ses catégories masquées. La fonctionnalité se termine par la mise en ligne, contrôlée en lecture seule sur la production.

## Requirements

**User stories**:
- En tant qu'admin, je veux créer une série avec ses informations, ses catégories et son accès premium, pour la publier dans le catalogue.
- En tant qu'admin, je veux ouvrir la fiche d'une série et corriger ses informations, pour garder le catalogue juste.
- En tant qu'admin, je veux régler si une série est payante et combien d'épisodes restent gratuits, pour gérer l'offre premium.
- En tant qu'admin, je veux supprimer une série sans risque de me tromper, parce que la suppression efface tout et ne se rattrape pas.

**Acceptance criteria**:
- **AC-1**: Sur `/series`, l'en tête a un bouton « Nouvelle série » qui mène à `/series/nouvelle`, et chaque titre de série est un lien vers sa fiche `/series/:id`.
- **AC-2**: `/series/nouvelle` affiche le formulaire de série : Titre, Description, Catégories, Statut (« En cours » par défaut), Langues, Pays, Année de sortie, et une section « Accès » avec « Série premium » (décochée) et « Épisodes gratuits » (0), ce dernier champ n'étant visible que si la série est premium.
- **AC-3**: À l'envoi, un formulaire invalide montre des messages en français sous les champs concernés, place le focus sur le premier champ invalide, et n'appelle pas l'API (titre requis et 100 caractères au plus, description 2 000 au plus, au moins une catégorie, année entière de 1888 à 2100, code de langue invalide, épisodes gratuits entier de 0 à 10 000).
- **AC-4**: Une création valide envoie `POST /series` avec les seuls champs remplis, puis mène sur la fiche de la nouvelle série avec la notification « Série créée. » ; la liste des séries est rechargée à la prochaine visite.
- **AC-5**: Un titre déjà pris (réponse `409`) affiche « Ce titre est déjà utilisé par une autre série. » sous le champ Titre, à la création comme à la modification, sans changer de page et sans perdre la saisie.
- **AC-6**: `/series/:id` charge la série (`GET /series/:id/admin`) et affiche : le titre de la série en en tête, un lien « Retour aux séries » vers la page de liste d'où l'on vient, la couverture en aperçu (ou le bloc par défaut), le nombre d'épisodes, la note, les dates de création et de modification, et le formulaire prérempli. Pendant le chargement, un squelette s'affiche ; une erreur affiche `ErrorState` avec « Réessayer » ; une série inconnue, ou un identifiant mal formé (sans appel à l'API), affiche « Série introuvable » avec un lien vers la liste.
- **AC-7**: Sur la fiche, « Enregistrer » n'est actif que s'il y a des changements. L'envoi part en `PATCH /series/:id` avec les seuls champs modifiés ; seuls ces champs sont validés, si bien qu'une valeur existante non modifiée (même hors des règles de l'AC-3) n'empêche jamais l'enregistrement ; en cas de succès, « Modifications enregistrées. » s'affiche, le formulaire repart des valeurs renvoyées, l'en tête montre le nouveau titre et la liste est rechargée à la prochaine visite.
- **AC-8**: Dans la section « Accès », cocher « Série premium » fait apparaître « Épisodes gratuits » avec l'indication « La série a actuellement N épisodes. » ; la valeur peut dépasser N ; décocher masque le champ sans perdre sa valeur, et seuls `isPremium` et, s'il a changé, `freeEpisodeCount` sont envoyés.
- **AC-9**: Le sélecteur Catégories propose toutes les catégories (`GET /categories/all`), avec « (masquée) » après le nom d'une catégorie masquée, permet la recherche et en exige au moins une. Sur la fiche, les catégories masquées de la série sont préremplies et marquées de la même façon, et restent liées à la série tant que l'admin ne les retire pas. Si la liste ne se charge pas, un message avec « Réessayer » remplace le sélecteur et l'enregistrement reste impossible.
- **AC-10**: Le champ Langues affiche des noms français suivis du code (« Français (fr) », « Fon (fon) ») et envoie les codes. Il propose une liste de suggestions et accepte un autre code de 2 ou 3 lettres minuscules ; une valeur existante hors liste ou hors format (par exemple « French ») s'affiche telle quelle et est conservée si l'admin n'y touche pas.
- **AC-11**: Le champ Pays est une liste de pays en français avec recherche, l'Afrique en premier, qui envoie le nom (« Bénin », « Côte d’Ivoire »). Il peut être vidé ; une valeur existante absente de la liste reste affichée et conservée.
- **AC-12**: Avec des changements non enregistrés, quitter la page dans le dashboard ouvre « Quitter sans enregistrer ? » (« Rester » ou « Quitter ») ; fermer ou recharger l'onglet déclenche l'alerte du navigateur. Aucune question n'est posée après une création, un enregistrement ou une suppression réussis, ni pour une redirection vers `/connexion` (fin de session).
- **AC-13**: En bas de la fiche, la zone « Supprimer la série » ouvre une fenêtre qui liste ce qui sera effacé (épisodes et vidéos, couverture et bannière, historique de visionnage des spectateurs) ; « Supprimer définitivement » ne s'active qu'une fois le titre exact retapé. En cas de succès, l'admin arrive sur `/series` avec « Série supprimée. » ; une série déjà supprimée (`404`) mène au même endroit avec « Cette série avait déjà été supprimée. » ; toute autre erreur garde la fenêtre ouverte avec le message d'erreur.
- **AC-14**: Pendant un envoi (création, enregistrement, suppression), le bouton montre un chargement et un second clic n'envoie rien. Les autres erreurs suivent la spec 0002 : `400` sous le champ concerné quand il est reconnu, sinon une notification ; réseau, délai dépassé et `5xx` en notification. Une série supprimée entre temps (`404` à l'enregistrement) affiche « Cette série n'existe plus. » avec un lien vers la liste.
- **AC-15**: Chaque champ a un libellé, chaque message d'erreur est relié à son champ, tout se fait au clavier, et les titres de l'onglet sont « Nouvelle série · Noli Admin » et « <titre de la série> · Noli Admin ».
- **AC-16**: La fonctionnalité est en ligne sur `https://admin.nollli.com` ; l'engineer y ouvre la fiche d'une série existante et vérifie son contenu, sans créer, modifier ni supprimer de série en production.

## Decision

**Chosen option**: Option 1 : pages dédiées avec un formulaire unique `@mantine/form` et Zod, enregistré par `PATCH` des seuls champs modifiés

Un petit changement du backend (`noli-backend`) fait d'abord renvoyer à la réponse admin toutes les catégories de la série, masquées comprises. La création et la fiche partagent un seul composant de formulaire dans `src/features/series/`, lu et écrit par TanStack Query à travers `apiRequest` ; la suppression passe par une fenêtre propre à la fonctionnalité qui demande le titre.

**Implementation skills**: `mantine-form` (`mantinedev/skills`, `.agents/skills/mantine-form/`) · `mantine-combobox` (`mantinedev/skills`, `.agents/skills/mantine-combobox/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Le raisonnement et les options comparées sont dans [rationale.md](rationale.md).

## Feature design

### Source du design

`design.md` et la vitrine `/dev/composants` (spec 0003). Aucune nouvelle couleur ni police : seulement Mantine et `src/shared/ui/`. Un nouveau couple de couleurs est mesuré dans les deux modes avant d'être utilisé.

### Prérequis backend (`noli-backend`)

Aujourd'hui, la réponse admin d'une série perd ses catégories masquées. Les requêtes admin peuplent `categoryIds` avec `CATEGORY_POPULATE`, qui filtre `isVisible: true` (`src/series/content-access.ts`), puis `toPublicSeries` ne garde que les catégories peuplées. Une série dans une catégorie masquée arriverait donc sans elle sur la fiche, et un enregistrement des catégories l'effacerait.

**Changement :** les réponses admin, et seulement elles, renvoient `categories: [{ _id, name, slug, isVisible }]` avec **toutes** les catégories de la série, masquées comprises. Cela vaut pour `GET /series/:id/admin`, `POST /series`, `PATCH /series/:id` et `PATCH /series/:id/access`, c'est à dire celles qui passent par `toAdminSeries`. Les réponses publiques (liste, recherche, détail public, app mobile) ne changent pas. Le changement est livré avec ses tests dans `noli-backend`, puis l'API est redéployée avant la mise en ligne du dashboard.

### Routes

```
RequireSession (spec 0004)
  AppLayout
    /series             SeriesListPage (spec 0004), plus le bouton et les liens
    /series/nouvelle    SeriesCreatePage
    /series/:id         SeriesDetailPage
```

- **Identifiant :** `:id` doit correspondre à `/^[0-9a-f]{24}$/i` (identifiant MongoDB). Sinon la page affiche « Série introuvable » sans appeler l'API.
- L'entrée de menu « Séries » reste active sur `/series/nouvelle` et `/series/:id`, puisque `NavLink` correspond par préfixe.

### Changements dans la liste (spec 0004)

- `PageHeader` reçoit l'action « Nouvelle série » : un `Button` (icône `IconPlus`) rendu comme un lien vers `/series/nouvelle`.
- Le titre de chaque ligne devient un `Anchor` du routeur vers `/series/:id`, avec l'état de navigation `{ from: pathname + search }` de la liste.
- **Destination de « Retour aux séries » :** `from` de l'état de navigation, accepté seulement si c'est une chaîne qui commence par `/series` et ne contient ni `//` ni `\` ; sinon `/series` (fonction pure `backToListPath`).
- La vignette reste décorative et n'est pas cliquable : un seul lien par ligne.

### Page de création (`SeriesCreatePage`)

- `PageHeader` « Nouvelle série », sans description, avec le lien « Retour aux séries » au dessus (même règle de destination que la fiche).
- Le formulaire `SeriesForm` en mode `create`, avec les valeurs de départ : titre et description vides, aucune catégorie, statut `ongoing`, aucune langue, pas de pays, pas d'année, `isPremium` faux, `freeEpisodeCount` 0.
- Le bouton s'appelle « Créer la série ». Pendant l'envoi, son nom accessible devient « Création en cours ».
- **Succès :** `allowLeave`, puis `navigate('/series/' + id, { state: { from } })` (le `from` reçu par la page de création est transmis), puis `notifySuccess('Série créée.')`, et `invalidateQueries({ queryKey: ['series', 'list'] })`. La réponse est aussi posée dans le cache de la fiche (`['series', 'detail', id]`) ; avec le `staleTime` de la fiche, elle s'affiche sans second appel.

### Fiche (`SeriesDetailPage`)

- **Données :** `useQuery({ queryKey: ['series', 'detail', id], queryFn: GET /series/:id/admin, staleTime: 30 secondes, refetchOnWindowFocus: false })`, avec le schéma `adminSeriesSchema`. Le formulaire porte `key={id}`, pour repartir de zéro quand on passe d'une série à une autre.
- **En tête :**
  - le lien « Retour aux séries » (`IconArrowLeft`) au dessus ;
  - `PageHeader` avec le titre **enregistré** (celui des données, pas celui du formulaire en cours de saisie).
- **Bloc « Aperçu » :** une `Paper withBorder` avec :
  - la couverture en 2:3 (120 × 180 px, `alt=""`) ou le bloc par défaut avec `IconPhoto` de la liste ;
  - « Épisodes » : `totalEpisodes` ;
  - « Note » : « 8,4 (120) », ou « — » sans vote, avec `formatRating` comme la liste ;
  - « Créée le » : `formatDateTime(createdAt)` ;
  - « Modifiée le » : `formatDateTime(updatedAt)`.
- **Le formulaire** `SeriesForm` en mode `edit`, avec le bouton « Enregistrer », dont le nom accessible devient « Enregistrement en cours » pendant l'envoi.
- **Zone « Supprimer la série »** en bas : une `Paper withBorder` avec une bordure `noliRed`, le titre « Supprimer la série », une phrase sur le caractère définitif, et le bouton « Supprimer la série » (`color="noliRed.8"`).
- **États :**
  - chargement : un squelette (deux `Skeleton` de la hauteur de l'aperçu et du formulaire) ;
  - erreur : `ErrorState` avec « Réessayer » ;
  - `404`, ou identifiant mal formé : un `EmptyState` « Série introuvable », avec la description « Elle a peut être été supprimée. » et un bouton lien « Retour aux séries ».
- **Titre de l'onglet :** `usePageTitle(titre enregistré)` ; « Série · Noli Admin » pendant le chargement.

### Formulaire (`SeriesForm`, partagé par la création et la fiche)

`useForm` en mode `uncontrolled`, avec `validate: schemaResolver(makeSeriesFormSchema({ mode, initialReleaseYear }), { sync: true })` et `<form noValidate>`. La fabrique `makeSeriesFormSchema` (dans `src/features/series/seriesFormSchema.ts`) porte les règles qui dépendent du mode : la règle de l'année en modification, et la règle des épisodes gratuits qui ne s'applique que si `isPremium` est vrai (`superRefine`). Le formulaire est découpé en deux `Paper withBorder` : « Informations » et « Accès ».

| Champ | Composant | Valeur du formulaire | Règle |
|---|---|---|---|
| Titre | `TextInput`, obligatoire | `title: string` | espaces retirés au début et à la fin ; 1 à 100 caractères ; « Titre requis. », « 100 caractères au plus. » |
| Description | `Textarea` autosize, de 4 à 12 lignes, compteur « N / 2 000 » | `description: string` | 2 000 caractères au plus ; « 2 000 caractères au plus. » |
| Catégories | `MultiSelect` searchable | `categoryIds: string[]` | au moins une ; « Choisissez au moins une catégorie. » |
| Statut | `SegmentedControl` (« En cours », « Terminée ») | `status: 'ongoing' \| 'completed'` | toujours une valeur ; un statut absent ou inconnu dans les données vaut `ongoing` comme valeur de départ, sans compter comme un changement |
| Langues | `LanguagesInput` (Combobox Mantine, pastilles) | `languages: string[]` (codes) | chaque code correspond à `/^[a-z]{2,3}$/` ; « Code de langue invalide (2 ou 3 lettres minuscules). » |
| Pays | `Select` searchable et clearable, deux groupes | `country: string` (vide si aucun) | une valeur de la liste, ou la valeur existante |
| Année de sortie | `NumberInput` sans décimale, de 1888 à 2100 | `releaseYear: number \| ''` | entier ; une saisie non entière ou hors limites donne « Année entre 1888 et 2100. » ; en modification, si l'année était renseignée, la vider donne « L'année ne peut pas être retirée, seulement modifiée. » |
| Série premium | `Switch` | `isPremium: boolean` | aucune |
| Épisodes gratuits | `NumberInput` sans décimale, de 0 à 10 000, visible si `isPremium` | `freeEpisodeCount: number` | « Nombre entier de 0 à 10 000. » ; description « La série a actuellement N épisodes. » |

- **Focus :** à un envoi invalide, le focus va sur le premier champ en erreur, dans l'ordre du tableau (`onSubmit(..., handleErrors)` avec `form.getInputNode`, sinon `document.getElementById`). `LanguagesInput` et le `Select` des pays transmettent la `ref` de `getInputProps` et portent un `id` stable.
- **Textes :** le titre, la description et le pays sont débarrassés des espaces au début et à la fin avant validation et envoi ; un champ fait seulement d'espaces compte comme vide.
- **Validation en modification :** seuls les champs modifiés sont validés (les erreurs des champs inchangés sont ignorées dans `handleErrors` et avant l'envoi). Une valeur existante hors règles (un titre de plus de 100 caractères, une langue « French », une année décimale) reste donc affichée et n'est ni revalidée ni renvoyée tant que l'admin n'y touche pas. La règle « au moins une catégorie » s'applique dès que le champ Catégories est modifié.
- **Changements suivis en direct :** le mode `uncontrolled` ne redessine pas le composant à la frappe. `onValuesChange` recopie donc les valeurs dans un état local `currentValues`, qui alimente l'activation d'« Enregistrer », la protection des changements non enregistrés et la visibilité des épisodes gratuits.
- **Envoi unique :** un drapeau `useRef` « envoi en cours » est posé avant `mutate` et retiré à la fin ; un second envoi dans le même instant ne part pas.
- **Champ masqué :** `freeEpisodeCount` garde sa valeur quand `isPremium` est décoché ; sa règle ne s'applique que si `isPremium` est vrai.
- **Création, ce qui est envoyé :**
  - toujours `title` nettoyé, `categoryIds`, `status`, `isPremium` et `freeEpisodeCount` (ce dernier vaut 0 si la série n'est pas premium) ;
  - `description`, `country` et `releaseYear` seulement s'ils sont remplis ;
  - `languages` seulement s'il n'est pas vide ;
  - jamais `null`.
- **Modification (`toSeriesPatch`, fonction pure dans `src/features/series/seriesPayload.ts`) :**
  - on compare chaque champ, normalisé, à la **base** du formulaire, c'est à dire les valeurs tirées de la dernière réponse du backend (le chargement, puis chaque enregistrement réussi), et seuls les champs différents partent ;
  - `title` est comparé sans les espaces du début et de la fin ;
  - `categoryIds` et `languages` sont comparés comme des ensembles, triés ;
  - une `description` vidée part comme `null`, un `country` vidé aussi ;
  - `releaseYear` ne part jamais vide (règle ci dessus) ;
  - `freeEpisodeCount` ne part que s'il a changé, que la série soit premium ou non.
  - Aucun champ modifié : le bouton est désactivé (`toSeriesPatch(base, currentValues)` vide).
- **Après un enregistrement :**
  - `form.setInitialValues` et `form.reset()` avec les valeurs tirées de la réponse ;
  - `setQueryData(['series', 'detail', id], réponse)` ;
  - `invalidateQueries(['series', 'list'])` ;
  - `notifySuccess('Modifications enregistrées.')`.
- **Initialisation :** le formulaire de la fiche est initialisé une seule fois par identifiant, à l'arrivée des données. Un rechargement en arrière plan met à jour l'aperçu et l'en tête, jamais le formulaire.

### Catégories

- **Données :** `useQuery({ queryKey: ['categories', 'all'], queryFn: GET /categories/all, staleTime: 5 minutes })`, avec le schéma `{ categories: [{ _id, name, isVisible }] }` (les autres champs sont ignorés).
- **Options :** `{ value: _id, label: isVisible ? name : name + ' (masquée)' }`, dans l'ordre reçu.
- **Valeur de départ sur la fiche :** les `_id` de `series.categories`, qui contient les catégories masquées grâce au prérequis backend. Une catégorie liée à la série ne peut pas être supprimée par le backend (`409 CATEGORY_IN_USE`), elle est donc toujours dans la liste reçue.
- **États :**
  - pendant le chargement, le sélecteur est désactivé avec « Chargement des catégories… » ;
  - en erreur, une `Alert` « Impossible de charger les catégories. » avec « Réessayer » remplace le sélecteur, et l'envoi du formulaire reste bloqué par la règle « au moins une catégorie ».

### Langues (`LanguagesInput`, `src/features/series/LanguagesInput.tsx`)

- **Composant :** Combobox Mantine avec `PillsInput` (skill `mantine-combobox`).
- **Affichage :** chaque pastille montre « Nom (code) ». Le nom vient de `LANGUAGE_SUGGESTIONS`, sinon de `new Intl.DisplayNames(['fr'], { type: 'language' }).of(code)` quand il diffère du code, sinon le code seul. L'appel à `Intl.DisplayNames` est entouré d'un `try` : une valeur ancienne qui n'est pas un code valide (par exemple « French ») lève une erreur, et s'affiche alors telle quelle, sans « (code) ».
- **`LANGUAGE_SUGGESTIONS`** (dans `src/features/series/languages.ts`, dans cet ordre) : `fr` Français, `en` Anglais, `fon` Fon, `yo` Yoruba, `ha` Haoussa, `wo` Wolof, `bm` Bambara, `ee` Éwé, `tw` Twi, `dyu` Dioula, `mos` Mooré, `ff` Peul, `ln` Lingala, `sw` Swahili, `ar` Arabe, `pt` Portugais.
- **Recherche :** taper filtre les suggestions sur le nom ou le code, en ignorant les accents et la casse.
- **Ajout d'un code hors liste :** si la saisie nettoyée et mise en minuscules correspond à `/^[a-z]{2,3}$/` et n'est ni suggérée ni déjà choisie, une option « Ajouter le code « xx » » apparaît.
- **Clavier :** Entrée choisit l'option active, Retour arrière sur une saisie vide retire la dernière pastille, et chaque pastille a un bouton de retrait nommé « Retirer <nom> ».
- **Doublons :** un code n'apparaît qu'une fois.

### Pays (`src/features/series/countries.ts`)

- `AFRICAN_COUNTRY_CODES` : les 54 codes ISO 3166 alpha 2 des pays d'Afrique.
- `OTHER_COUNTRY_CODES` : les autres codes ISO 3166 alpha 2 officiellement attribués, territoires compris, soit 249 codes au total avec l'Afrique. Un test vérifie le nombre de codes et l'absence de doublon, et seulement deux noms (« Bénin », « Côte d’Ivoire »), car les autres noms varient selon la version d'ICU (la base de traduction du navigateur).
- **Noms :** `new Intl.DisplayNames(['fr'], { type: 'region' }).of(code)` (dans un `try`, avec le code comme nom de secours), ce qui donne par exemple « Bénin » et « Côte d’Ivoire » avec l'apostrophe typographique, comme les données de production.
- **Tri :** chaque groupe est trié par nom avec `localeCompare('fr')`.
- **Groupes du `Select` :** « Afrique », puis « Autres pays ». La valeur envoyée est le nom.
- **Valeur hors liste :** une valeur existante absente de la liste (par exemple « USA ») est ajoutée en tête, dans un groupe « Valeur actuelle », pour rester affichée et conservée. Elle n'est ajoutée que si aucun nom de la liste ne lui est identique, car le `Select` de Mantine refuse les doublons.

### Changements non enregistrés

- `useBlocker` de React Router, sous sa forme fonction `({ nextLocation }) => …`. Il bloque quand le formulaire a des changements (`toSeriesPatch(base, currentValues)` non vide sur la fiche, `form.isDirty()` suivi par `currentValues` à la création), que l'envoi n'est pas en cours, et qu'aucune exception ne s'applique.
- **Exceptions :**
  - `nextLocation.pathname === '/connexion'` (fin de session, spec 0004 ; les changements sont alors perdus, c'est accepté) ;
  - la navigation suit un succès : un drapeau `allowLeave` (un `useRef`) est posé juste avant `navigate` ;
  - le lien « Retour aux séries » de l'alerte « Cette série n'existe plus. » (la série n'existe plus, rien n'est à garder).
- **Fenêtre :** quand le blocage se déclenche, une modale Mantine « Quitter sans enregistrer ? » s'ouvre, avec le texte « Vos changements seront perdus. » et deux boutons :
  - « Rester » (focus par défaut) appelle `blocker.reset()` ;
  - « Quitter » (`noliRed.8`) appelle `blocker.proceed()`.
- **Onglet :** un écouteur `beforeunload` est actif dans les mêmes conditions. Le texte de l'alerte est celui du navigateur.

### Suppression (`DeleteSeriesModal`, `src/features/series/DeleteSeriesModal.tsx`)

- **Ouverture :** la `Modal` Mantine s'ouvre depuis la zone « Supprimer la série », avec le titre « Supprimer « <titre> » ? ».
- **Contenu :**
  - le texte « Cette action est définitive. Seront effacés : » ;
  - la liste « ses N épisodes et leurs vidéos », « sa couverture et sa bannière », « l'historique de visionnage des spectateurs pour cette série » ;
  - puis un `TextInput` « Tapez le titre de la série pour confirmer », avec le titre affiché en gras au dessus.
- **Boutons :** « Annuler » (focus par défaut) et « Supprimer définitivement » (`noliRed.8`). Ce dernier est actif seulement si la saisie est égale au titre enregistré après la même normalisation des deux côtés : forme Unicode NFC, espaces (y compris insécables) regroupés en un seul, espaces du début et de la fin retirés. La casse et les accents doivent être identiques.
- **Envoi :** `useMutation` sur `DELETE /series/:id`. Pendant l'envoi, les deux boutons et la fermeture sont désactivés.
- **Succès, ou `404` :**
  - `allowLeave` ;
  - `removeQueries(['series', 'detail', id])` ;
  - `invalidateQueries(['series', 'list'])` ;
  - `navigate('/series', { replace: true })` ;
  - la notification « Série supprimée. », ou « Cette série avait déjà été supprimée. » pour un `404`.
- **Autre erreur :** une `Alert` `noliRed` dans la fenêtre affiche `toUserMessage(error).message`. La fenêtre reste ouverte, avec la saisie conservée. Pour une erreur `5xx`, le texte est « La suppression n'a pas abouti. Réessayez : ce qui a déjà été effacé ne sera pas recréé. », car le backend efface les vidéos avant la série.

### Erreurs de formulaire

Les erreurs sont traitées dans cet ordre.

- **`409` sans code** (le backend lève un `ConflictException` sans code), traité **avant** `applyFieldErrors`, qui écrirait sinon « Déjà utilisé. » : `form.setFieldError('title', 'Ce titre est déjà utilisé par une autre série.')`, et le focus va sur Titre.
- **`400` :** `applyFieldErrors(form, error, { title: 'title', description: 'description', categoryIds: 'categor', languages: 'language', country: 'country', releaseYear: 'year', freeEpisodeCount: 'freeEpisode', isPremium: 'premium' })` (spec 0002). La première correspondance l'emporte ; un champ reconnu affiche « Valeur invalide. » (texte de la spec 0002). Un `400` « Unknown category ids » relance aussi la requête des catégories.
- **`404` à l'enregistrement :** une `Alert` `noliRed` au dessus du formulaire affiche « Cette série n'existe plus. » avec le lien « Retour aux séries ».
- **Autres erreurs :** `notifyError(error)` (spec 0002).
- Un second envoi pendant un envoi en cours ne fait rien (`if (mutation.isPending) return`, et le bouton est en `loading`).

### Data model sketch

Aucun stockage propre au dashboard : la série vit dans MongoDB, côté backend.

| Champ (API) | Type | Création | Modification | Lecture seule sur la fiche |
|---|---|---|---|---|
| `_id` | identifiant (24 hexa) | renvoyé | dans l'adresse | |
| `title` | texte, unique | requis | si changé | |
| `description` | texte ou `null` | si rempli | si changé (`null` si vidé) | |
| `categoryIds` | identifiants (N:M avec les catégories) | requis, au moins un | si changé | |
| `status` | `ongoing` ou `completed` | toujours | si changé | |
| `languages` | codes ISO 639 | si non vide | si changé | |
| `country` | nom français ou `null` | si rempli | si changé (`null` si vidé) | |
| `releaseYear` | entier de 1888 à 2100 | si rempli | si changé, jamais vidé | |
| `isPremium` | booléen | toujours | si changé | |
| `freeEpisodeCount` | entier ≥ 0 | toujours | si changé | |
| `coverImage` | URL ou `null` | | | aperçu |
| `totalEpisodes`, `rating`, `votes` | nombres | | | chiffres clés |
| `createdAt`, `updatedAt` | dates ISO | | | dates |
| `categories` | `[{ _id, name, slug, isVisible }]`, masquées comprises (prérequis backend) | | | valeurs de départ du sélecteur |

**Schéma Zod `adminSeriesSchema`** (`src/features/series/schemas.ts`), tolérant comme `seriesSummarySchema` (spec 0004). Il en reprend les champs, et ajoute :
- `description`, `country` et `bannerImage` : `z.string().nullish()` ;
- `languages` : `z.array(z.string()).nullish()`, `null` ou absent devenant `[]` ;
- `releaseYear` : `z.number().int().nullish()` ;
- `createdAt` : `z.string().nullish()` ;
- `categories` : `z.array(z.object({ _id, name, isVisible: z.boolean().nullish() }))`, `isVisible` absent valant vrai.

Les épisodes (`episodes[]`, parfois volumineux) ne sont pas déclarés : Zod les retire, et ils ne restent pas dans le cache.

Les réponses sont :
- `{ series }` pour `GET /series/:id/admin`, `POST /series` et `PATCH /series/:id`, chacune avec un `message` ignoré ;
- `{ message }` pour `DELETE /series/:id`.

### State transitions

Pas de machine à états côté dashboard. Le formulaire passe de « propre » à « modifié », puis à « en envoi », et revient à « propre » après un succès. Le statut éditorial (`ongoing`, `completed`) est libre dans les deux sens.

### API surface

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/series` | POST | `title` (req), `categoryIds` (req, ≥ 1), `status`, `isPremium`, `freeEpisodeCount`, `description`, `languages`, `country`, `releaseYear` (opt) | `series` | bearer admin | `409` titre pris, `400` champ invalide ou catégorie inconnue |
| `/series/:id/admin` | GET | `id` | `series` (avec les épisodes, ignorés ici) | bearer admin | `404` |
| `/series/:id` | PATCH | les champs modifiés seulement | `series` | bearer admin | `409` titre pris, `400`, `404` |
| `/series/:id` | DELETE | `id` | `message` | bearer admin | `404` (traité comme déjà supprimée) |
| `/categories/all` | GET | aucun | `categories[]` | bearer admin | réseau, `5xx` |

`PATCH /series/:id/access` n'est pas utilisé : `PATCH /series/:id` accepte `isPremium` et `freeEpisodeCount`. Après le prérequis backend, `series.categories` contient toutes les catégories de la série, avec `isVisible`, dans les quatre réponses admin.

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Liste | lien de la fiche | `_id` de la ligne |
| Liste → fiche | page de retour | état de navigation `from` posé par le lien du titre, filtré par `backToListPath` ; à défaut `/series` ; transmis de la création à la nouvelle fiche |
| Création | valeurs de départ | constantes de ce spec (statut `ongoing`, non premium, 0) |
| Création | identifiant de la nouvelle fiche | `series._id` de la réponse `POST /series` |
| Fiche | titre de l'en tête et de l'onglet | `series.title` des données enregistrées |
| Fiche | couverture, épisodes, note, dates | `coverImage`, `totalEpisodes`, `rating` et `votes`, `createdAt` et `updatedAt` de `GET /series/:id/admin` |
| Fiche | valeurs de départ du formulaire | la même réponse ; `categories[]._id` (masquées comprises, prérequis backend) donne `categoryIds` ; `null` devient chaîne vide ou `[]` ; statut absent devient `ongoing` |
| Fiche | base de comparaison | valeurs tirées de la dernière réponse (chargement, puis chaque enregistrement réussi) |
| Catégories | mention « (masquée) » d'une catégorie de la série | `series.categories[].isVisible` |
| Accès | « N épisodes » de l'indication | `totalEpisodes` de la série (0 à la création) |
| Catégories | options et mention « (masquée) » | `GET /categories/all`, champs `name` et `isVisible` |
| Langues | noms affichés | `LANGUAGE_SUGGESTIONS`, sinon `Intl.DisplayNames` en `fr`, sinon le code |
| Pays | liste et noms | codes ISO de `countries.ts`, noms par `Intl.DisplayNames` en `fr` |
| Enregistrement | champs envoyés | `toSeriesPatch(valeurs de départ, valeurs du formulaire)` |
| Suppression | titre à retaper | `series.title` enregistré, comparé après normalisation (NFC, espaces regroupés) |
| Suppression | « N épisodes » | `totalEpisodes` |
| Erreurs | textes | ce spec pour `409`, `404` et les validations ; `toUserMessage` (spec 0002) pour le reste |
| Mise en ligne | série ouverte en production | une série existante choisie par l'engineer ; aucune écriture |

### Key invariants

- Une série a toujours au moins une catégorie et un titre de 1 à 100 caractères ; le dashboard n'envoie jamais un formulaire invalide.
- Une modification n'envoie et ne valide que les champs changés : un admin n'écrase jamais un champ qu'il n'a pas touché, et une valeur ancienne hors règles ne bloque jamais un enregistrement.
- Une catégorie masquée liée à la série n'est jamais retirée sans action de l'admin.
- `releaseYear` n'est jamais envoyé vide ni `null` (le backend le refuse en modification).
- `freeEpisodeCount` garde sa valeur quand la série cesse d'être premium.
- La suppression exige le titre exact retapé ; aucune autre action ne supprime une série.
- Un succès ne déclenche jamais la question « Quitter sans enregistrer ? ».

### Security model

- Toutes les routes utilisées sont réservées aux admins par le backend (`403` sinon) ; la garde `RequireSession` (spec 0004) n'est qu'un confort d'interface.
- Aucune donnée personnelle ni secret dans ce formulaire.
- La suppression est irréversible côté backend : la double confirmation (titre retapé) est la protection côté dashboard.
- Pas de journal d'audit : il n'existe pas côté backend et sort du périmètre (1 à 3 admins internes). Noté en suivi.

### Configuration required

Aucune nouvelle variable d'environnement ni dépendance : `@mantine/form`, `@mantine/core` (Combobox) et `@tabler/icons-react` sont déjà installés. Le prérequis backend demande un redéploiement de l'API sur Render, sans nouvelle variable.

### Critical test scenarios

- **Création réussie :** depuis la liste, « Nouvelle série », le formulaire rempli, « Créer la série » ; `POST /series` reçoit les seuls champs remplis ; l'admin arrive sur la fiche avec « Série créée. ». Vérifie **AC-1**, **AC-2**, **AC-4**.
- **Validation :** un titre vide, aucune catégorie, l'année 1700 et le code de langue `FRA` donnent leurs messages, le focus sur Titre, et aucun appel. Vérifie **AC-3**, **AC-10**.
- **Titre pris :** un `409` donne le message sous Titre, à la création et à la modification, sans changement de page. Vérifie **AC-5**.
- **Fiche :** le titre, l'aperçu, les chiffres, les dates et le formulaire sont préremplis ; `/series/abc` donne « Série introuvable » sans appel ; un `404` aussi ; une erreur réseau donne « Réessayer ». Vérifie **AC-6**.
- **Modification minimale :** changer seulement le pays envoie `{ country }` ; vider la description envoie `{ description: null }` ; « Enregistrer » est désactivé sans changement ; après succès, l'en tête montre le nouveau titre. Vérifie **AC-7**.
- **Accès :** cocher Premium fait apparaître le champ et l'indication ; décocher le masque et garde la valeur ; 5 gratuits sur 3 épisodes est accepté. Vérifie **AC-8**.
- **Catégories :** une catégorie masquée apparaît avec « (masquée) » ; une série liée à une catégorie masquée l'affiche préremplie, et changer le titre seul ne l'envoie pas ; une erreur de chargement donne « Réessayer ». Vérifie **AC-9**, **AC-7**.
- **Valeurs anciennes :** une série avec la langue « French » et un titre de 120 caractères s'enregistre après un changement du pays seul. Vérifie **AC-7**, **AC-10**.
- **Langues et pays :** « Fon (fon) » s'affiche et `fon` est envoyé ; le code `dyu` s'ajoute ; « Côte d’Ivoire » est envoyé tel quel ; « USA » existant est conservé. Vérifie **AC-10**, **AC-11**.
- **Changements non enregistrés :** un clic de menu avec un titre modifié ouvre la question, et « Rester » garde la saisie ; aucune question après un enregistrement ; une fin de session redirige sans question. Vérifie **AC-12**.
- **Suppression :** le bouton reste inactif tant que le titre n'est pas exact ; après le succès, l'admin est sur `/series` avec la notification ; un `404` donne « Cette série avait déjà été supprimée. » ; un `500` garde la fenêtre ouverte. Vérifie **AC-13**.
- **Double envoi et erreurs :** un double clic rapide n'envoie qu'un `PATCH` ; un `404` à l'enregistrement montre « Cette série n'existe plus. ». Vérifie **AC-14**.
- **Accessibilité :** les libellés sont présents, les erreurs reliées aux champs, et le parcours au clavier complet, y compris les pastilles de langue et la fenêtre de suppression. Vérifie **AC-15**.
- **Production, en lecture seule :** sur `https://admin.nollli.com`, la fiche d'une série existante s'affiche avec ses vraies valeurs. Vérifie **AC-16**.

## Build plan

Ordonné en Tracer Bullet : d'abord le fil complet le plus mince (liste vers fiche vers modification d'un champ, sur la vraie API), puis on épaissit (création, champs riches, protections, suppression), et enfin la mise en ligne.

0. Prérequis backend dans `noli-backend` : les réponses admin renvoient toutes les catégories de la série avec `isVisible`, tests compris, puis redéploiement de l'API, satisfies **AC-9**
1. `adminSeriesSchema`, `useSeriesDetail(id)`, routes `series/nouvelle` et `series/:id`, `SeriesDetailPage` avec aperçu, états et « Série introuvable » ; titre de la liste en lien avec l'état `from`, `backToListPath` et lien « Retour aux séries », satisfies **AC-1**, **AC-6**
2. `SeriesForm` minimal (Titre, Description, Statut, section Accès) en mode `edit`, `makeSeriesFormSchema`, `currentValues`, validation des seuls champs modifiés, envoi unique, `toSeriesPatch`, `PATCH /series/:id`, notification et nouvelle base du formulaire, erreurs `409`, `400`, `404`, satisfies **AC-5**, **AC-7**, **AC-8**, **AC-14**
3. Catégories : `useAllCategories`, `MultiSelect` avec « (masquée) », catégorie disparue, état d'erreur, satisfies **AC-9**
4. Langues (`languages.ts`, `LanguagesInput`) et Pays (`countries.ts`, `Select` groupé), Année de sortie et sa règle de modification, satisfies **AC-10**, **AC-11**, **AC-3**
5. `SeriesCreatePage`, bouton « Nouvelle série » dans la liste, `POST /series`, navigation vers la fiche, cache de la fiche, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**
6. Protection des changements non enregistrés (`useBlocker`, modale, `beforeunload`, exceptions), satisfies **AC-12**
7. `DeleteSeriesModal` et zone « Supprimer la série », satisfies **AC-13**, **AC-14**
8. Accessibilité finale (focus sur le premier champ invalide, noms des boutons en chargement, titres d'onglet), contrastes mesurés des nouveaux couples, satisfies **AC-3**, **AC-15**
9. Mise en ligne : vérifier que l'API redéployée renvoie les catégories masquées, puis fusion dans `main` et push (avec l'accord de l'engineer), contrôle en lecture seule d'une fiche sur `https://admin.nollli.com`, satisfies **AC-16**

## Consequences

**Positive**:
- Le catalogue se gère entièrement depuis le dashboard, sans Swagger.
- La fiche devient la maison de la série : les images (fonctionnalité 8) et les épisodes (fonctionnalité 7) s'y ajouteront.
- Envoyer seulement les champs modifiés limite les écrasements entre admins.

**Negative / tradeoffs**:
- Le dernier enregistrement gagne : deux admins qui changent le même champ en même temps ne sont pas prévenus.
- `LanguagesInput` est un composant sur mesure (Combobox), plus long à construire et à tester qu'un champ simple.
- L'année de sortie ne peut plus être retirée une fois posée, à cause d'une limite du backend.
- La fonctionnalité dépend d'un changement dans un autre dépôt (`noli-backend`) et de son redéploiement.
- Pas de journal d'audit des suppressions.

**Neutral**:
- La liste de pays dépend des noms fournis par le navigateur (`Intl.DisplayNames`) ; deux navigateurs très différents pourraient écrire un nom autrement, ce qui créerait une nouvelle valeur.
- La fenêtre de suppression est propre à la série ; `confirmDanger` (spec 0003) reste pour les suppressions simples.

## Follow-up

- [ ] Fonctionnalité 7 (épisodes) et 8 (images) : s'ajouter à la fiche, sous le formulaire, au dessus de la zone de suppression.
- [ ] Backend : accepter `releaseYear: null` en modification, pour pouvoir retirer une année.
- [ ] Backend : un journal d'audit des créations et suppressions de séries, si le nombre d'admins grandit.
- [ ] Détection des conflits d'écriture (date de mise à jour comparée par le backend), si plusieurs admins travaillent en même temps.
- [ ] `/sync` : noter dans `AGENTS.md` la règle « seuls les champs modifiés partent en `PATCH` » et la protection des changements non enregistrés.
