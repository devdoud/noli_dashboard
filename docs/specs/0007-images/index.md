# 0007. Images de série et vignettes d'épisode

**Date**: 2026-10-15
**Status**: In Progress

## Summary

L'admin envoie et retire la couverture et la bannière d'une série depuis une section « Images » de la fiche, et la vignette d'un épisode depuis la fenêtre de modification de l'épisode. Chaque emplacement montre un aperçu du fichier choisi à sa forme réelle, vérifie le fichier dans le navigateur avant tout envoi (format, poids, dimensions), puis l'envoie au backend, qui le range sur Cloudinary (le service qui stocke et sert les images) et le recadre. Rien ne change côté backend : les six routes existent déjà (spec backend 0005). Les envois partagent la limite de 10 appels par 10 minutes avec les vidéos, et le dashboard le dit clairement quand elle est atteinte.

## Requirements

**User stories**:
- En tant qu'admin, je veux envoyer la couverture et la bannière d'une série depuis sa fiche, pour que l'app montre de vraies images sans les héberger ailleurs.
- En tant qu'admin, je veux voir l'image recadrée et savoir si mon fichier convient avant de l'envoyer, pour ne pas gaspiller un envoi sur la limite.
- En tant qu'admin, je veux donner une vignette à un épisode depuis sa fenêtre, pour que la liste des épisodes de l'app soit complète.
- En tant qu'admin, je veux retirer une image en sachant que c'est définitif.

