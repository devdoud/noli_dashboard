# 0009. Recherche et filtres de la liste des séries : raisonnement

## Context

La liste des séries du dashboard (spec 0004) est paginée, triée des plus récentes aux plus anciennes, sans aucun filtre. Avec une douzaine de séries, on les parcourt à l'œil ; dès quelques dizaines, retrouver une série précise ou voir les séries d'une catégorie devient pénible.

Le backend n'offre pas de quoi combiner des filtres. Sa liste n'accepte que la page et la taille ; sa recherche publique cherche dans le titre et la description en appliquant le texte saisi comme une expression régulière, ce qui la rend sensible aux accents (« comedie » ne trouve pas « Comédie ») et fragile (un « ( » peut la faire échouer) ; le filtre par catégorie n'existe qu'en public et ignore les catégories masquées ; aucun filtre d'accès n'existe. Les admins, eux, ont besoin de voir les catégories masquées et de combiner les critères.

Le dashboard garde déjà la page dans l'adresse et la retrouve au retour d'une fiche (spec 0005). Les filtres doivent suivre le même chemin, au clavier comme à la souris, en français, conformément à WCAG AA.

## Options considered

### Option 1 : route admin filtrée côté backend

Une route `GET /series/admin` accepte le texte, la catégorie et l'accès, filtre, compte et pagine ; le dashboard ne fait que traduire l'adresse en paramètres.

**Pros**:
- Juste quel que soit le volume (pagination et comptes faits par la base).
- Voit les catégories masquées et renvoie les catégories des lignes avec leur visibilité.
- Corrige la recherche (accents, texte échappé) sans toucher à celle de l'app.

**Cons**:
- Un prérequis backend à écrire, tester et mettre en ligne avant le dashboard.

### Option 2 : filtrer dans le navigateur

Le dashboard charge toutes les séries et filtre lui même.

**Pros**:
- Aucun changement backend ; filtres instantanés.

**Cons**:
- Tout le catalogue est téléchargé à chaque ouverture, et le coût grandit avec lui.
- La liste existante retire les catégories masquées des séries : filtrer sur une catégorie masquée est impossible.

### Option 3 : composer les routes existantes

Recherche par la route publique, catégorie par la liste publique d'une catégorie, un filtre à la fois.

**Pros**:
- Rien à changer au backend.

**Cons**:
- Pas de combinaison, pas d'accès, pas de catégorie masquée, recherche sensible aux accents et fragile.

## Rationale

L'option 1 est la seule qui tienne les trois exigences du scope (titre, catégorie et accès combinés) avec les catégories masquées, et elle reste juste quand le catalogue grandit. Le coût est une route backend courte, du même ordre que le prérequis des liens collés de la spec 0006, et elle corrige au passage les deux défauts de la recherche actuelle (accents, texte non échappé) sans risque pour l'app, qui garde ses routes.

Chercher dans le titre seulement rend les résultats prévisibles pour l'usage réel (retrouver une série connue). La recherche pendant la frappe, avec un anti rebond de 300 ms et un minimum de 2 caractères, donne un retour immédiat sans multiplier les appels. Garder les filtres dans l'adresse réutilise le mécanisme déjà en place pour la page et le retour depuis la fiche, et rend une liste filtrée partageable ; remplacer l'adresse pendant la frappe évite de remplir l'historique d'une entrée par lettre.

L'insensibilité aux accents se fait par des classes de caractères dans l'expression régulière plutôt que par un champ normalisé : pas de migration, pas de champ à tenir à jour, et un coût acceptable pour un catalogue de quelques centaines de séries ; l'index dédié reste un suivi si le volume l'exige.
