/**
 * ============================================================================
 * RELAIS OAUTH WITHINGS — Cloudflare Worker
 * ============================================================================
 * Rôle unique et volontairement restreint : faire l'échange "code -> access_token"
 * et "refresh_token -> nouveau access_token" auprès de Withings, en gardant le
 * Client Secret côté serveur (jamais exposé au navigateur).
 *
 * Ce Worker NE STOCKE RIEN : il reçoit une requête, relaie l'appel à Withings,
 * renvoie la réponse JSON brute (access_token, refresh_token, expires_in) à
 * l'app appelante. Aucune base de données, aucun log de données sensibles.
 *
 * Endpoints exposés :
 *   POST /exchange   { code, redirect_uri }              -> access_token initial
 *   POST /refresh     { refresh_token }                    -> nouveau access_token
 *
 * Sécurité :
 *   - CORS restreint à l'origine de la PWA (voir ALLOWED_ORIGIN dans wrangler.toml)
 *   - Le Client ID et Client Secret Withings sont des secrets Cloudflare
 *     (wrangler secret put), jamais commités dans le code ni visibles après coup.
 *   - Aucune variable d'état au niveau module (cf. bonnes pratiques Workers : les
 *     isolats sont réutilisés entre requêtes) — tout est local au handler `fetch`.
 * ============================================================================
 */

const WITHINGS_TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';

/** Construit les en-têtes CORS pour une origine donnée. */
function corsHeaders(origin, allowedOrigin) {
  const isAllowed = origin === allowedOrigin;
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

async function callWithings(params) {
  const resp = await fetch(WITHINGS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await resp.json();
  return { httpOk: resp.ok, data };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // Pré-vol CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405, headers);
    }

    const url = new URL(request.url);
    let payload;
    try {
      payload = await request.json();
    } catch (_err) {
      return jsonResponse({ error: 'invalid_json_body' }, 400, headers);
    }

    // --- Validation minimale des secrets requis côté Worker ---
    if (!env.WITHINGS_CLIENT_ID || !env.WITHINGS_CLIENT_SECRET) {
      return jsonResponse(
        { error: 'server_misconfigured', detail: 'WITHINGS_CLIENT_ID / WITHINGS_CLIENT_SECRET non définis côté Worker.' },
        500,
        headers
      );
    }

    if (url.pathname === '/exchange') {
      const { code, redirect_uri } = payload;
      if (!code || !redirect_uri) {
        return jsonResponse({ error: 'missing_parameters', detail: 'code et redirect_uri sont requis.' }, 400, headers);
      }

      const { httpOk, data } = await callWithings({
        action: 'requesttoken',
        grant_type: 'authorization_code',
        client_id: env.WITHINGS_CLIENT_ID,
        client_secret: env.WITHINGS_CLIENT_SECRET,
        code,
        redirect_uri,
      });

      if (!httpOk || data.status !== 0) {
        return jsonResponse({ error: 'withings_token_exchange_failed', withings_response: data }, 502, headers);
      }

      // On ne renvoie que ce qui est nécessaire côté client (pas de userid superflu).
      return jsonResponse(
        {
          access_token: data.body.access_token,
          refresh_token: data.body.refresh_token,
          expires_in: data.body.expires_in,
          scope: data.body.scope,
        },
        200,
        headers
      );
    }

    if (url.pathname === '/refresh') {
      const { refresh_token } = payload;
      if (!refresh_token) {
        return jsonResponse({ error: 'missing_parameters', detail: 'refresh_token est requis.' }, 400, headers);
      }

      const { httpOk, data } = await callWithings({
        action: 'requesttoken',
        grant_type: 'refresh_token',
        client_id: env.WITHINGS_CLIENT_ID,
        client_secret: env.WITHINGS_CLIENT_SECRET,
        refresh_token,
      });

      if (!httpOk || data.status !== 0) {
        return jsonResponse({ error: 'withings_token_refresh_failed', withings_response: data }, 502, headers);
      }

      return jsonResponse(
        {
          access_token: data.body.access_token,
          refresh_token: data.body.refresh_token,
          expires_in: data.body.expires_in,
          scope: data.body.scope,
        },
        200,
        headers
      );
    }

    return jsonResponse({ error: 'not_found' }, 404, headers);
  },
};
