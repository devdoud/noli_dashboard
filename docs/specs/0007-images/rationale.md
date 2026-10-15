# 0007. Images de série et vignettes d'épisode : raisonnement

## Context

Le backend sait déjà recevoir les images du catalogue (spec backend 0005, en production) : couverture et bannière d'une série, vignette d'un épisode. Il vérifie chaque fichier (format lu dans les octets, poids, dimensions, animation), le range sur Cloudinary, le recadre à la forme de son emplacement, et efface l'ancien fichier. Mais le dashboard n'offre aucun moyen d'utiliser ces routes : les admins voient les couvertures dans la liste et la fiche, sans pouvoir les changer.

Plusieurs forces pèsent sur la conception. Les envois d'images partagent avec les vidéos une limite de 10 appels par 10 minutes et par admin, et un envoi refusé compte quand même : chaque fichier mal choisi coûte. Le backend recadre avec un cadrage automatique sur le sujet, que le navigateur ne peut pas reproduire exactement. La fiche porte déjà un formulaire avec son bouton « Enregistrer », une protection des changements non enregistrés (spec 0005) et la section des épisodes avec sa fenêtre (spec 0006) ; les images doivent s'y insérer sans brouiller ce qui est enregistré par quoi.

Enfin, l'outil est interne (1 à 3 admins), sur ordinateur surtout mais lisible sur téléphone, et soumis à WCAG AA. Sans cette fonctionnalité, les nouvelles séries restent sans visuel, ou les admins collent des liens hébergés ailleurs, non protégés et parfois cassés.

## Options considered

### Option 1 : emplacement autonome avec aperçu fidèle et contrôles dans le navigateur

Un composant d'emplacement par image, posé dans une section « Images » de la fiche et dans la fenêtre d'épisode. Il vérifie le fichier dans le navigateur, montre l'aperçu à la forme de l'emplacement, et n'envoie que sur « Envoyer », par sa propre route.

**Pros**:
- Indépendant du formulaire : aucune écriture à moitié réussie entre la série et son image.
- Les refus courants ne coûtent aucun appel de la limite.
- Un seul composant pour les trois emplacements, réutilisable pour les catégories.
- Aucune dépendance ni changement backend.

**Cons**:
- Deux façons d'enregistrer sur la même page (le formulaire et les images), à rendre lisibles.
- L'aperçu centré peut différer du cadrage automatique de Cloudinary.

### Option 2 : champs fichier dans le formulaire de la série

Les images deviennent deux champs du formulaire, envoyés avec « Enregistrer » après le `PATCH` de la série.

**Pros**:
- Un seul bouton pour tout enregistrer.

**Cons**:
- Deux appels ou plus derrière un bouton : un `PATCH` réussi suivi d'une image refusée laisse un état à moitié enregistré, difficile à expliquer.
- Le formulaire et sa protection (spec 0005) se compliquent pour un gain faible.

### Option 3 : outil de recadrage dans le navigateur

L'admin déplace et zoome dans un cadre à la bonne forme ; le navigateur recadre l'image (canvas) avant l'envoi.

**Pros**:
- L'image stockée correspond exactement au cadre choisi.

**Cons**:
- Une bibliothèque en plus et plus d'interface à rendre accessible.
- L'image recadrée doit encore respecter les minimums du backend, et la réencoder peut l'alourdir ou la dégrader.
- Le backend recadre déjà : deux recadrages successifs pour un besoin que personne n'a encore signalé.

### Option 4 : envoi dès le choix du fichier

Le fichier part dès qu'il passe les contrôles, sans aperçu à confirmer.

**Pros**:
- Un clic de moins.

**Cons**:
- Un mauvais choix (mauvaise image, mauvais cadrage) coûte un appel de la limite et remplace aussitôt l'image en ligne, ancienne image effacée.

## Rationale

L'option 1 répond aux deux forces les plus coûteuses. La limite partagée rend chaque appel précieux : les contrôles dans le navigateur (format, poids, dimensions, proportion, mégapixels) attrapent presque tous les refus avant l'envoi, et l'aperçu à confirmer évite de remplacer une image en ligne par erreur, puisque le backend efface l'ancienne aussitôt. L'autonomie de chaque emplacement évite les états à moitié enregistrés de l'option 2 : une image est une ressource à part, avec ses propres routes, son propre succès et son propre échec.

Le recadrage manuel (option 3) est écarté parce que le backend recadre déjà, avec un cadrage automatique généralement bon. On montre un aperçu centré, honnête sur sa limite par une mention, et on garde le recadrage comme suivi si l'écart gêne vraiment. L'animation n'est pas détectée dans le navigateur : le cas est rare, le backend le refuse proprement, et le détecter demanderait de lire les octets du fichier pour un gain faible.

Sans compteur exposé par le backend, un compteur local serait faux dès qu'un autre onglet ou un rechargement intervient : un message clair au `429`, plus le rappel permanent de la limite, est honnête et ne demande aucun changement backend. La protection de la page s'étend naturellement aux aperçus en attente, parce qu'un fichier choisi est un travail en cours au même titre qu'un champ modifié.
