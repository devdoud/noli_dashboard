# 0006. Épisodes d'une série

**Date**: 2026-10-15
**Status**: Proposed

## Summary

Les admins gèrent les épisodes d'une série directement sur sa fiche : une section « Épisodes » montre un tableau par saison, avec l'état de chaque vidéo et l'accès gratuit ou premium. On ajoute et on modifie un épisode dans une fenêtre, et on le supprime après une confirmation simple. Donner un premier lien vidéo publie l'épisode et peut prévenir les abonnés : le dashboard l'annonce et demande confirmation. Un petit changement du backend vient d'abord, pour qu'un lien vidéo collé puisse être corrigé ou retiré après la création. La fonctionnalité se termine par la mise en ligne, contrôlée en lecture seule.

## Requirements

**User stories**:
- En tant qu'admin, je veux voir les épisodes d'une série rangés par saison, avec l'état de leur vidéo, pour savoir ce qui est prêt à être regardé.
- En tant qu'admin, je veux ajouter un épisode avec sa saison, son numéro, son titre, sa durée et son lien vidéo, pour compléter une série.
- En tant qu'admin, je veux corriger un épisode (titre, description, durée, date, lien collé) sans perdre l'historique des spectateurs.
- En tant qu'admin, je veux supprimer un épisode en sachant ce qui sera effacé.

**Acceptance criteria**:
- **AC-1**: La fiche d'une série (`/series/:id`) affiche, sous le formulaire et au dessus de la zone de suppression, une section « Épisodes » avec le nombre d'épisodes, un bouton « Ajouter un épisode » et un tableau par saison (« Saison 1 », « Saison 2 »…), saisons et épisodes dans l'ordre croissant. Chaque ligne montre : N°, Titre, Durée, Sortie, Accès, Vidéo, et les boutons « Modifier » et « Supprimer ». Sans épisode : « Aucun épisode pour le moment ».
- **AC-2**: « Ajouter un épisode » ouvre une fenêtre avec Saison, Numéro, Titre, Durée (minutes et secondes), Description, Date de sortie et Lien vidéo. Saison vaut la plus grande saison existante, ramenée à 100 au plus (1 s'il n'y en a pas) et Numéro le numéro libre suivant de cette saison ; changer la saison recalcule le numéro tant que l'admin ne l'a pas modifié lui même.
- **AC-3**: Un formulaire invalide montre des messages en français sous les champs, place le focus sur le premier champ invalide et n'appelle pas l'API : saison entière de 1 à 100, numéro entier de 1 à 1 000, titre de 1 à 100 caractères, description de 1 000 caractères au plus, durée d'au moins 1 seconde (minutes de 0 à 600, secondes de 0 à 59), lien commençant par `https://` et valide, date valide.
- **AC-4**: Un ajout valide envoie `POST /series/:id/episodes` avec les seuls champs remplis (durée en secondes), ferme la fenêtre, affiche « Épisode ajouté. » et met à jour le tableau et le nombre d'épisodes de l'aperçu sans recharger la page.
- **AC-5**: Un épisode qui existe déjà (même saison et numéro, réponse `400` « Episode already exists ») affiche « Cet épisode existe déjà dans cette saison. » sous Numéro ; la fenêtre reste ouverte avec la saisie.
- **AC-6**: « Modifier » ouvre la fenêtre préremplie, avec « Saison N · Épisode M » en lecture seule. « Enregistrer » n'est actif qu'avec des changements, n'envoie en `PATCH /series/:id/episodes/:saison/:numéro` que les champs modifiés, ferme la fenêtre et affiche « Épisode modifié. ». Une date de sortie déjà renseignée ne peut pas être vidée (« La date de sortie ne peut pas être retirée, seulement modifiée. »).
- **AC-7**: Le Lien vidéo est modifiable seulement pour un épisode « Lien collé » ou « Aucune vidéo » ; le vider envoie `videoUrl: null` et l'épisode passe à « Aucune vidéo ». Pour une vidéo hébergée (« Prête », « En traitement », « Erreur »), le champ est remplacé par le texte « Vidéo hébergée : elle se gère avec l'hébergement vidéo. » et rien n'est envoyé ; ce verrou suit l'état de la vidéo, jamais la présence d'un ancien lien. Sous le champ, le texte « Sans lien, l'épisode n'est pas visible des spectateurs. Un lien le publie et peut prévenir les abonnés. » est toujours affiché.
- **AC-8**: La colonne Vidéo montre un badge en français : « Prête » (`ready`), « En traitement » (`pending`), « Erreur » (`error`), « Lien collé » (`legacy`), « Aucune vidéo » (`none`) ; pour « Erreur », le message de l'hébergeur (`pendingError`) s'affiche sous le badge quand il existe.
- **AC-9**: La colonne Accès montre « Non visible » pour un épisode sans vidéo jouable (état autre que « Prête » ou « Lien collé ») ; sinon « Gratuit » ou « Premium » selon `isFree` calculé par le backend. Une indication sous le titre de la section rappelle que seuls les épisodes visibles comptent dans les épisodes gratuits de la série. Après l'enregistrement d'un nouveau réglage « Épisodes gratuits » de la fiche, la colonne se met à jour sans recharger.
- **AC-10**: « Supprimer » ouvre une confirmation (`confirmDanger`) nommant l'épisode et listant ce qui sera effacé (sa vidéo, sa vignette et l'historique de visionnage des spectateurs) ; après confirmation, l'épisode disparaît et « Épisode supprimé. » s'affiche. Un épisode déjà supprimé (`404`) disparaît aussi, avec « Cet épisode avait déjà été supprimé. ».
- **AC-11**: Fermer la fenêtre d'un épisode avec des changements non enregistrés (croix, Échap, clic dehors, « Annuler ») demande « Abandonner les changements ? » ; sans changement, elle se ferme directement. Une fenêtre d'épisode modifiée active aussi la protection de la page (spec 0005, AC-12) : quitter la fiche ou fermer l'onglet demande confirmation.
- **AC-12**: Pendant un envoi, le bouton montre un chargement et un second clic n'envoie rien ; un `404` à l'ajout (série disparue) mène à `/series` avec « Cette série n'existe plus. » ; un `404` à la modification affiche « Cet épisode n'existe plus. », ferme la fenêtre et recharge la fiche ; les autres erreurs suivent la spec 0002.
- **AC-13**: Chaque tableau a une légende « Saison N », chaque bouton d'action a un nom complet (« Modifier l'épisode 3 de la saison 1 », « Supprimer l'épisode 3 de la saison 1 »), chaque champ a un libellé et son erreur, et tout se fait au clavier.
- **AC-15**: Enregistrer un premier lien vidéo (à l'ajout avec un lien, ou en modification d'un épisode « Aucune vidéo ») ouvre d'abord « Publier l'épisode ? » avec le texte « L'épisode deviendra visible des spectateurs, et les abonnés de ses catégories peuvent être prévenus. Cette annonce ne peut pas être annulée. » ; « Publier » envoie, « Annuler » revient à la fenêtre sans rien envoyer.
- **AC-14**: La fonctionnalité est en ligne sur `https://admin.nollli.com` (API puis dashboard) ; l'engineer y ouvre la fiche d'une série et vérifie ses épisodes, sans rien enregistrer en production.

