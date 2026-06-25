# Withings → Garmin FIT (PWA)

Application web installable (PWA) pour convertir l'historique de pesée
Withings (CSV ou API OAuth2) vers le format binaire Garmin `.FIT`,
avec toutes les métriques de composition corporelle (poids, IMC, masse
grasse, masse musculaire, masse osseuse, taux d'eau).

## 1. Déploiement sur GitHub Pages

Dans le repo `withings_to_garmin` (https://github.com/mathieubouysse-code/withings_to_garmin) :

```bash
git clone https://github.com/mathieubouysse-code/withings_to_garmin.git
cd withings_to_garmin
# copier les fichiers de ce dossier (index.html, manifest.json, sw.js, icon-*.png) à la racine
git add .
git commit -m "Withings to Garmin FIT - PWA"
git push origin main
```

Puis dans **Settings → Pages** du repo GitHub :
- Source : `Deploy from a branch`
- Branch : `main` / dossier `/ (root)`
- Sauvegarder.

L'app sera accessible sous quelques minutes à :
```
https://mathieubouysse-code.github.io/withings_to_garmin/
```

## 2. Configuration de l'application Withings

Sur [developer.withings.com](https://developer.withings.com), dans la
**Callback URL** de votre application, renseignez EXACTEMENT :
```
https://mathieubouysse-code.github.io/withings_to_garmin/
```
(doit correspondre au caractère près à l'URL de redirection saisie dans l'app —
le champ est déjà pré-rempli avec cette valeur dans `index.html`).

## 3. Déployer le relais OAuth (recommandé, ~5 minutes, gratuit)

L'échange `code → access_token` ne peut pas se faire directement depuis le
navigateur (le Client Secret Withings ne doit jamais y transiter). Un petit
relais Cloudflare Worker s'en charge automatiquement — voir le dossier
`cf-worker/` fourni séparément, et son `DEPLOY.md` pour les instructions
détaillées (`wrangler login`, `wrangler secret put`, `wrangler deploy`).

Une fois déployé, reportez l'URL du Worker dans la constante
`OAUTH_RELAY_URL` en haut du script de `index.html`, puis redéployez la PWA.

**Si vous ne déployez pas le relais**, l'app reste pleinement fonctionnelle :
elle bascule automatiquement sur un flux manuel (commande `curl` générée et
copiée dans le presse-papiers) — aucune fonctionnalité n'est perdue, juste
une étape manuelle en plus à chaque connexion.

## 4. Installation sur Samsung (Chrome Android)

1. Ouvrez `https://mathieubouysse-code.github.io/withings_to_garmin/` dans Chrome.
2. Un bandeau "Installer l'application" apparaît en bas de l'écran (ou via le
   menu ⋮ → "Ajouter à l'écran d'accueil" / "Installer l'application").
3. Une icône apparaît sur l'écran d'accueil, l'app s'ouvre en plein écran
   sans barre d'adresse, comme une app native.

## 5. Fichiers du projet

| Fichier                  | Rôle                                                          |
|--------------------------|----------------------------------------------------------------|
| `index.html`             | Application complète (HTML + CSS + JS, encodeur FIT inclus)   |
| `manifest.json`          | Déclaration PWA (nom, icônes, couleurs, mode standalone)      |
| `sw.js`                  | Service Worker (cache des assets statiques, jamais l'API Withings) |
| `icon-192.png`           | Icône PWA 192×192                                             |
| `icon-512.png`           | Icône PWA 512×512                                             |
| `icon-512-maskable.png`  | Icône PWA 512×512 avec zone de sécurité (masques Android)     |

## 6. Limites connues (transparence)

- **L'import vers Garmin Connect reste manuel** : Garmin n'expose aucune API
  publique d'écriture de données de santé pour des applications tierces non
  partenaires. Le fichier `.fit` généré doit être importé à la main dans
  Garmin Connect (web ou mobile : Importer un fichier d'activité/santé).
- **L'échange OAuth `code → access_token` reste une étape manuelle** (commande
  `curl` générée automatiquement par l'app) : le Client Secret Withings ne doit
  jamais transiter côté navigateur, et Withings ne renvoie pas les en-têtes
  CORS nécessaires à un appel direct depuis cette page pour cette étape précise.
- **Le Service Worker ne mémorise jamais vos données Withings** : seuls les
  fichiers statiques de l'app (HTML/CSS/JS/icônes) sont mis en cache pour le
  fonctionnement hors-ligne de l'interface ; les appels vers `wbsapi.withings.net`
  passent toujours en direct, sans interception ni mise en cache.
