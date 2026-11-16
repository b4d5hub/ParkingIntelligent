// frontend/js/api.js
// Client API avec gestion du cookie de session HttpOnly, CSRF automatique et normalisation des erreurs.

import { advanceSession, sessionRevision, assertCurrentSession, clearSession } from './session.js';

let csrfTokenData = null;
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export function resetSession() {
  advanceSession();
  csrfTokenData = null;
}

export function getCsrfToken() {
  return csrfTokenData;
}

export async function renewCsrf() {
  const revision = sessionRevision();
  let response;
  try {
    response = await fetch('/api/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
  } catch {
    assertCurrentSession(revision);
    throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'Réseau indisponible. Impossible de joindre le serveur.');
  }

  assertCurrentSession(revision);
  if (!response.ok) {
    throw new ApiError(response.status, 'CSRF_UNAVAILABLE', 'Impossible d’obtenir le jeton de sécurité. Réessayez plus tard.');
  }

  const token = await response.json().catch(() => null);
  assertCurrentSession(revision);
  if (!token?.headerName || !token?.token) {
    throw new ApiError(500, 'CSRF_MALFORMED', 'Jeton CSRF invalide reçu du serveur.');
  }
  csrfTokenData = token;
  return csrfTokenData;
}

export function normalizeErrorMessage(status, code, backendMessage) {
  if (code === 'INVALID_CREDENTIALS') {
    return 'Identifiants invalides. Vérifiez votre adresse e-mail et votre mot de passe.';
  }
  if (status === 429) {
    return 'Trop de tentatives effectuées. Veuillez patienter un instant avant de réessayer.';
  }
  if (status === 401) {
    return backendMessage || 'Authentification requise. Veuillez vous connecter.';
  }
  if (status === 403) {
    return backendMessage || 'Accès non autorisé pour cette opération.';
  }
  if (status === 404) {
    return backendMessage || 'Ressource introuvable.';
  }
  if (status === 409) {
    return backendMessage || 'Conflit détecté (la ressource existe déjà ou est indisponible).';
  }
  if (status === 503) {
    return backendMessage || 'Service temporairement indisponible. Veuillez réessayer dans quelques instants.';
  }
  if (status === 400) {
    return backendMessage || 'Requête invalide. Veuillez vérifier les informations saisies.';
  }
  if (status === 0 || code === 'NETWORK_UNAVAILABLE') {
    return 'Réseau indisponible. Vous pouvez réessayer la même demande.';
  }
  return backendMessage || 'La demande a échoué. Réessayez plus tard.';
}

export async function api(path, { method = 'GET', body, headers = {}, retryCsrf = true } = {}) {
  const revision = sessionRevision();
  const modifying = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

  if (modifying && !csrfTokenData) {
    await renewCsrf();
  }
  assertCurrentSession(revision);

  const requestHeaders = { Accept: 'application/json', ...headers };
  if (modifying && csrfTokenData) {
    requestHeaders[csrfTokenData.headerName] = csrfTokenData.token;
  }

  let payload;
  if (body instanceof URLSearchParams) {
    requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = body;
  } else if (body !== undefined && body !== null) {
    requestHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers: requestHeaders,
      body: payload,
      credentials: 'same-origin',
      cache: 'no-store'
    });
  } catch {
    assertCurrentSession(revision);
    throw new ApiError(0, 'NETWORK_UNAVAILABLE', normalizeErrorMessage(0, 'NETWORK_UNAVAILABLE'));
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  assertCurrentSession(revision);

  if (response.status === 403 && data?.code === 'CSRF_INVALID' && retryCsrf) {
    await renewCsrf();
    assertCurrentSession(revision);
    return api(path, { method, body, headers, retryCsrf: false });
  }

  if (!response.ok) {
    const errorMsg = normalizeErrorMessage(response.status, data?.code, data?.message);
    if (response.status === 401 && data?.code !== 'INVALID_CREDENTIALS') {
      clearSession();
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }
    throw new ApiError(response.status, data?.code, errorMsg);
  }

  return data;
}