## Decision

**Chosen option**: Option 1 : section « Épisodes » sur la fiche, fenêtre de formulaire `@mantine/form` et Zod, écritures par les routes d'épisodes qui renvoient la série admin complète

Chaque écriture renvoie la série admin à jour : le cache de la fiche est remplacé par la réponse, si bien que le tableau, l'aperçu et les accès gratuits restent cohérents sans requête de plus. Un petit changement du backend permet de modifier ou de vider un lien vidéo collé.

**Implementation skills**: `mantine-form` (`mantinedev/skills`, `.agents/skills/mantine-form/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Le raisonnement et les options comparées sont dans [rationale.md](rationale.md).

## Feature design

### Source du design

`design.md` et la vitrine `/dev/composants` (spec 0003). Aucune nouvelle couleur sans mesure dans les deux modes. Le tableau suit `DataTable` dans son apparence (en tête en surface relevée, lignes au survol), sans pagination.

### Prérequis backend (`noli-backend`)

Aujourd'hui, `PATCH /series/:id/episodes/:seasonNumber/:episodeNumber` n'accepte que `title`, `description`, `duration` et `releaseDate` (`EDITABLE_EPISODE_FIELDS`).

**Changement :**
- `UpdateEpisodeDto` accepte `videoUrl` : `@ValidateIf((o) => o.videoUrl !== undefined && o.videoUrl !== null)` puis `@IsUrl({ protocols: ['https'], require_protocol: true })`, ou `null` pour vider. `EDITABLE_EPISODE_FIELDS` inclut `videoUrl`.
- La vérification « vidéo hébergée » fait partie de l'écriture atomique : le filtre de `findOneAndUpdate` exige, pour cet épisode (`$elemMatch` sur saison et numéro), `streamUid: null` et `pendingStreamUid: null` quand `videoUrl` est présent dans la requête. Si l'écriture ne trouve rien, une lecture `exists` distingue l'épisode absent (`404`) de l'épisode hébergé (`409` avec le code `VIDEO_HOSTED`), comme le fait déjà `savePendingVideo`. Rien n'est écrit dans ce cas.
- Sinon, `videoUrl` est écrit tel quel ; `null` retire le lien (l'état devient `none`).
- **Annonce :** quand la modification rend l'épisode jouable pour la première fois (pas de `streamUid`, pas de `videoUrl` avant, un `videoUrl` non nul après), le service met en file `notificationQueue.episodePlayable(...)`, exactement comme `addEpisode`.
- `CreateEpisodeDto.videoUrl` ne change pas (il accepte tout texte) : à la création, la règle `https` est propre au dashboard.
- La réponse admin ne contient pas le lien collé aujourd'hui (`toAdminSeries` retire `videoUrl` et ne garde que `video.hasPastedUrl`). `adminVideoStatus` ajoute `pastedUrl` (le lien collé, ou `null`) à l'objet `video` des réponses admin seulement : le formulaire peut ainsi le préremplir. Le lien n'est pas un secret, l'app le joue déjà tel quel.
- Les autres routes, et les réponses publiques, ne changent pas.
- Tests : lien écrit sur `legacy` et `none`, `null` retire le lien, `409 VIDEO_HOSTED` sans écriture sur `ready`, `pending` et `error`, `400` pour `http://`, annonce mise en file seulement au premier lien, `pastedUrl` absent des réponses publiques.
- Le changement est livré avec ses tests dans `noli-backend`, puis l'API est redéployée avant la mise en ligne du dashboard.

### Données

- **Source :** les épisodes arrivent dans la fiche admin déjà chargée (`GET /series/:id/admin`, spec 0005), triés par saison puis numéro. Aucune requête de plus.
- **Schéma :** `adminSeriesSchema` (spec 0005) reçoit `episodes`, tolérant :

```ts
const adminEpisodeSchema = z.object({
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  title: z.string(),
  description: z.string().nullish(),
  duration: z.number().nullish(),           // secondes
  releaseDate: z.string().nullish(),        // ISO
  isFree: z.boolean().nullish().transform((v) => v ?? false),
  video: z.object({
    status: z.string(),                     // ready | pending | error | legacy | none ; autre → « — »
    pendingError: z.string().nullish(),
    hasPastedUrl: z.boolean().nullish(),
    pastedUrl: z.string().nullish(),        // lien collé (prérequis backend)
  }).nullish(),
})
episodes: z.array(adminEpisodeSchema).nullish().transform((v) => v ?? [])
```

- **Lien collé actuel :** le formulaire préremplit le Lien vidéo avec `video.pastedUrl` de la réponse admin (prérequis backend).
- **Écritures :** `addEpisode`, `updateEpisode` et `deleteEpisode` rejoignent `src/features/series/api.ts`, et leur réponse `{ message, series }` passe par `adminSeriesResponseSchema`, comme la lecture. Après chaque succès :
  - `setQueryData(['series', 'detail', id], réponse.series)` ;
  - `invalidateQueries(['series', 'list'])`, car le nombre d'épisodes y figure.
- **Fiche :** le formulaire de la série (spec 0005) garde sa propre base ; la mise à jour du cache par un épisode ne la touche pas. L'aperçu (nombre d'épisodes, `totalEpisodes`) et le tableau suivent le cache. La colonne Accès reflète le réglage « Épisodes gratuits » enregistré, jamais une saisie non enregistrée du formulaire de la série.
- **Nombres :** l'en tête de la section et les tableaux comptent `episodes.length` ; l'aperçu de la fiche garde `totalEpisodes` (spec 0005).
- **Copie figée :** à l'ouverture de la fenêtre, l'épisode (ou, à l'ajout, la liste des épisodes pour les valeurs proposées) est copié. La base de comparaison et les valeurs proposées viennent de cette copie, jamais de la fiche en direct, même si elle se recharge pendant que la fenêtre est ouverte.

### Section « Épisodes » (`EpisodesSection`, `src/features/series/episodes/`)

- `Paper withBorder` avec le titre `h2` « Épisodes », le nombre (« 8 épisodes », `episodes.length`), l'indication « Seuls les épisodes visibles (avec une vidéo prête ou un lien) comptent dans les épisodes gratuits. » en texte secondaire, et le bouton « Ajouter un épisode » (`IconPlus`).
- **Regroupement :** une fonction pure `groupBySeason(episodes)` renvoie les saisons croissantes, chacune avec ses épisodes croissants.
- **Un tableau par saison :** `Table` avec la légende visible `<caption>` « Saison N ».

| Colonne | Contenu |
|---|---|
| N° | `episodeNumber`, aligné à droite |
| Titre | `title` en graisse 600 |
| Durée | `formatDuration(duration)` (spec 0003) ; absente ou nulle : « — » |
| Sortie | `formatDate(releaseDate, { timeZone: 'UTC' })`, ou « — » |
| Accès | badge `light` : « Non visible » (`gray`) si l'état n'est ni `ready` ni `legacy` ; sinon « Gratuit » (`gray`) si `isFree`, « Premium » (`noliAmber`) sinon |
| Vidéo | badge `light` selon le tableau « États de vidéo » ; pour `error`, le texte `pendingError` en dessous (taille `xs`, `noliRed` texte) |
| Actions | `ActionIcon` « Modifier » (`IconPencil`) et « Supprimer » (`IconTrash`), avec les noms complets de l'AC-13 et une infobulle |

- **Vide :** `EmptyState` « Aucun épisode pour le moment », description « Ajoutez le premier épisode de la série. », avec le bouton « Ajouter un épisode ».
- Pas de pagination : les épisodes d'une série tiennent dans la page (quelques dizaines).

### États de vidéo

| `video.status` | Badge | Couleur (`light`) |
|---|---|---|
| `ready` | Prête | `green` |
| `pending` | En traitement | `noliIndigo` |
| `error` | Erreur | `noliRed` |
| `legacy` | Lien collé | `noliAmber` |
| `none` ou absent | Aucune vidéo | `gray` |
| autre valeur | — | aucun badge |

Le couple `green` `light` est nouveau : son contraste est mesuré dans les deux modes avant usage (4,5:1 au moins), sinon le texte passe à une nuance plus foncée, comme pour l'ambre.

### Fenêtre d'épisode (`EpisodeModal`)

- `Modal` Mantine, titre « Ajouter un épisode » ou « Modifier l'épisode M de la saison N », largeur `md`.
- `useForm` en mode `uncontrolled` avec `schemaResolver(makeEpisodeSchema({ mode, initialReleaseDate }), { sync: true })`, `<form noValidate>`, `onValuesChange` qui recopie les valeurs dans un état local (comme la fiche, spec 0005).

| Champ | Composant | Valeur | Règle et message |
|---|---|---|---|
| Saison | `NumberInput` (ajout) ; texte « Saison N · Épisode M » (modification) | `seasonNumber: number \| ''` | entier de 1 à 100 : « Saison entre 1 et 100. » |
| Numéro | `NumberInput` (ajout) | `episodeNumber: number \| ''` | entier de 1 à 1 000 : « Numéro entre 1 et 1 000. » |
| Titre | `TextInput`, obligatoire | `title: string` | espaces du bord retirés ; « Titre requis. », « 100 caractères au plus. » |
| Durée | deux `NumberInput` côte à côte dans un `Input.Wrapper` « Durée » : « min » (0 à 600) et « s » (0 à 59), nommés « Durée, minutes » et « Durée, secondes », avec une seule zone d'erreur reliée aux deux par `aria-describedby` | `durationMinutes`, `durationSeconds` | total ≥ 1 s : « Durée d'au moins 1 seconde. » ; secondes hors 0 à 59 : « Secondes entre 0 et 59. » |
| Description | `Textarea` autosize, de 3 à 8 lignes, compteur « N / 1 000 » | `description: string` | « 1 000 caractères au plus. » |
| Date de sortie | `TextInput type="date"` | `releaseDate: string` (`AAAA-MM-JJ` ou vide) | date valide ; en modification, vider une date existante : « La date de sortie ne peut pas être retirée, seulement modifiée. » |
| Lien vidéo | `TextInput type="url"`, placeholder `https://…`, description « Sans lien, l'épisode n'est pas visible des spectateurs. Un lien le publie et peut prévenir les abonnés. » | `videoUrl: string` | espaces du bord retirés ; vide accepté ; sinon `new URL` valide, protocole `https:` et un nom d'hôte avec un point (même règle que `@IsUrl` du backend) : « Lien https valide requis. » ; masqué pour une vidéo hébergée (AC-7) |

- **Valeurs de départ (ajout) :** saison = `min(plus grande saison existante, 100)` (1 si aucune) ; numéro = plus grand numéro de cette saison + 1 (1 si vide) ; durée 0 min 0 s ; le reste vide. Tant que l'admin n'a pas touché au Numéro, changer la Saison recalcule le numéro libre suivant de la nouvelle saison (fonction pure `nextEpisodeNumber(episodes, season)`).
- **Valeurs de départ (modification) :** celles de l'épisode ; durée découpée en minutes et secondes (`Math.floor(d / 60)`, `d % 60`), 0 et 0 si elle manque ; date `releaseDate` coupée à `AAAA-MM-JJ` en UTC ; lien = `video.pastedUrl` ou vide, et seulement pour un état `legacy` ou `none`. La fenêtre ne modifie que `duration`, même pour une vidéo hébergée (dont la durée réelle, `streamDuration`, n'est pas exposée).
- **Date envoyée :** `AAAA-MM-JJT12:00:00.000Z` (midi UTC). **Affichage et préremplissage en UTC :** `formatDate` (spec 0003) reçoit une option `{ timeZone: 'UTC' }` utilisée par cette section, si bien que le tableau et la fenêtre montrent toujours le même jour, y compris pour une date mise par défaut par le backend.
- **Ajout, corps envoyé (`toEpisodeCreatePayload`, fonction pure) :** `seasonNumber`, `episodeNumber`, `title` nettoyé, `duration` en secondes, et seulement s'ils sont remplis après nettoyage des espaces : `description`, `releaseDate`, `videoUrl`. Jamais `null`. Sans date, le backend met la date du jour.
- **Modification, corps envoyé (`toEpisodePatch`, fonction pure) :** seuls les champs différents de la base (titre nettoyé, description vidée → `null`, durée en secondes, date, lien vidé → `null`). Jamais la saison ni le numéro. `releaseDate` vide n'est jamais envoyé. Le lien n'est jamais envoyé pour une vidéo hébergée.
- **Validation en modification :** seuls les champs modifiés sont validés (même règle que la fiche, spec 0005), pour qu'une valeur ancienne (une durée absente, un lien `http`) ne bloque pas une autre correction.
- **« Modifié » :** une seule définition, `changedEpisodeFields(copie, valeurs)` (fonction pure) : elle active « Enregistrer », la question de fermeture, la protection de la page et le contenu de `toEpisodePatch`.
- **Confirmation de publication (AC-15) :** si le lien envoyé est le premier de l'épisode (ajout avec un lien, ou modification d'un épisode `none` dont le lien devient non vide), `modals.openConfirmModal` « Publier l'épisode ? » s'ouvre avant l'envoi ; « Annuler » (focus par défaut) revient au formulaire, « Publier » envoie. Pas de confirmation pour corriger un lien déjà collé.
- **Boutons :** « Annuler » et « Ajouter l'épisode » ou « Enregistrer ». Nom accessible pendant l'envoi : « Ajout en cours » ou « Enregistrement en cours ». Un drapeau `useRef` empêche un second envoi.
- **Focus :** à l'ouverture, sur le premier champ modifiable (Saison en ajout, Titre en modification) ; à un envoi invalide, sur le premier champ en erreur.
- **Fermeture avec changements (AC-11) :** `closeOnClickOutside` et `closeOnEscape` passent par la même fonction `requestClose` : sans changement, elle ferme ; avec changements, elle ouvre `modals.openConfirmModal` « Abandonner les changements ? » (« Continuer la saisie » par défaut, « Abandonner » en `noliRed.8`). Pendant un envoi, la fenêtre ne se ferme pas.
- **Protection de la page :** l'état « modifié » de la fenêtre est additionné à celui du formulaire de la série pour activer `useUnsavedChangesGuard` (spec 0005), `beforeunload` compris. Un départ de la page accepté ferme la fenêtre.

