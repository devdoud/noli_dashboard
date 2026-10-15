# 0006. Épisodes d'une série et envoi de leurs vidéos

**Date**: 2026-10-15
**Status**: In Progress

## Summary

Les admins gèrent les épisodes d'une série directement sur sa fiche : une section « Épisodes » montre un tableau par saison, avec l'état de chaque vidéo et l'accès gratuit ou premium. On ajoute et on modifie un épisode dans une fenêtre, et on lui donne sa vidéo en **envoyant le fichier** (ou en l'important depuis un lien) vers l'hébergement vidéo du backend (Cloudflare Stream) : l'envoi se poursuit en arrière plan sur la fiche, avec sa progression, puis la fiche suit l'encodage jusqu'à « Prête ». Les anciens liens collés se migrent en un clic. Donner une première vidéo publie l'épisode et peut prévenir les abonnés : le dashboard demande confirmation. Un petit ajout au backend permet cette migration ; la fonctionnalité se termine par la mise en ligne.

## Requirements

**User stories**:
- En tant qu'admin, je veux voir les épisodes d'une série rangés par saison, avec l'état de leur vidéo, pour savoir ce qui est prêt à être regardé.
- En tant qu'admin, je veux ajouter un épisode et envoyer son fichier vidéo dans la foulée, même lourd et sur une connexion faible, sans héberger la vidéo ailleurs.
- En tant qu'admin, je veux continuer à travailler sur la fiche pendant qu'une vidéo s'envoie, et voir quand elle est prête.
- En tant qu'admin, je veux migrer les anciens liens collés vers l'hébergement protégé, remplacer une vidéo sans coupure, ou la retirer.
- En tant qu'admin, je veux corriger ou supprimer un épisode en sachant ce qui sera effacé.

