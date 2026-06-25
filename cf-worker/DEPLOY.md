# Relais OAuth Withings — Cloudflare Worker

Petite fonction serverless dont le seul rôle est de faire l'échange
`code → access_token` (et le `refresh_token → nouveau access_token`) avec
Withings, en gardant le **Client Secret côté serveur**, jamais exposé au
navigateur. Aucune donnée n'est stockée : chaque requête est relayée puis
oubliée.

## 1. Prérequis

- Un compte Cloudflare gratuit : https://dash.cloudflare.com/sign-up
- Node.js installé sur votre machine (nécessaire uniquement pour déployer,
  pas pour faire fonctionner l'app au quotidien).

## 2. Installation et connexion

```bash
cd cf-worker
npm install
npx wrangler login
```
Une page web s'ouvre pour autoriser Wrangler à accéder à votre compte Cloudflare.

## 3. Configuration des secrets (Client ID / Client Secret Withings)

**Ne jamais écrire ces valeurs dans `wrangler.toml` ni dans le code.** Utilisez
la commande `wrangler secret put`, qui chiffre la valeur côté Cloudflare :

```bash
npx wrangler secret put WITHINGS_CLIENT_ID
# Collez votre Client ID Withings quand demandé, puis Entrée

npx wrangler secret put WITHINGS_CLIENT_SECRET
# Collez votre Client Secret Withings quand demandé, puis Entrée
```

## 4. Adapter l'origine autorisée (CORS)

Dans `wrangler.toml`, vérifiez que `ALLOWED_ORIGIN` correspond exactement à
l'URL de votre PWA GitHub Pages :

```toml
[vars]
ALLOWED_ORIGIN = "https://mathieubouysse-code.github.io"
```

## 5. Déploiement

```bash
npx wrangler deploy
```

Wrangler affiche l'URL publique du Worker, du type :
```
https://withings-oauth-relay.<votre-sous-domaine>.workers.dev
```

Notez cette URL : elle doit être renseignée dans `index.html` de la PWA
(constante `OAUTH_RELAY_URL`, déjà présente — remplacez juste sa valeur).

## 6. Test rapide

```bash
curl -X OPTIONS https://withings-oauth-relay.<votre-sous-domaine>.workers.dev/exchange \
  -H "Origin: https://mathieubouysse-code.github.io" -i
```
Doit répondre `204 No Content` avec un en-tête `Access-Control-Allow-Origin`
correspondant à votre origine.

## 7. Endpoints exposés

| Méthode | Chemin       | Corps JSON                              | Réponse                                          |
|---------|--------------|------------------------------------------|---------------------------------------------------|
| POST    | `/exchange`  | `{ "code": "...", "redirect_uri": "..." }` | `{ access_token, refresh_token, expires_in, scope }` |
| POST    | `/refresh`   | `{ "refresh_token": "..." }`              | `{ access_token, refresh_token, expires_in, scope }` |

## 8. Mise à jour après déploiement

Pour modifier le code plus tard :
```bash
npx wrangler deploy
```
Pour changer un secret :
```bash
npx wrangler secret put WITHINGS_CLIENT_SECRET
```
(écrase l'ancienne valeur, aucune confirmation visuelle de l'ancienne valeur
n'est jamais affichée — c'est le comportement attendu).
