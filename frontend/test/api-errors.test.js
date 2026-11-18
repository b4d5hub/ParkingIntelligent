// frontend/test/api-errors.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeErrorMessage } from '../js/api.js';

test('api-errors: normalizeErrorMessage status mapping', () => {
  // 429 Lockout
  const msg429 = normalizeErrorMessage(429, 'TOO_MANY_REQUESTS', 'Rate limit exceeded');
  assert.equal(msg429, 'Trop de tentatives effectuées. Veuillez patienter un instant avant de réessayer.');

  // 401 Unauthorized
  const msg401 = normalizeErrorMessage(401, 'AUTHENTICATION_REQUIRED', null);
  assert.equal(msg401, 'Authentification requise. Veuillez vous connecter.');

  // 401 Invalid credentials
  const msgInvalidCreds = normalizeErrorMessage(401, 'INVALID_CREDENTIALS', null);
  assert.equal(msgInvalidCreds, 'Identifiants invalides. Vérifiez votre adresse e-mail et votre mot de passe.');

  // 403 Forbidden
  const msg403 = normalizeErrorMessage(403, 'ACCESS_DENIED', null);
  assert.equal(msg403, 'Accès non autorisé pour cette opération.');

  // 404 Not Found
  const msg404 = normalizeErrorMessage(404, 'NOT_FOUND', null);
  assert.equal(msg404, 'Ressource introuvable.');

  // 409 Conflict
  const msg409 = normalizeErrorMessage(409, 'CONFLICT', null);
  assert.equal(msg409, 'Conflit détecté (la ressource existe déjà ou est indisponible).');

  // 503 Service Unavailable
  const msg503 = normalizeErrorMessage(503, 'SERVICE_UNAVAILABLE', null);
  assert.equal(msg503, 'Service temporairement indisponible. Veuillez réessayer dans quelques instants.');

  // 400 Bad Request
  const msg400 = normalizeErrorMessage(400, 'BAD_REQUEST', null);
  assert.equal(msg400, 'Requête invalide. Veuillez vérifier les informations saisies.');

  // 0 / Network Unavailable
  const msg0 = normalizeErrorMessage(0, 'NETWORK_UNAVAILABLE', null);
  assert.equal(msg0, 'Réseau indisponible. Vous pouvez réessayer la même demande.');
});
