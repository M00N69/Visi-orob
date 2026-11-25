# Eau potable : procès-verbaux d'analyse par commune

Application web 100 % statique (React + Vite + TypeScript). Elle n'a pas de serveur : le navigateur interroge directement
l'API officielle **Hub'Eau** (résultats du contrôle sanitaire, base SISE-Eaux) et l'API **geo.api.gouv.fr** (régions, départements, communes).

## Ce que fait l'app

- Choix région → département → commune (ou recherche directe par nom), et période (presets ou dates libres).
- **Procès-verbaux** : un prélèvement = une ligne, avec sa conclusion sanitaire et les types d'analyses réalisées.
- **Recherche par paramètre** : barre de recherche sur la liste des prélèvements (un ou plusieurs termes séparés par des virgules, ou une catégorie : PFAS, pesticides, métaux…).
- **Code-barres des analyses** : une colonne par PV, une ligne par famille (pesticides, PFAS, métaux, microbiologie…).
  Les PV à liste réduite sont repérés visuellement.
- **Couverture des analyses** : pour chaque famille, matrice paramètre × date (mesuré / non mesuré / dépassement).
- La conclusion sanitaire de chaque PV est affichée directement dans la liste et dans le détail.
- Exports : rapport PDF complet, synthèse PDF, PDF d'un seul PV, CSV.
- Contrôle de complétude affiché : « N lignes reçues sur N annoncées » + lien vers la réponse brute de l'API.
- L'adresse (`?c=69123&n=Lyon&from=…&to=…`) est partageable.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
```

Mode démonstration hors ligne (données fictives, bandeau visible) : `http://localhost:5173/?demo=1`.

## Mettre en ligne

`npm run build` produit le dossier `dist/` (fichiers statiques). Tout hébergeur de sites statiques convient.

**Cloudflare Pages / Vercel / Netlify** (le plus simple, gratuit) :
1. Mettre le projet sur GitHub.
2. Créer un projet depuis ce dépôt, commande de build `npm run build`, dossier de sortie `dist`.
3. Chaque `git push` redéploie le site. Domaine personnalisé possible dans les réglages.

**GitHub Pages** : `npm run build`, puis publier `dist/` (le `base: './'` de `vite.config.ts` gère le sous-dossier).

## Limites connues

- Hub'Eau limite une requête à 20 000 lignes : l'app découpe automatiquement la période en fenêtres plus petites.
- Les données sont publiées avec environ un mois de décalage ; la couverture des DOM-TOM peut être partielle.
- L'API ne fournit pas de « famille » de paramètres : elle est déduite du libellé (`src/lib/families.ts`).
  Un paramètre mal classé se corrige en ajustant une expression régulière.
- Compilation de données ouvertes : ne remplace pas les bulletins d'analyse officiels des ARS.