**Acceptance criteria** (le contrat):
- **AC-1**: La fiche d'une série (`/series/:id`) affiche, entre l'aperçu et le formulaire, une section « Images » avec deux emplacements, « Couverture » (forme 2:3) et « Bannière » (forme 16:9). Chacun montre l'image actuelle à sa forme, ou un emplacement vide « Aucune couverture » ou « Aucune bannière ». Un texte d'aide permanent rappelle les règles : « JPEG, PNG ou WebP, 5 Mo au plus. Couverture : 400 × 600 px au moins. Bannière : 1280 × 720 px au moins. 10 envois ou retraits d'images ou de vidéos au plus par 10 minutes. »
- **AC-2**: L'admin choisit un fichier par le bouton « Choisir une image » (ou « Changer la couverture » quand une image existe) ou en le déposant sur l'emplacement. Un fichier valide s'affiche en aperçu à la forme de l'emplacement, recadré au centre, avec la mention « Cloudinary peut décaler le cadre vers le sujet principal. », et deux boutons « Envoyer » et « Annuler ». « Annuler » rend l'image actuelle sans appel à l'API. Rien ne part sans « Envoyer ».
- **AC-3**: Avant tout aperçu, le navigateur vérifie le fichier, dans cet ordre, et s'arrête au premier refus : format (type `image/jpeg`, `image/png` ou `image/webp`, ou à défaut l'extension `.jpg`, `.jpeg`, `.png`, `.webp`) → « Format accepté : JPEG, PNG ou WebP. » ; poids au delà de 5 Mo (5 × 1024 × 1024 octets) → « Image trop lourde : 5 Mo au plus. » ; décodage impossible → « Image illisible. » ; plus grand côté au delà de 5 fois le plus petit → « Image trop étirée : proportion de 5 pour 1 au plus. » ; plus de 25 000 000 pixels → « Image trop grande : 25 mégapixels au plus. » ; largeur ou hauteur sous le minimum de l'emplacement → « Image trop petite : 400 × 600 px au moins (reçue : 300 × 450). » (valeurs de l'emplacement et du fichier, signe `×` entouré d'espaces). Un fichier refusé n'appelle pas l'API, ne s'affiche pas, et ne touche ni l'aperçu précédent ni l'image actuelle : seul le message, sous l'emplacement, change. Une image animée n'est pas détectée par le navigateur : le backend la refuse (AC-8). Ces contrôles sont une aide, pas une garantie : le backend refait tout.
- **AC-4**: « Envoyer » envoie `PUT /series/:id/cover` (ou `/banner`) en multipart, champ `file`. Pendant l'envoi, le bouton montre un chargement, un second clic n'envoie rien, et « Annuler » est désactivé. En cas de succès, l'emplacement montre l'image renvoyée par le backend (pas l'aperçu local), la fiche en cache est remplacée par la réponse, la liste des séries est relue, et « Couverture mise à jour. » ou « Bannière mise à jour. » s'affiche.
- **AC-5**: « Retirer la couverture » (ou « Retirer la bannière »), proposé seulement quand une image existe, ouvre une confirmation (`confirmDanger`) « Retirer la couverture ? » : « L'image sera effacée de l'hébergement. Cette action est définitive. » (pour un lien externe : « Le lien sera retiré de la série. »), bouton « Retirer ». Après confirmation, `DELETE /series/:id/cover`, l'emplacement redevient vide et « Couverture retirée. » s'affiche.
- **AC-6**: La fenêtre de modification d'un épisode (spec 0006) a une partie « Vignette » (forme 16:9, 640 × 360 px au moins) qui fonctionne comme AC-2 à AC-5 sur `PUT` et `DELETE /series/:id/episodes/:s/:e/thumbnail`, indépendamment du bouton « Enregistrer ». Messages : « Vignette mise à jour. », « Vignette retirée. », « Retirer la vignette ? ». La fenêtre d'ajout n'a pas de vignette. Dans le tableau des épisodes, la colonne Titre montre une petite vignette 16:9 devant le titre quand l'épisode en a une.
- **AC-7**: Une image dont l'adresse n'est pas hébergée sur Cloudinary (`res.cloudinary.com`) est un ancien lien collé : l'emplacement l'affiche si elle charge, avec la mention « Lien externe ». Une image qui ne charge pas (lien mort, hôte bloqué par la CSP) montre « Image indisponible » à la place d'une image cassée, avec les mêmes boutons « Changer » et « Retirer ».
- **AC-8**: Les refus du backend, à l'envoi comme au retrait, s'affichent sous l'emplacement concerné, l'aperçu restant prêt à renvoyer : `413` → « Image trop lourde : 5 Mo au plus. » ; `415` et `400` → le message du backend s'il fait partie des messages connus (liste dans « Erreurs »), sinon « Image refusée par le serveur. » ; `429` → « Trop d'envois en peu de temps : la limite est de 10 envois ou retraits d'images ou de vidéos par 10 minutes. Réessayez dans quelques minutes. » ; `503` → « Le service d'images est indisponible pour le moment. » ; `409` → la fiche est relue, « Cette image vient d'être changée par ailleurs. » s'affiche, l'aperçu reste affiché (l'image gagnante apparaît après « Annuler ») et « Envoyer » reste permis ; coupure réseau ou délai dépassé → « Envoi impossible : vérifiez la connexion et réessayez. ». Un `404` sur la fiche → « Cette série n'existe plus. » (règle de la spec 0005) ; un `404` sur une vignette → « Cet épisode n'existe plus. », fenêtre fermée sans question, fiche relue. Le reste suit la spec 0002.
- **AC-9**: Un aperçu en attente ou un envoi en cours (« en attente ») active la protection de la page (spec 0005, `useUnsavedChangesGuard`), comme le formulaire modifié, la fenêtre d'épisode modifiée et les envois de vidéo : quitter la fiche ou fermer l'onglet demande confirmation. Pour la vignette, il compte aussi comme changement de la fenêtre d'épisode : la fermer (croix, Échap, clic dehors, « Annuler ») demande « Abandonner les changements ? » (spec 0006, AC-15). Un départ ou une fermeture accepté abandonne l'aperçu, et son adresse `blob:` est libérée.
- **AC-10**: Chaque emplacement est un groupe nommé (« Couverture », « Bannière », « Vignette »). L'image a un texte alternatif (« Couverture de <titre> », « Vignette de l'épisode M de la saison N ») ; la petite vignette du tableau est décorative (`alt=""`). Chaque bouton a un nom complet (« Changer la couverture », « Retirer la bannière », « Changer la vignette de l'épisode 3 de la saison 1 »). Tout se fait au clavier : le dépôt de fichier a toujours son bouton équivalent. Une erreur s'affiche dans un paragraphe `role="alert"` relié au groupe par `aria-describedby` ; un succès passe par une notification Mantine (déjà annoncée, sans doublon). Après « Envoyer », « Annuler » ou « Retirer », le focus revient au bouton « Choisir » ou « Changer » de l'emplacement.
- **AC-11**: Sur un écran étroit, les deux emplacements de la section s'empilent (deux colonnes à partir de la largeur `sm`) ; la couverture fait 240 px de large au plus, la bannière prend le reste ; aucun défilement horizontal de la page.
- **AC-12**: La fonctionnalité est en ligne (dashboard seulement, la CSP autorise déjà Cloudinary et les adresses `blob:`). Un vrai envoi et un vrai retrait de couverture, de bannière et de vignette sont contrôlés en local sur l'API locale configurée avec Cloudinary ; l'engineer contrôle en production, sans rien enregistrer, que les images existantes s'affichent dans la section et dans le tableau.

## Decision

**Chosen option**: Option 1 : un composant d'emplacement réutilisable (`ImageSlot`), avec aperçu fidèle et contrôles dans le navigateur, posé dans une section « Images » de la fiche et dans la fenêtre d'épisode.

Chaque emplacement est autonome : il choisit, vérifie, prévisualise, envoie et retire son image par ses propres routes, sans passer par le formulaire de la série ni par « Enregistrer » de l'épisode.

**Implementation skills**: `tanstack-query` (`tanstack-skills/tanstack-skills`, `.agents/skills/tanstack-query/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Rationale

Raisonnement et options : voir [rationale.md](rationale.md).

## Feature design

### Ce que le backend fournit (spec backend 0005, en production)

| Emplacement | Routes | Forme et taille stockée | Minimum source |
|---|---|---|---|
| Couverture | `PUT` / `DELETE /series/:id/cover` | 2:3, 1000 × 1500 | 400 × 600 |
| Bannière | `PUT` / `DELETE /series/:id/banner` | 16:9, 1920 × 1080 | 1280 × 720 |
| Vignette d'épisode | `PUT` / `DELETE /series/:id/episodes/:s/:e/thumbnail` | 16:9, 1280 × 720 | 640 × 360 |

- Recadrage par Cloudinary en `crop: 'fill'`, `gravity: 'auto'` (le cadre se place sur le sujet principal, pas forcément au centre).
- Règles communes : JPEG, PNG ou WebP (lus dans les premiers octets), non animé, 5 Mo au plus, proportion de 5:1 au plus, 25 mégapixels au plus, dimensions lues après la rotation EXIF.
- Réponse de chaque route : `{ message, series }`, la série admin complète (même forme que `GET /series/:id/admin`).
- Limite : 10 appels par 10 minutes et par admin, partagée avec les routes vidéo ; un refus compte aussi. Le `429` n'expose pas de temps d'attente lisible par le navigateur.
- Un `DELETE` sur un emplacement vide répond `200`. Un ancien lien collé est seulement vidé, jamais effacé ailleurs.

### Données

- `adminSeriesSchema` : `coverImage` et `bannerImage` sont déjà lus (URL ou `null`).
- `adminEpisodeSchema` : ajouter `thumbnail: z.string().nullish()` (le backend renvoie toujours `null` ou une URL).
- Aperçu local : le `File` choisi, ses dimensions lues et une adresse `blob:` ; il vit dans l'état du composant et n'est jamais stocké. L'adresse `blob:` est révoquée à l'envoi réussi, à « Annuler », au choix d'un autre fichier et au démontage.

### Composants (`src/features/series/images/`)

- `imageRules.ts` (fonctions pures) :
  - `IMAGE_SLOTS` (`cover`, `banner`, `thumbnail`) : `aspectRatio`, `minWidth`, `minHeight`, et tous les textes de l'emplacement (groupe, vide « Aucune couverture » / « Aucune bannière » / « Aucune vignette », « Choisir une image », « Changer la … », « Retirer la … », titre de confirmation « Retirer la … ? », succès « … mise à jour. » et « … retirée. »). Les noms complets de la vignette ajoutent « de l'épisode M de la saison N » (`episodeName` de la spec 0006).
  - `checkImageFile(file, dimensions | undefined, slot)` : message de refus ou `undefined`, dans l'ordre de l'AC-3 (`undefined` en dimensions = décodage impossible).
  - `isHostedImage(url)` : `new URL(url).hostname === 'res.cloudinary.com'`, faux si l'adresse est illisible.
  - `imageErrorMessage(error, slot)` : textes de l'AC-8, partagé par l'envoi et le retrait.
- `readImageDimensions(blobUrl)` : décode l'image dans un élément `img` et lit `naturalWidth` et `naturalHeight` (les navigateurs appliquent la rotation EXIF, comme le backend ; ne pas passer à `createImageBitmap`, qui ne l'applique pas par défaut) ; échec → `undefined`.
- Hooks de mutation dans `src/features/series/api.ts` (TanStack Query) : `useUploadSeriesImage(id, 'cover' | 'banner')`, `useRemoveSeriesImage(id, kind)`, `useUploadEpisodeThumbnail(id, s, e)`, `useRemoveEpisodeThumbnail(id, s, e)`. En cas de succès : `setQueryData` de la réponse sur `seriesKeys.detail(id)` et `invalidateQueries` sur `seriesKeys.lists`, même si l'emplacement a été démonté entre temps (la notification de succès n'est alors pas affichée). Sur `409` : `invalidateQueries` de la fiche.
- `ImageSlot` (composant) : props `slot`, `currentUrl` (`string | undefined`, par exemple `series.coverImage ?? undefined`), `alt`, `nameSuffix`, les deux mutations, `onPendingChange(pending)`. États : vide, image (hébergée, externe, indisponible, en chargement), aperçu, envoi, retrait. Choix par `FileButton` de Mantine (`accept="image/jpeg,image/png,image/webp"`, champ remis à zéro après chaque choix pour pouvoir reprendre le même fichier) et dépôt natif sur la zone. Aperçu dans un `AspectRatio` Mantine avec `object-fit: cover` au centre.
- `SeriesImagesSection` : `Paper` « Images », `SimpleGrid cols={{ base: 1, sm: 2 }}`, couverture 240 px de large au plus, le texte d'aide de l'AC-1 ; elle remonte « en attente » si l'un des deux emplacements l'est.
- Fiche (`SeriesDetailPage`) : la protection reçoit « formulaire modifié OU fenêtre d'épisode modifiée OU envoi vidéo actif OU image en attente ».
- Fenêtre d'épisode (spec 0006) : une partie « Vignette » avec un `ImageSlot`, placée avant la partie Vidéo, hors du `<form>` des informations ; l'épisode est relu en direct dans la fiche par saison et numéro (ils ne changent pas en modification) ; « modifié » de la fenêtre = formulaire modifié OU vignette en attente ; un `404` de la vignette ferme la fenêtre sans question.
- Tableau des épisodes : une image 64 × 36, `alt=""`, `loading="lazy"`, devant le titre quand `thumbnail` existe, cachée si elle ne charge pas.

### Comportement détaillé d'un emplacement

- **Une seule adresse `blob:` par fichier choisi**, utilisée pour le décodage et l'aperçu ; révoquée si le fichier est refusé, à « Annuler », à l'envoi réussi, au choix suivant et au démontage.
- **Choix rapides successifs** : un décodage dont le fichier n'est plus le dernier choisi est ignoré.
- **Dépôt** : `preventDefault` sur `dragover` et `drop` ; le premier fichier est pris ; plusieurs fichiers → « Déposez un seul fichier. » ; un dépôt pendant un envoi ou un retrait est ignoré ; bordure surlignée pendant le survol.
- **Pendant un aperçu**, « Changer » et « Retirer » sont cachés : « Envoyer » et « Annuler » sont les seules sorties.
- **Message d'erreur** : effacé au choix suivant, à « Annuler » et au début d'un envoi ou d'un retrait.
- **Relecture de la fiche** (liste, épisode enregistré, `409`) : un changement de `currentUrl` ne vide jamais un aperçu.
- **Image affichée** : un squelette pendant le chargement ; l'état « indisponible » est remis à zéro à chaque changement d'adresse (l'élément `img` est clé sur l'adresse) ; « Lien externe » vient de `isHostedImage`, sans attendre le chargement.
- **Retrait** : le texte de confirmation dépend de `isHostedImage(currentUrl)` ; un lien Cloudinary mort garde le texte « effacée de l'hébergement ».
- **Un envoi dure 120 s au plus** et ne peut pas être annulé (« Annuler » désactivé pendant l'envoi) : accepté.

### États d'un emplacement

`vide | image` → choisir un fichier → `refusé` (message, rien d'affiché) ou `aperçu` → « Annuler » → retour à `vide | image` ; « Envoyer » → `envoi` → succès → `image` (URL du backend) ; échec → `aperçu` + message. `image` → « Retirer » → confirmation → `retrait` → succès → `vide` ; échec → `image` + message.

### API surface

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/series/:id/cover` | PUT | `file` multipart (req) | `{ message, series }` | admin (jeton) | 400, 404, 409, 413, 415, 429, 503 |
| `/series/:id/cover` | DELETE | aucun | `{ message, series }` | admin | 404, 409, 429, 503 |
| `/series/:id/banner` | PUT | `file` multipart (req) | `{ message, series }` | admin | 400, 404, 409, 413, 415, 429, 503 |
| `/series/:id/banner` | DELETE | aucun | `{ message, series }` | admin | 404, 409, 429, 503 |
| `/series/:id/episodes/:s/:e/thumbnail` | PUT | `file` multipart (req) | `{ message, series }` | admin | 400, 404, 409, 413, 415, 429, 503 |
| `/series/:id/episodes/:s/:e/thumbnail` | DELETE | aucun | `{ message, series }` | admin | 400, 404, 409, 429, 503 |

Fonctions dans `src/features/series/api.ts` : `uploadSeriesImage(id, 'cover' | 'banner', file)`, `removeSeriesImage(id, 'cover' | 'banner')`, `uploadEpisodeThumbnail(id, s, e, file)`, `removeEpisodeThumbnail(id, s, e)`, toutes par le client partagé (`apiRequest` avec un `FormData`, délai d'envoi de 120 s déjà prévu) et `adminSeriesResponseSchema`.

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Section | image actuelle de chaque emplacement | `series.coverImage`, `series.bannerImage` de la fiche admin |
| Fenêtre d'épisode, tableau | vignette | `episode.thumbnail` de la fiche admin (champ ajouté au schéma) |
| Emplacement | forme, minimum, libellés, messages | table `IMAGE_SLOTS` (valeurs de la spec backend 0005) |
| Contrôle | format | `file.type` du fichier choisi (`image/jpeg`, `image/png`, `image/webp`) |
| Contrôle | poids | `file.size`, comparé à 5 × 1024 × 1024 octets |
| Contrôle | dimensions, proportion, mégapixels | `naturalWidth` et `naturalHeight` lus par `readImageDimensions` |
| Aperçu | image recadrée | adresse `blob:` du fichier, `object-fit: cover` centré dans la forme de l'emplacement |
| Mention « Lien externe » | hébergée ou non | `isHostedImage(url)` : hôte `res.cloudinary.com` |
| Mention « Image indisponible » | chargement en échec | évènement `error` de l'élément `img` |
| Envoi | corps | `FormData` avec le champ `file` |
| Après écriture | image affichée, tableau, aperçu de la fiche | `series` de la réponse, posée dans le cache de la fiche ; liste relue |
| Erreurs | textes | AC-8 de ce spec, `toUserMessage` (spec 0002) pour le reste |
| Texte alternatif | titre, saison, numéro | `series.title`, `episode.seasonNumber`, `episode.episodeNumber` |

### Key invariants

- Aucun envoi sans « Envoyer », et jamais un fichier refusé par les contrôles du navigateur.
- Un seul appel à la fois par emplacement (drapeau `useRef`, comme les autres formulaires).
- Après un succès, l'image affichée vient toujours de la réponse du backend, jamais de l'aperçu local.
- Une adresse `blob:` créée est toujours révoquée (envoi, annulation, nouveau choix, démontage).
- Un refus du backend ne perd jamais l'aperçu : l'admin peut renvoyer sans choisir à nouveau.
- Les images ne passent jamais par le formulaire de la série ni par « Enregistrer » de l'épisode, et un envoi d'image ne touche pas la file des vidéos.

### Security model

- Toutes les routes sont réservées aux admins par le backend (`403` sinon) ; le dashboard envoie le jeton par le client partagé, jamais à Cloudinary directement.
- Les fichiers ne sont lus que dans le navigateur de l'admin (adresse `blob:` locale) ; aucune donnée personnelle.
- La CSP actuelle (`img-src` avec `res.cloudinary.com` et `blob:`) couvre l'affichage et l'aperçu ; aucun nouvel hôte n'est ajouté. Un ancien lien vers un autre hôte reste bloqué et s'affiche « Image indisponible » (AC-7).

### Configuration required

Aucune. Pas de nouvelle variable, pas de nouvelle dépendance, pas de changement de CSP ni de backend.

### Erreurs (dans cet ordre)

- Contrôles du navigateur (AC-3) : avant tout appel.
- `413` → texte fixe de l'AC-8 (le message de multer peut être en anglais).
- `415`, `400` → le message du backend s'il commence par l'un des messages connus (« Images animées non acceptées », « Image illisible », « Image invalide », « Image trop petite », « Image trop étirée », « Image trop grande », « Format non accepté »), sinon « Image refusée par le serveur. » (un champ manquant donne un texte anglais de Nest) ; le message peut être une chaîne ou un tableau (`backendMessage` de `ApiError`).
- Coupure réseau, délai dépassé → « Envoi impossible : vérifiez la connexion et réessayez. », aperçu gardé.
- `429` → texte de l'AC-8 (surcharge du texte de la spec 0002 pour les routes d'image).
- `503` → texte de l'AC-8.
- `409` → `invalidateQueries` de la fiche (la réponse ne porte pas de série), message de l'AC-8, aperçu gardé ; dans la fenêtre d'épisode, la fenêtre reste ouverte.
- `404` → série : « Cette série n'existe plus. » et l'écran « Série introuvable » à la relecture ; vignette : « Cet épisode n'existe plus. », fenêtre fermée, fiche relue.
- Fin de session : silencieuse (l'écran de connexion l'annonce).
- Le reste : `notifyError` (spec 0002).

### Critical test scenarios

- Section : couverture hébergée, bannière vide, textes d'aide, groupes nommés, verifies **AC-1**, **AC-10**.
- Aperçu : un PNG valide déposé puis choisi par le bouton s'affiche à la forme, « Annuler » revient sans appel, verifies **AC-2**.
- Contrôles : GIF, 6 Mo, 300 × 450 pour la couverture, 6000 × 1000, 7000 × 4000, fichier corrompu : chaque message, aucun appel, verifies **AC-3**.
- Envoi : `PUT` multipart avec le champ `file`, chargement, double clic ignoré, image de la réponse affichée, liste relue, verifies **AC-4**.
- Retrait : confirmation, `DELETE`, emplacement vide ; texte propre au lien externe, verifies **AC-5**, **AC-7**.
- Vignette : partie « Vignette » de la fenêtre d'épisode, envoi indépendant d'« Enregistrer », petite vignette dans le tableau, verifies **AC-6**.
- Lien externe et image cassée : mention et remplaçant, verifies **AC-7**.
- Refus : `413`, `415`, `400`, `429`, `503`, `409` (fiche relue), `404` : messages, aperçu gardé, verifies **AC-8**.
- Protection : aperçu en attente puis navigation → « Quitter sans enregistrer ? » ; fenêtre d'épisode avec vignette en aperçu → « Abandonner les changements ? », verifies **AC-9**.
- Écran étroit : emplacements empilés, verifies **AC-11**.
- Bout en bout local et contrôle en production, verifies **AC-12**.

## Build plan

Approche Tracer Bullet : d'abord un fil complet sur la couverture, branché sur la vraie API, puis on l'épaissit.

1. Ajouter `thumbnail` au schéma des épisodes, les quatre fonctions d'API et leurs hooks de mutation, la table `IMAGE_SLOTS`, `checkImageFile`, `readImageDimensions`, `isHostedImage`, `imageErrorMessage`, avec leurs tests unitaires, satisfies **AC-3**, **AC-4**, **AC-8**.
2. `ImageSlot` et la section « Images » avec la couverture seule, de bout en bout : choix par bouton, contrôles, aperçu, « Envoyer », image de la réponse, cache remplacé, « Retirer » avec confirmation ; essai réel en local, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**.
3. Bannière dans la section, puis la partie « Vignette » de la fenêtre d'épisode et la petite vignette du tableau, satisfies **AC-1**, **AC-6**.
4. Dépôt de fichier, lien externe, image indisponible, tous les refus du backend, protection de la page et de la fenêtre, satisfies **AC-2**, **AC-7**, **AC-8**, **AC-9**.
5. Accessibilité (noms, textes alternatifs, `aria-live`, clavier) et écran étroit ; tests d'intégration avec MSW, satisfies **AC-10**, **AC-11**.
6. Mise en ligne du dashboard (confirmation de l'engineer avant de pousser), essai réel complet en local, contrôle en production en lecture seule, satisfies **AC-12**.

## Consequences

**Positive**:
- Les admins n'ont plus besoin d'héberger les images ailleurs ni de passer par Swagger.
- Les refus courants (format, poids, dimensions) sont signalés sans dépenser un appel de la limite.
- Un seul composant sert les trois emplacements, et servira aussi l'image de catégorie (fonctionnalité 9).
- Aucun changement au backend ni à la configuration : la mise en ligne ne touche que le dashboard.

**Negative / tradeoffs**:
- L'aperçu est recadré au centre alors que Cloudinary cadre sur le sujet : l'image stockée peut différer un peu de l'aperçu (la mention le dit).
- Sans compteur réel, l'admin ne voit pas combien d'envois il lui reste avant le `429` ; il découvre la limite en l'atteignant.
- Les images animées ne sont détectées que par le backend (un appel perdu dans ce cas rare).
- Les images et les vidéos partagent la même limite : un gros travail vidéo peut bloquer un envoi d'image pendant quelques minutes.

**Neutral**:
- La vignette ne peut pas être choisie à l'ajout d'un épisode : on l'ajoute ensuite par « Modifier ».
- Les images ne sont pas proposées sur la page de création d'une série : on les ajoute sur la fiche, juste après « Créer ».
- `@mantine/dropzone` n'est pas ajouté ; le dépôt natif suffit.

## Follow-up

- [ ] Réutiliser `ImageSlot` pour l'image de catégorie (forme 1:1, 400 × 400 px au moins) dans la fonctionnalité 9 « Catégories ».
- [ ] Si la limite gêne au quotidien : faire exposer par le backend ses en têtes de limite (restant, remise à zéro) au navigateur, puis afficher un compteur réel.
- [ ] Si l'écart entre l'aperçu centré et le recadrage `gravity: 'auto'` gêne : demander au backend un cadrage centré, ou ajouter un outil de recadrage.