### Erreurs

Traitées dans cet ordre, après un envoi :
- **`400` dont le message contient « Episode already exists » :** `form.setFieldError('episodeNumber', 'Cet épisode existe déjà dans cette saison.')`, focus sur Numéro.
- **`409` code `VIDEO_HOSTED` :** message « La vidéo de cet épisode est hébergée : le lien ne peut pas être modifié ici. » dans une `Alert` de la fenêtre, et la fiche est rechargée.
- **autre `409` :** `notifyError` (spec 0002), jamais `applyFieldErrors`, qui écrirait « Déjà utilisé. » sous un champ.
- **`404` à l'ajout :** la série a disparu : « Cette série n'existe plus. » en notification, et navigation vers `/series` (la protection de la page est levée avant).
- **`404` à la modification :** « Cet épisode n'existe plus. » en notification, fenêtre fermée, fiche rechargée (`invalidateQueries` de la fiche).
- **autre `400` :** `applyFieldErrors(form, error, { seasonNumber: 'season', episodeNumber: 'episodeNumber', title: 'title', description: 'description', duration: 'duration', releaseDate: 'releaseDate', videoUrl: 'videoUrl' })` (spec 0002).
- **autres erreurs :** `notifyError` (spec 0002).

### Suppression

- `confirmDanger` (spec 0003) avec :
  - titre « Supprimer l'épisode M de la saison N ? » ;
  - message « « <titre> » sera supprimé définitivement, avec sa vidéo, sa vignette et l'historique de visionnage des spectateurs pour cet épisode. ».
