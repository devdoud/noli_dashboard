# Verify: images de série et vignettes d'épisode · spec 0007 · mis à jour le 2026-10-15
_Étapes tirées des critères de la spec 0007. `/check verify` les exécute ; `/test` fige les durables._

À faire en local (dashboard `http://localhost:5173`, API `http://localhost:3000` avec les variables Cloudinary), sur une série de test supprimée à la fin. Les images de test : une couverture de 800 × 1200, une de 300 × 450, une bannière de 1600 × 900, une vignette de 960 × 540, une image de 3000 × 500, un fichier texte renommé en `.png`.

## UI / manuel
- [x] Ouvrir la fiche d'une série sans image → section « Images » entre l'aperçu et le formulaire, « Aucune couverture », « Aucune bannière », texte d'aide avec « 10 envois ou retraits d'images ou de vidéos » → AC-1
- [x] Couverture : choisir l'image de 300 × 450 → « Image trop petite : 400 × 600 px au moins (reçue : 300 × 450). », aucun appel réseau → AC-3
- [x] Couverture : choisir le texte renommé en `.png` → « Image illisible. » ; l'image de 3000 × 500 → « Image trop étirée : proportion de 5 pour 1 au plus. » → AC-3
- [x] Couverture : choisir l'image de 800 × 1200 → aperçu 2:3, mention « Cloudinary peut décaler le cadre vers le sujet principal. », « Envoyer » et « Annuler » ; « Annuler » → retour sans appel → AC-2
- [x] Bannière : déposer deux fichiers à la fois → « Déposez un seul fichier. » ; déposer la bannière de 1600 × 900 → aperçu 16:9 → AC-2
- [x] Envoyer la couverture → un `PUT /series/:id/cover` multipart (champ `file`), « Couverture mise à jour. », image servie par `res.cloudinary.com`, focus sur « Changer la couverture », aperçu de la fiche et liste des séries à jour → AC-4
- [x] « Retirer la couverture » → « Retirer la couverture ? » avec « L'image sera effacée de l'hébergement. Cette action est définitive. » → `DELETE`, « Couverture retirée. », « Aucune couverture » → AC-5
- [x] Modifier un épisode → partie « Vignette » avant la partie Vidéo ; envoyer la vignette → « Vignette mise à jour. » sans toucher à « Enregistrer » ; le tableau montre une petite vignette devant le titre ; la retirer → « Vignette retirée. » → AC-6
- [x] Série avec une couverture collée hors Cloudinary → mention « Lien externe » ; une bannière vers un lien mort → « Image indisponible » avec « Changer » et « Retirer » ; retirer le lien → « Le lien sera retiré de la série. » → AC-7
- [x] Simuler `429`, `413`, `415`, `400` (« Unexpected field »), `503` sur l'envoi → message de l'AC-8 sous l'emplacement, aperçu gardé ; `409` → « Cette image vient d'être changée par ailleurs. » et fiche relue → AC-8
- [x] Simuler un `404` sur la vignette → « Cet épisode n'existe plus. », fenêtre fermée sans question → AC-8
- [x] Aperçu en attente, clic sur « Vue d'ensemble » → « Quitter sans enregistrer ? » ; vignette en attente, Échap dans la fenêtre → « Abandonner les changements ? » → AC-9
- [x] Au clavier seul : choisir, envoyer, annuler et retirer chaque image ; les groupes s'annoncent « Couverture », « Bannière », « Vignette » ; l'erreur est lue avec le groupe → AC-10
- [x] Largeur de 390 px → les emplacements s'empilent, aucun défilement horizontal → AC-11
- [ ] Production, lecture seule : la fiche d'une série existante montre ses images dans la section et ses vignettes dans le tableau, sans rien enregistrer → AC-12

## Value sourcing
- [x] Une couverture déjà en place s'affiche depuis `series.coverImage`, une bannière depuis `series.bannerImage`, une vignette depuis `episode.thumbnail` (vérifier sur une série qui en a) → AC-1, AC-6
- [x] Un fichier `.webp` dont le type est vide est accepté par son extension ; un `.gif` est refusé par son type → AC-3
- [x] Les dimensions affichées dans « Image trop petite » sont celles du fichier choisi (essayer 300 × 450 puis 350 × 500) → AC-3
- [x] Après un envoi, l'image affichée est l'adresse renvoyée par le backend, pas l'adresse `blob:` de l'aperçu → AC-4
- [x] Une adresse `res.cloudinary.com` n'a pas la mention « Lien externe » ; une adresse `picsum.photos` l'a → AC-7

## Commandes
- [x] `npm run typecheck` → aucune erreur
- [x] `npx vitest run src/features/series/images` → tous les tests passent → AC-1 à AC-10

## Couverture des critères
- AC-1 : étapes 1 et value sourcing 1 · AC-2 : 4, 5 · AC-3 : 2, 3, value sourcing 2 et 3 · AC-4 : 6, value sourcing 4 · AC-5 : 7 · AC-6 : 8 · AC-7 : 9, value sourcing 5 · AC-8 : 10, 11 · AC-9 : 12 · AC-10 : 13 · AC-11 : 14 · AC-12 : 15
