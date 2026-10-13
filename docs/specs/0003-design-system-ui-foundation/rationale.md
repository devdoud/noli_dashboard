# 0003. Design system et fondation de l'interface : raisonnement

## Context

Toutes les fonctionnalités à venir (connexion, séries, épisodes, images, catégories, vue d'ensemble, outils) ont besoin d'un même cadre : une navigation, un en tête, des tableaux paginés, des confirmations de suppression, des états de chargement, vide et erreur. Sans cadre commun, chaque écran inventerait son aspect et son accessibilité, et le dashboard deviendrait incohérent et coûteux à corriger.

Les forces en jeu : la pile est fixée (Mantine 9, React Router 7, spec 0001) ; l'app mobile Noli a déjà une identité précise (fond très sombre, ambre safran, indigo, deux polices, un logo) que les admins connaissent ; l'outil sert 1 à 3 admins, surtout sur ordinateur, parfois sur téléphone ; `AGENTS.md` impose WCAG AA ; la CSP de la spec 0001 interdit les ressources d'autres domaines. L'ambre de la marque, très clair, ne peut pas servir de texte sur fond blanc sans échouer aux contrastes.

## Options considered

### Option 1 : thème Mantine sur l'identité de l'app, clair et sombre, composants maison minces

Un thème Mantine porte les couleurs et polices de l'app, avec un mode clair dérivé ; une douzaine de composants minces au dessus de Mantine couvrent les besoins communs.

**Pros**:
- Cohérence avec l'app mobile que les admins connaissent.
- Aucune dépendance lourde de plus ; les composants restent petits et testables.
- Deux modes : sombre fidèle à la marque, clair reposant pour la saisie.

**Cons**:
- Les couleurs du mode clair sont à dériver et à vérifier.
- Deux palettes à maintenir.

### Option 2 : thème Mantine par défaut, sans identité Noli

Mantine tel quel, en clair seulement, avec seulement la couleur principale changée.

**Pros**:
- Le plus rapide, aucun réglage.
- Contrastes de Mantine déjà vérifiés.

**Cons**:
- Le dashboard ne ressemble pas à Noli.
- Rien n'empêche chaque écran de s'écarter du style.

### Option 3 : bibliothèque de tableaux tierce et Storybook

Même identité, mais `mantine-datatable` pour les tableaux et Storybook pour la vitrine.

**Pros**:
- Tableaux riches (tri, sélection) sans les écrire.
- Vitrine standard, très outillée.

**Cons**:
- Deux dépendances de plus à suivre à chaque montée de version de Mantine.
- Storybook est lourd pour une douzaine de composants.

## Rationale

Les admins passent de l'app mobile au dashboard : reprendre l'identité de l'app (option 1) rend l'outil familier, ce que l'option 2 abandonne. Le mode clair répond à un usage d'administration (longues saisies, tableaux) que le seul mode sombre de l'app ne vise pas ; le coût est une palette dérivée, encadrée par une règle de contraste mesurée et notée dans `design.md`, ce qui transforme le risque en vérification.

Pour les composants, les besoins des écrans du scope sont simples (pagination serveur, pas de tri ni de sélection multiple pour l'instant) : la `Table` de Mantine enveloppée dans un `DataTable` maison suffit, sans dépendance de plus (option 3). Une page vitrine en développement donne la même valeur qu'un Storybook pour vérifier les composants, sans outil lourd. Les polices sont servies par le dashboard pour respecter la CSP et éviter toute requête vers Google.

La relecture croisée (un autre modèle) a fait préciser : le script de mode de couleurs en fichier sur la même origine (le script en ligne de Mantine serait bloqué par la CSP), les palettes chiffrées par une règle de mélange, des bordures de champ et un bouton danger qui atteignent les contrastes AA, l'échelle `dark` de Mantine remplacée, l'ordre des états de `DataTable`, l'exclusion réelle de la vitrine du build, et plusieurs détails d'accessibilité (focus sur `main`, menu mobile, titre de l'onglet).