- Après « Supprimer » : `DELETE /series/:id/episodes/:saison/:numéro`.
  - En cas de succès : cache remplacé par la réponse, et « Épisode supprimé. ».
  - En cas de `404` : la fiche est rechargée, et « Cet épisode avait déjà été supprimé. ».
  - Pour toute autre erreur : `notifyError`, puis la fiche est rechargée (une suppression peut échouer après avoir déjà retiré la vidéo).
- Pendant la suppression, les boutons de cette ligne sont désactivés.

### Data model sketch

Aucun stockage propre au dashboard. Les épisodes sont un tableau dans le document de la série (MongoDB, backend), identifiés par le couple (`seasonNumber`, `episodeNumber`), unique dans une série.

| Champ (API) | Type | Ajout | Modification | Affichage |
|---|---|---|---|---|
| `seasonNumber` | entier ≥ 1 | requis | figé (dans l'adresse) | regroupement, titre de la fenêtre |
| `episodeNumber` | entier ≥ 1 | requis, unique dans la saison | figé (dans l'adresse) | colonne N° |
| `title` | texte | requis | si changé | colonne Titre |
| `description` | texte ou `null` | si rempli | si changé, `null` si vidé | fenêtre |
| `duration` | entier, secondes | requis | si changé | colonne Durée |
| `releaseDate` | date ISO | si remplie (sinon le backend met la date du jour) | si changée, jamais vidée | colonne Sortie |
| `videoUrl` | adresse `https` ou `null` | si rempli | si changé, `null` si vidé ; interdit pour une vidéo hébergée (prérequis backend) | fenêtre |
| `video.status`, `video.pendingError` | texte | | | colonne Vidéo |
| `isFree` | booléen calculé | | | colonne Accès |

### API surface

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/series/:id/admin` | GET | `id` | `series.episodes[]` (spec 0005) | bearer admin | `404` |
| `/series/:id/episodes` | POST | `seasonNumber`, `episodeNumber`, `title`, `duration` (req) ; `description`, `releaseDate`, `videoUrl` (opt) | `series` | bearer admin | `400` doublon ou champ invalide, `404` |
| `/series/:id/episodes/:s/:e` | PATCH | champs modifiés parmi `title`, `description`, `duration`, `releaseDate`, `videoUrl` (prérequis) | `series` | bearer admin | `400`, `404`, `409 VIDEO_HOSTED` |
| `/series/:id/episodes/:s/:e` | DELETE | adresse | `series` | bearer admin | `404` |

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Section | épisodes, ordre, saisons | `series.episodes` de la fiche admin, regroupés par `groupBySeason` |
| Section | nombre d'épisodes | `episodes.length` |
| Tableau | durée affichée | `formatDuration(duration)` (spec 0003) |
| Tableau | date affichée | `formatDate(releaseDate, { timeZone: 'UTC' })` |
| Tableau | Accès | « Non visible » si `video.status` n'est ni `ready` ni `legacy` ; sinon `isFree` du backend |
| Tableau | badge et détail vidéo | `video.status`, `video.pendingError` |
| Ajout | saison proposée | `min(plus grande seasonNumber, 100)` de la copie figée, sinon 1 |
| Ajout | numéro proposé | `nextEpisodeNumber(episodes, saison)` |
| Ajout et modification | durée envoyée | `minutes × 60 + secondes` |
| Ajout et modification | date envoyée | jour saisi, à midi UTC |
| Modification | valeurs de départ | l'épisode de la fiche ; lien = `video.pastedUrl` (prérequis backend) |
| Modification | champs envoyés | `toEpisodePatch(copie figée, valeurs)` |
| Ajout et modification | confirmation de publication | premier lien : lien non vide envoyé et état `none` (modification) ou ajout avec lien |
| Modification | lien modifiable ou non | `video.status` : modifiable pour `legacy` et `none` seulement, jamais d'après `pastedUrl` |
| Suppression | nom dans la confirmation | `seasonNumber`, `episodeNumber`, `title` |
| Toutes écritures | tableau et aperçu à jour | `series` de la réponse, posée dans le cache de la fiche |
| Erreurs | textes | ce spec pour le doublon, `409` et `404` ; `toUserMessage` (spec 0002) pour le reste |
| Mise en ligne | série contrôlée en production | une série existante choisie par l'engineer ; aucune écriture |

### Key invariants

- Le couple saison et numéro est unique dans une série ; le dashboard ne change jamais celui d'un épisode existant.
- Une modification n'envoie et ne valide que les champs changés ; la saison et le numéro ne partent jamais en `PATCH`.
- Le lien d'une vidéo hébergée n'est jamais envoyé ; seul le backend (prérequis) peut le refuser en dernier recours.
- `duration` envoyée est toujours un entier de secondes ≥ 1.
- Aucun premier lien n'est envoyé sans la confirmation « Publier l'épisode ? ».
- La date de sortie n'est jamais envoyée vide ni `null`.
- Après chaque écriture, le tableau, l'aperçu et les accès reflètent la réponse du backend, sans calcul local.

### Security model

- Toutes les routes utilisées sont réservées aux admins par le backend (`403` sinon).
- Le lien collé n'est pas un secret : l'app le lit tel quel. Le dashboard exige `https` pour éviter un contenu mixte bloqué par l'app.
- La suppression efface l'historique de visionnage de l'épisode, sans retour possible : la confirmation le dit.

### Configuration required

Aucune nouvelle variable ni dépendance côté dashboard (pas de `@mantine/dates` : le champ date est natif). Le prérequis backend demande un redéploiement de l'API, sans nouvelle variable.

### Critical test scenarios

- **Section :** une série de 2 saisons montre deux tableaux « Saison 1 » et « Saison 2 » triés ; une série sans épisode montre l'état vide. Vérifie **AC-1**.
- **Ajout :** saison et numéro proposés corrects ; changer la saison recalcule le numéro ; 24 min 30 s part en `duration: 1470` ; la date part à midi UTC ; le tableau et l'aperçu se mettent à jour. Vérifie **AC-2**, **AC-4**.
- **Validation :** titre vide, durée 0, secondes 75, lien `http://` donnent leurs messages, le focus et aucun appel. Vérifie **AC-3**.
- **Doublon :** un `400` « Episode already exists » met le message sous Numéro. Vérifie **AC-5**.
- **Modification :** changer seulement le titre envoie `{ title }` ; vider une date existante est refusé ; vider le lien collé envoie `{ videoUrl: null }` ; une vidéo « Prête » n'affiche pas de champ de lien. Vérifie **AC-6**, **AC-7**.
- **Badges et accès :** les cinq états montrent leur libellé, « Erreur » montre le détail ; « Non visible » pour un épisode sans vidéo jouable ; « Gratuit » et « Premium » suivent `isFree`, et changent après un enregistrement des épisodes gratuits. Vérifie **AC-8**, **AC-9**.
- **Publication :** un ajout avec lien demande « Publier l'épisode ? », « Annuler » n'envoie rien ; corriger un lien collé ne demande rien. Vérifie **AC-15**.
- **Suppression :** confirmation, disparition de la ligne, notification ; un `404` est traité comme déjà supprimé. Vérifie **AC-10**.
- **Fenêtre :** Échap avec changements demande « Abandonner les changements ? », sans changement ferme directement ; un clic dans le menu avec une fenêtre modifiée demande « Quitter sans enregistrer ? ». Vérifie **AC-11**.
- **Envoi unique et erreurs :** un double clic n'envoie qu'une requête ; un `404` ferme la fenêtre et recharge. Vérifie **AC-12**.
- **Accessibilité :** légendes de tableau, noms complets des boutons d'action, parcours au clavier. Vérifie **AC-13**.
- **Backend :** `PATCH` avec `videoUrl` sur un épisode `legacy` écrit le lien ; `null` le retire ; sur une vidéo hébergée, `409 VIDEO_HOSTED` sans écriture ; un `http://` est refusé (`400`) ; la réponse admin porte `video.pastedUrl`, la réponse publique jamais. Vérifie **AC-7**.
- **Production, en lecture seule :** la section Épisodes d'une série existante s'affiche avec ses vraies valeurs. Vérifie **AC-14**.

## Build plan

Ordonné en Tracer Bullet : d'abord le fil le plus mince de la donnée réelle à l'écran (épisodes lus et affichés), puis l'écriture la plus simple (ajout), puis on épaissit (modification, lien, suppression, protections), et enfin la mise en ligne.

0. Prérequis backend dans `noli-backend` : `videoUrl` dans `UpdateEpisodeDto` (`https` ou `null`), vérification atomique et `409 VIDEO_HOSTED` pour une vidéo hébergée, annonce au premier lien, `video.pastedUrl` dans les réponses admin ; tests, puis redéploiement de l'API, satisfies **AC-7**
1. `adminEpisodeSchema` dans `adminSeriesSchema`, `groupBySeason`, `EpisodesSection` avec un tableau par saison, badges vidéo, accès, état vide, sur la fiche, satisfies **AC-1**, **AC-8**, **AC-9**
2. `EpisodeModal` en ajout : champs, valeurs proposées, `nextEpisodeNumber`, schéma, `toEpisodeCreatePayload`, `POST`, mise à jour du cache, doublon, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**
3. `EpisodeModal` en modification : saison et numéro figés, `toEpisodePatch`, validation des seuls champs modifiés, date non effaçable, règles du lien vidéo, satisfies **AC-6**, **AC-7**
4. Suppression avec `confirmDanger`, `404` déjà supprimé, satisfies **AC-10**
5. Confirmation de publication, fermeture avec changements et protection de la page, envoi unique, erreurs `404` et `409`, noms des boutons, focus, contraste du badge vert, option UTC de `formatDate`, satisfies **AC-11**, **AC-12**, **AC-13**, **AC-15**
6. Mise en ligne : API puis dashboard (avec l'accord de l'engineer), contrôle en lecture seule d'une série sur `https://admin.nollli.com`, satisfies **AC-14**

## Consequences

**Positive**:
- La fiche devient complète pour le contenu : informations, accès et épisodes au même endroit.
- Corriger un lien collé ne touche plus à l'historique des spectateurs.
- Chaque écriture met la fiche à jour à partir de la réponse, sans requête de plus.

**Negative / tradeoffs**:
- La saison et le numéro d'un épisode restent figés : pour en changer, il faut supprimer et recréer, ce qui efface l'historique de cet épisode.
- Les vidéos hébergées ne se gèrent pas encore depuis le dashboard (fonctionnalité reportée).
- Une nouvelle dépendance au déploiement du backend, comme pour la fiche série.
- Le champ date natif a une apparence qui varie selon le navigateur.

**Neutral**:
- Pas de pagination des épisodes : à revoir si une série dépasse quelques centaines d'épisodes.
- La date de sortie est envoyée à midi UTC, convention propre au dashboard.

## Follow-up

- [ ] Fonctionnalité 8 (images) : vignette d'épisode dans le tableau et la fenêtre.
- [ ] Fonctionnalité reportée « Vidéos hébergées » : envoi, import, état en direct et retrait des vidéos Cloudflare depuis la fenêtre d'épisode.
- [ ] Backend : permettre de déplacer un épisode (changer saison ou numéro) sans perdre l'historique, si le besoin se présente.
- [ ] `/sync` : noter dans `AGENTS.md` la convention « une écriture qui renvoie la série remplace le cache de la fiche ».