**Acceptance criteria**:
- **AC-1**: La fiche d'une série (`/series/:id`) affiche, sous le formulaire et au dessus de la zone de suppression, une section « Épisodes » avec le nombre d'épisodes, un bouton « Ajouter un épisode » et un tableau par saison (« Saison 1 », « Saison 2 »…), saisons et épisodes dans l'ordre croissant. Chaque ligne montre : N°, Titre, Durée, Sortie, Accès, Vidéo, et les boutons « Modifier » et « Supprimer ». Sans épisode : « Aucun épisode pour le moment ».
- **AC-2**: « Ajouter un épisode » ouvre une fenêtre avec Saison, Numéro, Titre, Durée (minutes et secondes), Description, Date de sortie, et une zone Vidéo facultative à deux onglets, « Envoyer un fichier » et « Depuis un lien ». Saison vaut la plus grande saison existante, ramenée à 100 au plus (1 s'il n'y en a pas), et Numéro le numéro libre suivant de cette saison ; changer la saison recalcule le numéro tant que l'admin ne l'a pas modifié. Choisir un fichier préremplit la durée depuis le fichier quand le navigateur sait la lire et que l'admin n'a pas saisi de durée.
- **AC-3**: Un formulaire invalide montre des messages en français sous les champs, place le focus sur le premier champ invalide et n'appelle pas l'API : saison entière de 1 à 100, numéro entier de 1 à 1 000, titre de 1 à 100 caractères, description de 1 000 caractères au plus, durée d'au moins 1 seconde (minutes de 0 à 600, secondes de 0 à 59), date valide, fichier vidéo (`video/*`) de 30 Go au plus et de 3 heures au plus quand sa durée est lisible, lien d'import `https://` valide.
- **AC-4**: Un ajout valide envoie `POST /series/:id/episodes` (sans vidéo), ferme la fenêtre, affiche « Épisode ajouté. » et met à jour le tableau et le nombre d'épisodes sans recharger. Si un fichier ou un lien a été donné, sa mise en ligne démarre aussitôt pour ce nouvel épisode (AC-7, AC-8). Si elle ne démarre pas (limite, service indisponible, lien refusé), l'épisode reste créé : « Épisode ajouté, mais la vidéo n'a pas démarré. », et la ligne montre « Envoi interrompu » avec « Relancer » (fichier) ou la raison du refus (lien, à reprendre depuis « Modifier »).
- **AC-5**: Un épisode qui existe déjà (même saison et numéro, réponse `400` « Episode already exists ») affiche « Cet épisode existe déjà dans cette saison. » sous Numéro ; la fenêtre reste ouverte avec la saisie, et aucune vidéo n'est envoyée.
- **AC-6**: « Modifier » ouvre la fenêtre préremplie, avec « Saison N · Épisode M » en lecture seule. Les champs Titre, Durée, Description et Date de sortie s'enregistrent par « Enregistrer », actif seulement avec des changements, en `PATCH` des seuls champs modifiés, puis « Épisode modifié. ». Une date de sortie déjà renseignée ne peut pas être vidée (« La date de sortie ne peut pas être retirée, seulement modifiée. »).
- **AC-7**: **Envoi de fichier.** Pour un fichier, le dashboard demande un lien d'envoi (`POST …/video/upload` avec la taille du fichier) puis envoie le fichier directement à Cloudflare : en un envoi simple jusqu'à 200 Mo, avec le protocole reprenable « tus » au delà, selon la méthode renvoyée. La fenêtre se ferme ; la ligne de l'épisode montre « Envoi 42 % » avec une barre de progression et « Annuler l'envoi ». Un seul envoi est actif à la fois sur la fiche : les suivants attendent avec « En attente d'envoi ». Un envoi interrompu affiche « Envoi interrompu » avec « Relancer » : tant que le lien d'envoi n'a pas expiré, la reprise réutilise le même lien (et, en tus, repart de la partie déjà reçue) ; après expiration, un nouveau lien est demandé. Si la limite des 10 appels est atteinte (`429`), la file se met en pause, affiche « Pause : limite d'envois atteinte, reprise à 14 h 32 » et reprend seule.
- **AC-8**: **Import et migration.** L'onglet « Depuis un lien » envoie `POST …/video/import` avec l'adresse `https` ; pour un épisode « Lien collé », le bouton « Importer ce lien dans l'hébergement » envoie l'import du lien déjà stocké, sans le connaître (prérequis backend). Un lien refusé par Cloudflare affiche son message ; l'épisode passe ensuite par « En traitement ».
- **AC-9**: **Encodage.** À la fin d'un envoi du navigateur, le dashboard interroge l'hébergement une fois (`POST …/video/refresh`), puis au plus une fois par minute tant que cet épisode est en traitement et que la fiche est ouverte. En parallèle, tant qu'un épisode est en traitement (`processing`), la fiche se relit toute seule toutes les 15 secondes (pour les mises à jour du webhook), en pause quand l'onglet est caché. « Vérifier maintenant » (fenêtre de l'épisode) interroge l'hébergement à la demande. Quand la vidéo devient « Prête », le badge change sans action.
- **AC-10**: **Selon l'état de la vidéo**, la fenêtre de modification propose : « Aucune vidéo » → envoyer ou importer ; « Lien collé » → importer ce lien, ou envoyer ou importer une autre vidéo ; « Prête » → « Remplacer la vidéo » (les spectateurs gardent l'ancienne jusqu'à ce que la nouvelle soit prête) et « Retirer la vidéo » ; « En traitement » → « Vérifier maintenant » et remplacer ; « Erreur » → le message de l'hébergeur, remplacer, et retirer. Tant que l'épisode garde un ancien lien collé (`hasPastedUrl`), « Importer ce lien dans l'hébergement » reste proposé, quel que soit son état. « Retirer la vidéo » demande une confirmation (« L'épisode ne sera plus visible des spectateurs. ») puis `DELETE …/video`.
- **AC-11**: La colonne Vidéo montre un badge en français : « Prête » (`ready`), « En traitement » (`pending`), « Erreur » (`error`), « Lien collé » (`legacy`), « Aucune vidéo » (`none`) ; pour « Erreur », le message de l'hébergeur (`pendingError`, avec « Lien d'envoi expiré » pour `upload_expired`) s'affiche sous le badge ; pour « Prête » avec un remplacement en cours, « Remplacement en cours » s'affiche sous le badge. Un envoi du navigateur en cours remplace le badge par sa progression (AC-7).
- **AC-12**: La colonne Accès montre « Non visible » pour un épisode sans vidéo jouable (ni `status` `ready`, ni ancien lien collé `hasPastedUrl`) ; sinon « Gratuit » ou « Premium » selon `isFree` du backend. Une indication rappelle que seuls les épisodes visibles comptent dans les épisodes gratuits. Après l'enregistrement d'un nouveau réglage « Épisodes gratuits » de la fiche, la colonne se met à jour sans recharger.
- **AC-13**: **Publication.** Lancer une vidéo pour un épisode qui n'est pas encore visible (`status` différent de `ready` et pas de lien collé : « Aucune vidéo », ou un premier envoi en traitement ou en erreur) ouvre d'abord « Publier l'épisode ? » : « L'épisode deviendra visible des spectateurs dès que sa vidéo sera prête, et les abonnés de ses catégories peuvent être prévenus. Cette annonce ne peut pas être annulée. » ; « Publier » lance, « Annuler » ne lance rien. Pas de confirmation pour remplacer une vidéo ni pour migrer un lien collé (l'épisode est déjà visible).
- **AC-14**: « Supprimer » ouvre une confirmation (`confirmDanger`) nommant l'épisode et listant ce qui sera effacé (sa vidéo, sa vignette et l'historique de visionnage des spectateurs), et arrête d'abord un envoi en cours pour cet épisode ; après confirmation, l'épisode disparaît avec « Épisode supprimé. ». Un épisode déjà supprimé (`404`) disparaît aussi, avec « Cet épisode avait déjà été supprimé. ».
- **AC-15**: Fermer la fenêtre d'un épisode avec des changements non enregistrés demande « Abandonner les changements ? ». Une fenêtre modifiée ou un envoi en cours active la protection de la page (spec 0005, AC-12) : quitter la fiche ou fermer l'onglet demande confirmation, avec « Un envoi de vidéo est en cours. Quitter l'arrêtera. » quand un envoi est actif ou en attente (le texte de la question devient un paramètre de `useUnsavedChangesGuard`). Une fin de session arrête les envois, mis en « interrompu », sans notification par envoi.
- **AC-16**: Pendant un envoi au backend, le bouton montre un chargement et un second clic n'envoie rien. `429` (reconnu à son seul statut, sur toutes les routes vidéo) → « Trop d'envois en peu de temps : réessayez dans quelques minutes. », ou la pause de la file (AC-7) ; `503` → « Le service vidéo est indisponible pour le moment. » ; `404` à l'ajout → retour à `/series` avec « Cette série n'existe plus. » ; `404` ailleurs → « Cet épisode n'existe plus. » et la fiche est rechargée ; les autres erreurs suivent la spec 0002.
- **AC-17**: Chaque tableau a une légende « Saison N », chaque bouton d'action a un nom complet (« Modifier l'épisode 3 de la saison 1 »), chaque barre de progression a un nom (« Envoi de la vidéo de l'épisode 3 de la saison 1 ») et sa valeur, chaque champ a un libellé et son erreur, et tout se fait au clavier.
- **AC-18**: La fonctionnalité est en ligne (API puis dashboard, CSP comprise) ; l'engineer ouvre en production la fiche d'une série et vérifie ses épisodes et leurs états, sans rien enregistrer. Un vrai envoi de bout en bout est contrôlé en local, sur l'API locale configurée avec Cloudflare.

## Decision

**Chosen option**: Option 1 : section « Épisodes » sur la fiche, fenêtre de formulaire, vidéos envoyées depuis le navigateur directement à Cloudflare Stream par les liens à usage unique du backend, envois gérés en arrière plan par un état propre à la fiche

Le backend fournit déjà l'hébergement vidéo (spec backend 0006) : le dashboard l'utilise tel quel, avec `tus-js-client` pour les gros fichiers. Chaque écriture d'épisode renvoie la série admin à jour, posée dans le cache de la fiche. Un seul ajout au backend : importer le lien collé déjà stocké.

**Implementation skills**: `mantine-form` (`mantinedev/skills`, `.agents/skills/mantine-form/`) · `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Le raisonnement et les options comparées sont dans [rationale.md](rationale.md).

## Feature design

### Source du design

`design.md` et la vitrine `/dev/composants` (spec 0003). Aucune nouvelle couleur sans mesure dans les deux modes. Le tableau suit l'apparence de `DataTable`, sans pagination.

### Ce que le backend fournit (spec backend 0006, Cloudflare configuré en production)

| Route (admin) | Corps | Réponse | Effet |
|---|---|---|---|
| `POST /series/:id/episodes` | épisode sans vidéo | `{ message, series }` | épisode créé, état `none` |
| `PATCH /series/:id/episodes/:s/:e` | `title`, `description`, `duration`, `releaseDate` | `{ message, series }` | `videoUrl` refusé (décision backend) |
| `DELETE /series/:id/episodes/:s/:e` | | `{ message, series }` | vidéos Cloudflare, vignette et historique effacés |
| `POST …/:s/:e/video/upload` | `{ uploadLength }` (octets, 1 à 30 Go) | `{ message, method: 'post' \| 'tus', uploadUrl, uid, expiresAt }` | lien à usage unique ; `pendingStatus: awaiting_upload` |
| `POST …/:s/:e/video/import` | `{ url }` (`https`) | `{ message, uid, pendingStatus: 'processing' }` | Cloudflare télécharge ; refus de Cloudflare → `400` avec son message |
| `POST …/:s/:e/video/refresh` | | `{ message, series }` | état relu chez Cloudflare (repli du webhook) |
| `DELETE …/:s/:e/video` | | `{ message, series }` | vidéo retirée, épisode invisible (si pas de lien collé) |

- Un nouvel envoi ou import pendant qu'un autre attend le remplace ; deux demandes simultanées laissent une seule vidéo en attente (`409` pour la perdante).
- Envoi, import, vérification et retrait partagent la limite des images (couverture, bannière, vignettes) : 10 appels par 10 minutes et par admin, réponses en erreur comprises (`429`, sans code, avec l'en tête `Retry-After`). `refresh` coûte un appel même sans rien en attente.
- **Relire la fiche ne demande jamais l'état à Cloudflare** : seuls le webhook et `refresh` font passer une vidéo à « Prête ». Sans eux, un envoi réussi resterait `awaiting_upload` et serait expiré, puis effacé, à la date du lien. D'où la vérification automatique après chaque envoi (AC-9).
- Le passage à « Prête » (webhook ou vérification) met en file l'annonce aux abonnés, comme un lien collé à l'ajout.
- Un lien d'envoi jamais utilisé expire : à sa date, la fiche admin le passe en `error` avec `pendingError: 'upload_expired'`.
- Les schémas Zod de ces réponses tolèrent le champ `message` (retiré par Zod).

### Prérequis backend (`noli-backend`) : importer le lien collé stocké

- `ImportVideoDto` : `url` devient facultatif, et un champ `fromPastedLink?: boolean` est ajouté ; exactement l'un des deux est requis (`400` sinon : « Donnez url ou fromPastedLink »).
- Avec `fromPastedLink: true`, le service lit le `videoUrl` collé de l'épisode et l'importe comme un `url` ordinaire (même `copyFromUrl`, même suite). Sans lien collé, `400` « Aucun lien collé à importer ». Un lien collé que Cloudflare refuse (par exemple en `http://`) renvoie son message au dashboard.
- Le lien ne quitte jamais le serveur : la règle « aucun `videoUrl` dans les réponses » (AC-10 du backend) reste vraie.
- Tests : import du lien stocké, absence de lien, les deux champs, aucun champ ; le reste du comportement de l'import ne change pas.
- Livré avec ses tests dans `noli-backend`, puis l'API est redéployée avant la mise en ligne du dashboard.

### Données

- **Source :** les épisodes arrivent dans la fiche admin déjà chargée (`GET /series/:id/admin`, spec 0005), triés. Aucune requête de plus.
- **Schéma :** `adminSeriesSchema` (spec 0005) reçoit `episodes`, tolérant :

```ts
const adminEpisodeSchema = z.object({
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  title: z.string(),
  description: z.string().nullish(),
  duration: z.number().nullish(),             // secondes
  releaseDate: z.string().nullish(),          // ISO
  isFree: z.boolean().nullish().transform((v) => v ?? false),
  video: z.object({
    status: z.string(),                       // ready | pending | error | legacy | none ; autre → « — »
    pendingStatus: z.string().nullish(),      // awaiting_upload | processing | error
    pendingError: z.string().nullish(),
    pendingExpiresAt: z.string().nullish(),
    hasPastedUrl: z.boolean().nullish(),
  }).nullish(),
})
episodes: z.array(adminEpisodeSchema).nullish().transform((v) => v ?? [])
```

- **Fonctions d'API** (`src/features/series/api.ts`) : `addEpisode`, `updateEpisode`, `deleteEpisode`, `requestVideoUpload`, `importVideo`, `importPastedVideo`, `refreshVideo`, `removeVideo`. Une réponse `{ message, series }` passe par `adminSeriesResponseSchema`, puis `setQueryData(['series', 'detail', id], series)` et `invalidateQueries(['series', 'list'])`. `requestVideoUpload` et les imports ne renvoient pas la série : après eux, `invalidateQueries` de la fiche.
- **Rechargement automatique :** `useSeriesDetail` reçoit un `refetchInterval` de 15 secondes tant qu'un épisode a `video.pendingStatus` égal à `processing`, ou égal à `awaiting_upload` pendant qu'une tâche locale de cet épisode est en `demande` ou `envoi` ; `false` sinon. `refetchIntervalInBackground` reste `false` (pause onglet caché). C'est une lecture (`GET`), hors de la limite des 10 appels.
- **Vérification automatique :** quand une tâche passe à `terminé`, `refreshVideo` est appelé une fois ; ensuite, tant que cet épisode est en traitement et que la fiche est ouverte, au plus un `refreshVideo` par minute pour cet épisode. Ces appels comptent dans la limite et respectent la pause de la file.
- **Page :** `SeriesDetailPage` affiche la fiche dès que `query.data` existe, même si une relecture échoue ; une erreur de relecture devient un bandeau discret (« La fiche n'a pas pu être actualisée. ») et n'arrête jamais les envois.
- **Fiche :** le formulaire de la série (spec 0005) garde sa propre base ; les mises à jour du cache par les épisodes ne la touchent pas. L'aperçu suit `totalEpisodes`, la section compte `episodes.length`.
- **Copie figée :** à l'ouverture de la fenêtre, l'épisode (ou, à l'ajout, la liste des épisodes) est copié ; la base de comparaison et les valeurs proposées viennent de cette copie. La zone Vidéo, elle, suit l'état en direct de l'épisode.

### Envois en arrière plan (`VideoUploadsProvider`, `src/features/series/episodes/uploads/`)

- **Portée :** un fournisseur React (`useReducer`) monté par la fiche d'une série ; il disparaît avec elle. Pas d'état au niveau du module (règle d'`AGENTS.md`).
- **Tâche d'envoi :** `{ clé: 'saison:numéro', fichier, état: 'en attente' | 'demande' | 'envoi' | 'terminé' | 'interrompu' | 'annulé', progression (0 à 1), lien: { method, uploadUrl, uid, expiresAt } | undefined, erreur }`. Le fichier est libéré quand la tâche est `terminé`.
- **File :** une seule tâche en `demande` ou `envoi` à la fois ; les autres attendent, dans l'ordre d'ajout.
- **Déroulé d'une tâche :**
  1. `requestVideoUpload(id, s, e, file.size)` → `{ method, uploadUrl }` ;
  2. `method === 'post'` : `XMLHttpRequest` `POST uploadUrl` avec un `FormData` (champ `file`), progression par `xhr.upload.onprogress`, sans en tête d'autorisation (lien à usage unique) ;
  3. `method === 'tus'` : `new tus.Upload(file, { uploadUrl, chunkSize: 50 Mio, retryDelays: [0, 3000, 10000, 30000], onProgress, onSuccess, onError })`, puis `start()`. `uploadUrl` est le lien créé par le backend : le client ne crée rien chez Cloudflare ;
  4. succès : état `terminé`, rechargement de la fiche (l'épisode passe en « En traitement »), et le rechargement automatique prend le relais ;
  5. échec : état `interrompu` avec le message ; « Relancer » reprend avec le **même lien** tant que `expiresAt` n'est pas passé (en tus, `tus-js-client` reprend où il en était), et ne redemande un lien (étape 1) qu'après expiration ou sur un refus du lien ; redemander un lien remplace et efface la vidéo en attente côté backend.
- **Pause de la file (`429`) :** la file attend la durée de `Retry-After` (2 minutes sinon), affiche « Pause : limite d'envois atteinte, reprise à HH h MM », puis reprend ; la tâche en cours reste en tête de file.
- **Durée du lien :** si, après une minute d'envoi, le débit observé annonce une fin après `expiresAt`, la ligne avertit : « À ce rythme, l'envoi risque de dépasser la durée du lien (fin vers HH h MM). ». `/develop` vérifie la durée réelle d'un lien tus sur l'API locale configurée.
- **Autre admin ou disparition :** si une relecture montre que l'épisode d'une tâche en `envoi` n'est plus en `awaiting_upload` sous notre `uid` attendu (un autre admin a lancé une vidéo, ou elle est déjà traitée), la tâche est arrêtée avec « Une autre vidéo a été lancée pour cet épisode. » ; si l'épisode a disparu (relecture ou `404`), ses tâches sont retirées.
- **Fin de session :** quand la session se termine (spec 0002), toutes les tâches sont arrêtées et passent en `interrompu`, sans notification par tâche.
- **Réponse de Cloudflare :** l'envoi simple renvoie `200` sans corps utile (non lu) ; un refus de Cloudflare (`4xx`) donne le texte fixe « Cloudflare a refusé le fichier. ».
- **Annuler l'envoi :** `xhr.abort()` ou `upload.abort(true)`. Le lien inutilisé expire tout seul côté backend ; aucune vidéo existante n'est touchée.
- **Fichier :** `accept="video/*"`. Au delà de 32 212 254 720 octets : « Fichier trop lourd : 30 Go au plus. ». La durée est lue par un élément `video` avec `preload="metadata"` sur une adresse `blob:`, révoquée ensuite ; au delà de 10 800 s : « Vidéo trop longue : 3 heures au plus. » ; illisible, pas de contrôle (le backend et Cloudflare refusent au besoin).
- **CSP (`render.yaml`) :** `connect-src` ajoute `https://upload.videodelivery.net` (adresse d'envoi de Cloudflare Stream, simple et tus) ; `media-src blob:` est ajouté pour lire la durée du fichier choisi. `/develop` confirme les vraies adresses renvoyées par l'API locale configurée (envoi simple et tus) et ajuste la liste.

### Section « Épisodes » (`EpisodesSection`, `src/features/series/episodes/`)

- `Paper withBorder` avec :
  - le titre `h2` « Épisodes », et le nombre (« 8 épisodes », `episodes.length`) ;
  - l'indication « Seuls les épisodes visibles (avec une vidéo prête ou un lien) comptent dans les épisodes gratuits. » en texte secondaire ;
  - le bouton « Ajouter un épisode » (`IconPlus`).
- **Regroupement :** `groupBySeason(episodes)` (fonction pure), saisons et épisodes croissants.
- **Un tableau par saison**, avec la légende `<caption>` « Saison N ».

| Colonne | Contenu |
|---|---|
| N° | `episodeNumber`, aligné à droite |
| Titre | `title` en graisse 600 |
| Durée | `formatDuration(duration)` ; absente ou nulle : « — » |
| Sortie | `formatDate(releaseDate, { timeZone: 'UTC' })`, ou « — » |
| Accès | « Non visible » (`gray`) si `status` n'est pas `ready` et que `hasPastedUrl` est faux ; sinon « Gratuit » (`gray`) si `isFree`, « Premium » (`noliAmber`) |
| Vidéo | badge d'état (tableau ci dessous) et sa ligne de détail ; pendant un envoi du navigateur : barre `Progress` + « Envoi 42 % » + `ActionIcon` « Annuler l'envoi » ; en attente : « En attente d'envoi » ; en pause : le texte de pause ; interrompu : « Envoi interrompu » + bouton « Relancer » |
| Actions | `ActionIcon` « Modifier » (`IconPencil`) et « Supprimer » (`IconTrash`), noms complets de l'AC-17, infobulles |

- **Vide :** `EmptyState` « Aucun épisode pour le moment », « Ajoutez le premier épisode de la série. », bouton « Ajouter un épisode ».

### États de vidéo

| `video.status` | Badge | Couleur (`light`) | Détail sous le badge |
|---|---|---|---|
| `ready` | Prête | `green` | « Remplacement en cours » si `pendingStatus` vaut `awaiting_upload` ou `processing` ; « Le remplacement a échoué » si `error` |
| `pending` | En traitement | `noliIndigo` | « En attente du fichier » si `awaiting_upload` ; « Ancien lien encore joué » si `hasPastedUrl` |
| `error` | Erreur | `noliRed` | `pendingError`, « Lien d'envoi expiré » pour `upload_expired` ; « Ancien lien encore joué » si `hasPastedUrl` |
| `legacy` | Lien collé | `noliAmber` | « Non protégé » |
| `none` ou absent | Aucune vidéo | `gray` | |
| autre valeur | — | | |

Le couple `green` `light` est nouveau : son contraste est mesuré dans les deux modes avant usage (4,5:1 au moins), sinon le texte passe à une nuance plus foncée, comme pour l'ambre.

### Fenêtre d'épisode (`EpisodeModal`)

- `Modal` Mantine, titre « Ajouter un épisode » ou « Modifier l'épisode M de la saison N », largeur `lg`.
- **Partie « Informations » :** `useForm` en mode `uncontrolled`, avec `schemaResolver(makeEpisodeSchema({ mode, initialReleaseDate }), { sync: true })`, `<form noValidate>` et `onValuesChange` vers un état local (comme la fiche, spec 0005).

| Champ | Composant | Valeur | Règle et message |
|---|---|---|---|
| Saison | `NumberInput` (ajout) ; texte « Saison N · Épisode M » (modification) | `seasonNumber: number \| ''` | entier de 1 à 100 : « Saison entre 1 et 100. » |
| Numéro | `NumberInput` (ajout) | `episodeNumber: number \| ''` | entier de 1 à 1 000 : « Numéro entre 1 et 1 000. » |
| Titre | `TextInput`, obligatoire | `title: string` | espaces du bord retirés ; « Titre requis. », « 100 caractères au plus. » |
| Durée | deux `NumberInput` (« Durée, minutes » de 0 à 600 et « Durée, secondes » de 0 à 59) dans un `Input.Wrapper` « Durée », une seule erreur reliée aux deux | `durationMinutes`, `durationSeconds` | total ≥ 1 s : « Durée d'au moins 1 seconde. » ; « Secondes entre 0 et 59. » |
| Description | `Textarea` autosize, de 3 à 8 lignes, compteur « N / 1 000 » | `description: string` | « 1 000 caractères au plus. » |
| Date de sortie | `TextInput type="date"` | `releaseDate: string` (`AAAA-MM-JJ` ou vide) | date valide ; en modification, vider une date existante : « La date de sortie ne peut pas être retirée, seulement modifiée. » |

- **Partie « Vidéo » :** `Tabs` « Envoyer un fichier » (`FileInput`, `accept="video/*"`) et « Depuis un lien » (`TextInput type="url"`, placeholder `https://…` ; règle : `new URL` valide, protocole `https:`, nom d'hôte avec un point : « Lien https valide requis. »). Texte d'aide permanent : « Sans vidéo, l'épisode n'est pas visible des spectateurs. »
  - **à l'ajout :** facultative ; elle part après la création de l'épisode ;
  - **en modification :** les actions de l'AC-10 selon l'état en direct de l'épisode. Elles s'exécutent tout de suite, indépendamment de « Enregistrer » ; un envoi de fichier ferme la fenêtre et continue sur la ligne.
- **Valeurs de départ (ajout) :** saison = `min(plus grande saison, 100)` (1 si aucune) ; numéro = `nextEpisodeNumber(épisodes, saison)` ; changer la saison le recalcule tant que Numéro n'a pas été touché ; durée 0 et 0, préremplie depuis le fichier choisi si la durée n'a pas été touchée ; le reste vide.
- **Valeurs de départ (modification) :** celles de l'épisode ; durée découpée en minutes et secondes (0 et 0 si elle manque) ; date coupée à `AAAA-MM-JJ` en UTC. La fenêtre ne modifie que `duration`, même pour une vidéo hébergée.
- **Date :** envoyée à `AAAA-MM-JJT12:00:00.000Z` (midi UTC) ; affichée et préremplie en UTC (`formatDate` reçoit une option `{ timeZone: 'UTC' }`).
- **Ajout, corps (`toEpisodeCreatePayload`, fonction pure) :** `seasonNumber`, `episodeNumber`, `title` nettoyé, `duration` en secondes, et seulement s'ils sont remplis après nettoyage : `description`, `releaseDate`. Jamais `null`, jamais de `videoUrl`.
- **Modification, corps (`toEpisodePatch`, fonction pure) :** seuls les champs différents de la copie figée (description vidée → `null`), jamais saison ni numéro, jamais une date vide. « Modifié » = `changedEpisodeFields(copie, valeurs)`, partagé par « Enregistrer », la question de fermeture et la protection de la page ; seuls les champs modifiés sont validés.
- **Ordre à l'ajout avec vidéo :** validation → si vidéo donnée, confirmation « Publier l'épisode ? » → `POST` de l'épisode → tâche d'envoi (fichier) ou `importVideo` (lien) pour le nouvel épisode.
- **Boutons :** « Annuler » et « Ajouter l'épisode » ou « Enregistrer » ; noms pendant l'envoi : « Ajout en cours », « Enregistrement en cours » ; un drapeau `useRef` empêche un second envoi.
- **Focus :** à l'ouverture, Saison (ajout) ou Titre (modification) ; à un envoi invalide, le premier champ en erreur.
- **Fermeture :** croix, Échap, clic dehors et « Annuler » passent par `requestClose` : sans changement, fermeture ; avec changements, « Abandonner les changements ? » (« Continuer la saisie » par défaut, « Abandonner » en `noliRed.8`). Pendant un envoi au backend, la fenêtre ne se ferme pas.
- **Protection de la page :** « modifié » de la fenêtre, plus « envoi actif ou en attente », s'ajoutent au « modifié » du formulaire de la série pour activer `useUnsavedChangesGuard` (spec 0005), `beforeunload` compris ; avec un envoi, le texte de la question devient « Un envoi de vidéo est en cours. Quitter l'arrêtera. ». Un départ accepté ferme la fenêtre et annule les envois.

### Confirmations

- **Publier l'épisode ?** : `modals.openConfirmModal`, « Annuler » par défaut, « Publier » ; avant un envoi ou un import pour un épisode pas encore visible (`status !== 'ready'` et `hasPastedUrl` faux). Pas pour un remplacement ni pour la migration d'un lien collé.
- **Retirer la vidéo ?** : `confirmDanger` « Retirer la vidéo de l'épisode M de la saison N ? », « L'épisode ne sera plus visible des spectateurs. La vidéo hébergée sera effacée. », bouton « Retirer ».
- **Supprimer l'épisode M de la saison N ?** : `confirmDanger`, « « <titre> » sera supprimé définitivement, avec sa vidéo, sa vignette et l'historique de visionnage des spectateurs pour cet épisode. ». Une tâche d'envoi de cet épisode est annulée avant le `DELETE`.

### Erreurs

Dans cet ordre :
- **`400` « Episode already exists » :** « Cet épisode existe déjà dans cette saison. » sous Numéro, focus sur Numéro, aucune vidéo envoyée.
- **`400` de l'import (refus de Cloudflare, lien collé absent) :** le message du backend dans une `Alert` de la zone Vidéo.
- **`429` (au seul statut) :** pour une tâche de la file, la pause de la file ; ailleurs, « Trop d'envois en peu de temps : réessayez dans quelques minutes. » (ce texte remplace, pour les routes vidéo, celui de la table de la spec 0002).
- **`503` :** « Le service vidéo est indisponible pour le moment. ».
- **`409` sur une demande vidéo :** une autre demande a gagné : rechargement de la fiche, notification « Une autre demande vient d'être prise en compte pour cette vidéo. ».
- **`400` d'un import en `http://` :** « Lien https valide requis. » (le message du backend peut être un tableau).
- **autre `409` :** `notifyError`, jamais `applyFieldErrors`.
- **`404` à l'ajout :** « Cette série n'existe plus. », navigation vers `/series` (protection levée avant).
- **`404` ailleurs :** « Cet épisode n'existe plus. », fenêtre fermée, fiche rechargée.
- **autre `400` :** `applyFieldErrors(form, error, { seasonNumber: 'season', episodeNumber: 'episodeNumber', title: 'title', description: 'description', duration: 'duration', releaseDate: 'releaseDate' })`.
- **suppression en échec (hors `404`) :** `notifyError` puis rechargement de la fiche.
- **fin de session :** silencieuse (l'écran de connexion l'annonce) ; les tâches passent en « interrompu ».
- **le reste :** `notifyError` (spec 0002).

### Data model sketch

Aucun stockage propre au dashboard. Les épisodes sont un tableau dans le document de la série (backend), identifiés par (`seasonNumber`, `episodeNumber`), unique dans une série ; chaque épisode porte deux emplacements vidéo, l'actuel (`streamUid`) et l'attendu (`pendingStreamUid`), plus un éventuel lien collé ancien.

| Champ (API) | Type | Ajout | Modification | Affichage |
|---|---|---|---|---|
| `seasonNumber`, `episodeNumber` | entiers ≥ 1 | requis, couple unique | figés (dans l'adresse) | regroupement, N° |
| `title` | texte | requis | si changé | Titre |
| `description` | texte ou `null` | si rempli | si changé, `null` si vidé | fenêtre |
| `duration` | entier, secondes | requis | si changé | Durée |
| `releaseDate` | date ISO | si remplie (sinon date du jour par le backend) | si changée, jamais vidée | Sortie |
| `video.status`, `pendingStatus`, `pendingError` | texte | | | Vidéo |
| `isFree` | booléen calculé | | | Accès |
| fichier ou lien de la vidéo | | après la création, par les routes vidéo | par les routes vidéo | progression puis état |

### API surface

Voir le tableau « Ce que le backend fournit », plus le prérequis (`POST …/video/import` avec `{ fromPastedLink: true }`) et l'envoi direct à Cloudflare (`POST` multipart ou `tus` sur `uploadUrl`, sans authentification, adresse à usage unique).

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Section | épisodes, ordre, saisons, nombre | `series.episodes` de la fiche admin ; `groupBySeason` ; `episodes.length` |
| Tableau | durée, date | `formatDuration(duration)` ; `formatDate(releaseDate, { timeZone: 'UTC' })` |
| Tableau | Accès | « Non visible » si `video.status` n'est pas `ready` et que `video.hasPastedUrl` est faux ; sinon `isFree` |
| Tableau | badge et détail vidéo | `video.status`, `video.pendingStatus`, `video.pendingError` |
| Tableau | progression d'envoi | `VideoUploadsProvider` (octets envoyés / taille, de `xhr` ou `tus`) |
| Ajout | saison et numéro proposés | `min(plus grande saison, 100)` et `nextEpisodeNumber` sur la copie figée |
| Ajout | durée proposée | métadonnées du fichier choisi (`video.duration`, arrondie) |
| Ajout et modification | durée envoyée, date envoyée | `minutes × 60 + secondes` ; jour saisi à midi UTC |
| Modification | champs envoyés | `toEpisodePatch(copie figée, valeurs)` |
| Envoi | taille annoncée, méthode, adresse | `file.size` ; `method` et `uploadUrl` renvoyés par `POST …/video/upload` |
| Import | adresse | champ « Depuis un lien » ; pour la migration, le lien stocké côté backend (`fromPastedLink`) |
| Encodage | relecture automatique | un `pendingStatus` `processing`, ou `awaiting_upload` avec une tâche locale active |
| Encodage | vérifications automatiques | fin d'une tâche, puis une par minute au plus pour cet épisode tant qu'il est en traitement |
| File | reprise après pause | en tête `Retry-After` du `429`, sinon 2 minutes |
| Relancer | lien réutilisé ou nouveau | `lien.expiresAt` de la tâche |
| Publication | besoin de confirmer | `video.status !== 'ready'` et `video.hasPastedUrl` faux au moment de lancer la vidéo |
| Toutes écritures | tableau et aperçu à jour | `series` de la réponse, posée dans le cache, ou rechargement de la fiche |
| Erreurs | textes | ce spec ; `toUserMessage` (spec 0002) pour le reste |
| Mise en ligne | série contrôlée | une série existante choisie par l'engineer ; aucune écriture en production |

### Key invariants

- Le couple saison et numéro est unique dans une série ; le dashboard ne change jamais celui d'un épisode existant.
- Une modification n'envoie et ne valide que les champs changés ; jamais de `videoUrl` envoyé.
- Une seule tâche d'envoi active à la fois par fiche ; une tâche n'existe que tant que la fiche est ouverte.
- Aucune vidéo n'est lancée pour un épisode pas encore visible sans la confirmation « Publier l'épisode ? ».
- Un envoi réussi est toujours suivi d'une vérification (`refresh`), pour qu'il ne reste jamais `awaiting_upload` jusqu'à son expiration.
- « Relancer » ne redemande pas de lien tant que celui de la tâche est valide.
- Le dashboard n'envoie jamais de jeton d'authentification à Cloudflare ; il n'utilise que les liens à usage unique du backend.
- Après chaque écriture, le tableau, l'aperçu et les accès reflètent la réponse du backend, sans calcul local.

### Security model

- Toutes les routes sont réservées aux admins par le backend (`403` sinon), avec la limite partagée de 10 appels par 10 minutes.
- Les liens d'envoi sont à usage unique et expirent (environ 6 heures) ; les vidéos créées exigent des liens de lecture signés (spec backend).
- La migration d'un lien collé ne fait jamais transiter ce lien par le navigateur.
- Retirer une vidéo ou supprimer un épisode efface du contenu sans retour possible : les confirmations le disent.

### Configuration required

- **Nouvelle dépendance :** `tus-js-client`, en version exacte épinglée (la dernière stable au moment du build).
- **`render.yaml` :** `connect-src` ajoute `https://upload.videodelivery.net` ; `media-src blob:` est ajouté (adresses confirmées par `/develop`).
- **API locale :** pour contrôler un vrai envoi, le `.env` local de `noli-backend` doit contenir les variables Cloudflare (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, et pour la lecture les clés de signature). Elles sont fournies par l'engineer, jamais commitées. Le webhook n'atteint pas `localhost` : en local, ce sont les vérifications automatiques (`refresh`) et « Vérifier maintenant » qui font passer la vidéo à « Prête ».
- **API de production :** aucune nouvelle variable (Cloudflare déjà configuré) ; redéploiement pour le prérequis.

### Critical test scenarios

- **Section :** deux saisons, deux tableaux triés ; état vide sans épisode. Vérifie **AC-1**.
- **Ajout simple :** saison et numéro proposés, recalcul au changement de saison, 24 min 30 s → `duration: 1470`, date à midi UTC, tableau et aperçu mis à jour. Vérifie **AC-2**, **AC-4**.
- **Validation :** titre vide, durée 0, secondes 75, fichier de 31 Go, lien `http://` : messages, focus, aucun appel. Vérifie **AC-3**.
- **Doublon :** `400` « Episode already exists » → message sous Numéro, aucune vidéo envoyée. Vérifie **AC-5**.
- **Modification :** seul le titre → `{ title }` ; date existante non effaçable. Vérifie **AC-6**.
- **Envoi simple :** fichier de 10 Mo → `upload` avec `uploadLength`, `POST` multipart vers `uploadUrl`, progression affichée, puis un `refresh` automatique, « En traitement », et « Prête » après une vérification. Vérifie **AC-7**, **AC-9**.
- **Pause et reprise :** un `429` met la file en pause avec l'heure de reprise, puis la reprend seule ; « Relancer » avant expiration réutilise le même lien (aucun nouvel appel `upload`). Vérifie **AC-7**.
- **Échec après création :** l'épisode est créé mais `upload` répond `503` → « Épisode ajouté, mais la vidéo n'a pas démarré. » et « Relancer » sur la ligne. Vérifie **AC-4**.
- **Envoi tus :** `method: 'tus'` → `tus.Upload` avec `uploadUrl` fourni et morceaux de 50 Mio (simulé). Vérifie **AC-7**.
- **File et annulation :** deux fichiers → le second « En attente d'envoi » ; « Annuler l'envoi » arrête sans requête au backend ; « Relancer » redemande un lien. Vérifie **AC-7**.
- **Import et migration :** lien `https` → `import { url }` ; « Importer ce lien dans l'hébergement » → `import { fromPastedLink: true }`, sans confirmation de publication ; refus de Cloudflare → message. Vérifie **AC-8**, **AC-13**.
- **États et actions :** les cinq badges et leurs détails ; « Remplacer » sur « Prête » ; « Retirer la vidéo » avec confirmation → `DELETE …/video`. Vérifie **AC-10**, **AC-11**.
- **Accès :** « Non visible », « Gratuit », « Premium » ; un ancien lien avec un remplacement en erreur reste visible. Vérifie **AC-12**.
- **Publication :** épisode « Aucune vidéo » ou premier envoi en erreur → « Publier l'épisode ? », « Annuler » ne lance rien ; remplacement d'une vidéo prête ou migration d'un lien collé sans question. Vérifie **AC-13**.
- **Suppression :** confirmation, envoi en cours annulé, ligne retirée ; `404` déjà supprimé. Vérifie **AC-14**.
- **Protections :** fenêtre modifiée + Échap → « Abandonner les changements ? » ; envoi en cours + clic dans le menu → « Un envoi de vidéo est en cours. Quitter l'arrêtera. ». Vérifie **AC-15**.
- **Erreurs :** double clic, `429`, `503`, `404` à l'ajout et ailleurs. Vérifie **AC-16**.
- **Accessibilité :** légendes, noms complets, barres de progression nommées, clavier. Vérifie **AC-17**.
- **Backend :** `import { fromPastedLink: true }` importe le lien stocké ; sans lien → `400` ; `url` et `fromPastedLink` ensemble → `400`. Vérifie **AC-8**.
- **Bout en bout local :** un vrai fichier envoyé sur l'API locale configurée, jusqu'à « Prête ». **Production, lecture seule :** les épisodes d'une série s'affichent avec leurs vrais états. Vérifie **AC-18**.

## Build plan

Ordonné en Tracer Bullet : d'abord le fil le plus mince de la donnée réelle à l'écran (épisodes lus et affichés), puis la première écriture (ajout), puis la vidéo de bout en bout (un envoi simple jusqu'à « Prête »), puis on épaissit (tus, file, import, migration, remplacement, retrait, protections), et enfin la mise en ligne.

0. Prérequis backend dans `noli-backend` : import du lien collé stocké (`fromPastedLink`), tests, puis redéploiement de l'API, satisfies **AC-8**
1. `adminEpisodeSchema` dans `adminSeriesSchema`, `groupBySeason`, `EpisodesSection` (tableaux par saison, badges et détails, accès, état vide), satisfies **AC-1**, **AC-11**, **AC-12**
2. `EpisodeModal` partie Informations en ajout et en modification : valeurs proposées, schéma, `toEpisodeCreatePayload`, `toEpisodePatch`, copie figée, doublon, date en UTC (option de `formatDate`), satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**
3. Vidéo de bout en bout, envoi simple : `VideoUploadsProvider`, `requestVideoUpload`, `POST` multipart avec progression, ligne « Envoi N % », vérification automatique après l'envoi, relecture automatique, « Vérifier maintenant », fiche maintenue malgré une relecture en échec, CSP de `render.yaml` (adresses confirmées), confirmation de publication ; contrôle réel sur l'API locale configurée, satisfies **AC-7**, **AC-9**, **AC-13**
4. `tus-js-client` (version exacte), file d'envoi, pause sur `429`, annulation, relance sur le même lien, avertissement de durée du lien, autre admin et disparition, fin de session, contrôle du fichier (taille, durée), durée préremplie, échec après création, satisfies **AC-2**, **AC-3**, **AC-4**, **AC-7**
5. Import, migration (`fromPastedLink`), remplacement, retrait de la vidéo, actions selon l'état, satisfies **AC-8**, **AC-10**, **AC-13**
6. Suppression d'un épisode, fermeture avec changements, protection de la page avec les envois, erreurs (`429`, `503`, `409`, `404`), envoi unique, noms et focus, contraste du badge vert, satisfies **AC-14**, **AC-15**, **AC-16**, **AC-17**
7. Mise en ligne : API puis dashboard (avec l'accord de l'engineer), contrôle en lecture seule sur `https://admin.nollli.com`, satisfies **AC-18**

## Consequences

**Positive**:
- Les vidéos sont hébergées et protégées (liens de lecture signés) : un lien partagé ne donne plus accès à un épisode premium.
- L'admin envoie ses vidéos depuis le dashboard, même lourdes et sur une connexion faible (reprise tus), sans bloquer son travail.
- Les anciens liens collés se migrent en un clic, sans jamais exposer le lien.

**Negative / tradeoffs**:
- Un envoi s'arrête si l'admin quitte la fiche ou ferme l'onglet ; il doit relancer.
- Une dépendance de plus (`tus-js-client`) et deux adresses Cloudflare dans la CSP.
- La limite partagée de 10 appels vidéo ou image par 10 minutes ralentit l'envoi de toute une saison.
- La saison et le numéro restent figés ; les déplacer demande de supprimer et recréer.
- Un ajout au backend à livrer et déployer.

**Neutral**:
- Le contrôle d'un vrai envoi se fait en local, avec des variables Cloudflare de développement ; la production n'est contrôlée qu'en lecture.
- La date de sortie est envoyée à midi UTC et affichée en UTC.
- Pas de pagination des épisodes.

## Follow-up

- [ ] Fonctionnalité 8 (images) : vignette d'épisode dans le tableau et la fenêtre.
- [ ] Envois qui survivent à la fermeture de la fiche (reprise tus après rechargement, empreinte stockée), si les admins envoient souvent de très gros fichiers.
- [ ] Backend : déplacer un épisode sans perdre l'historique.
- [ ] `/sync` : noter dans `AGENTS.md` la convention « une écriture qui renvoie la série remplace le cache de la fiche » et l'usage de `tus-js-client`.
