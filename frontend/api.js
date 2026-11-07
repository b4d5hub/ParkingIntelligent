// The session cookie stays HttpOnly; only the CSRF token is kept in memory.
let csrf;
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export async function renewCsrf() {
  const response = await fetch('/api/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new ApiError(response.status, 'CSRF_UNAVAILABLE', 'Connexion au serveur impossible.');
  csrf = await response.json();
}
export async function api(path, { method = 'GET', body, headers = {}, retryCsrf = true } = {}) {
  const modifying = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (modifying && !csrf) await renewCsrf();
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (modifying) requestHeaders[csrf.headerName] = csrf.token;
  let payload;
  if (body instanceof URLSearchParams) { requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded'; payload = body; }
  else if (body !== undefined) { requestHeaders['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let response;
  try { response = await fetch(path, { method, headers: requestHeaders, body: payload, credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new ApiError(0, 'NETWORK_UNAVAILABLE', 'Réseau indisponible. Vous pouvez réessayer la même demande.'); }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 403 && data?.code === 'CSRF_INVALID' && retryCsrf) {
    await renewCsrf(); return api(path, { method, body, headers, retryCsrf: false });
  }
  if (!response.ok) throw new ApiError(response.status, data?.code, data?.message || 'La demande a échoué. Réessayez plus tard.');
  return data;
}
