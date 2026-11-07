// The session cookie stays HttpOnly; only the CSRF token is kept in memory.
import { advanceSession, sessionRevision, assertCurrentSession } from './session.js';
let csrf;
export function resetSession() { advanceSession(); csrf = undefined; }
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export async function renewCsrf() {
  const revision = sessionRevision();
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  assertCurrentSession(revision);
  if (!response.ok) throw new ApiError(response.status, 'CSRF_UNAVAILABLE', 'Connexion au serveur impossible.');
  const token = await response.json();
  assertCurrentSession(revision); csrf = token;
}
export async function api(path, { method = 'GET', body, headers = {}, retryCsrf = true } = {}) {
  const revision = sessionRevision();
  const modifying = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (modifying && !csrf) await renewCsrf();
  assertCurrentSession(revision);
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (modifying) requestHeaders[csrf.headerName] = csrf.token;
  let payload;
  if (body instanceof URLSearchParams) { requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded'; payload = body; }
  else if (body !== undefined) { requestHeaders['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let response;
  try { response = await fetch(path, { method, headers: requestHeaders, body: payload, credentials: 'same-origin', cache: 'no-store' }); }
  catch { assertCurrentSession(revision); throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'Réseau indisponible. Vous pouvez réessayer la même demande.'); }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  assertCurrentSession(revision);
  if (response.status === 403 && data?.code === 'CSRF_INVALID' && retryCsrf) {
    await renewCsrf(); assertCurrentSession(revision); return api(path, { method, body, headers, retryCsrf: false });
  }
  if (!response.ok) throw new ApiError(response.status, data?.code, data?.message || 'La demande a échoué. Réessayez plus tard.');
  return data;
}
