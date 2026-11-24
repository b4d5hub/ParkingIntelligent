// frontend/test/admin-utils.test.js
// Tests unitaires des formateurs, constructeur de requêtes et validateurs.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDuration,
  ratioToPctClass,
  buildQueryString,
  validateEmail,
  validatePassword,
  validateRoles,
  validateDateRange
} from '../js/ui/formatters.js';

test('formatters: formatDuration', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(undefined), '—');
  assert.equal(formatDuration('invalide'), '—');
  assert.equal(formatDuration(0.5), '< 1 min');
  assert.equal(formatDuration(0), '< 1 min');
  assert.equal(formatDuration(15), '15 min');
  assert.equal(formatDuration(59.4), '59 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(75), '1 h 15 min');
  assert.equal(formatDuration(120), '2 h');
  assert.equal(formatDuration(130), '2 h 10 min');
});

test('formatters: ratioToPctClass', () => {
  assert.equal(ratioToPctClass(null), 'pct-0');
  assert.equal(ratioToPctClass(0), 'pct-0');
  assert.equal(ratioToPctClass(0.04), 'pct-5');
  assert.equal(ratioToPctClass(0.50), 'pct-50');
  assert.equal(ratioToPctClass(0.73), 'pct-75');
  assert.equal(ratioToPctClass(1.0), 'pct-100');
  // Support direct des entiers en pourcentages (0-100)
  assert.equal(ratioToPctClass(42), 'pct-40');
  assert.equal(ratioToPctClass(88), 'pct-90');
  assert.equal(ratioToPctClass(120), 'pct-100');
  assert.equal(ratioToPctClass(-10), 'pct-0');
});

test('formatters: buildQueryString', () => {
  assert.equal(buildQueryString({}), '');
  assert.equal(buildQueryString({ page: 0, size: 20 }), '?page=0&size=20');
  // Ignore les valeurs null, undefined et chaînes vides
  assert.equal(buildQueryString({ page: 1, status: '', q: null, extra: undefined }), '?page=1');
  assert.equal(
    buildQueryString({ status: 'ACTIVE', from: '2026-11-01T00:00:00Z' }),
    '?status=ACTIVE&from=2026-11-01T00%3A00%3A00Z'
  );
});

test('validators: validateEmail', () => {
  assert.equal(validateEmail('admin@parking.local'), true);
  assert.equal(validateEmail('test.user+tag@domain.co.uk'), true);
  assert.equal(validateEmail(''), false);
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validateEmail('missing@domain'), false);
  assert.equal(validateEmail('spaces in@email.com'), false);
  assert.equal(validateEmail(null), false);
});

test('validators: validatePassword', () => {
  assert.equal(validatePassword('Parking2026!Passphrase'), true);
  assert.equal(validatePassword('123456789012'), true); // exact 12
  assert.equal(validatePassword('short12345'), false);  // 10 chars
  assert.equal(validatePassword(''), false);
  assert.equal(validatePassword(null), false);
});

test('validators: validateRoles', () => {
  assert.equal(validateRoles(['CONDUCTEUR']), true);
  assert.equal(validateRoles(['CONDUCTEUR', 'ADMIN']), true);
  assert.equal(validateRoles(['AGENT', 'CONDUCTEUR', 'ADMIN']), true);
  assert.equal(validateRoles([]), false); // non-vide requis
  assert.equal(validateRoles(['SUPER_USER']), false); // invalide
  assert.equal(validateRoles(null), false);
});

test('validators: validateDateRange', () => {
  assert.equal(validateDateRange(null, null).valid, true);
  assert.equal(validateDateRange('2026-11-01', '2026-11-10').valid, true);
  assert.equal(validateDateRange('2026-11-10', '2026-11-10').valid, true); // même jour OK

  // from > to
  const invOrder = validateDateRange('2026-11-20', '2026-11-10');
  assert.equal(invOrder.valid, false);
  assert.ok(invOrder.message.includes('antérieure'));

  // intervalle > 366 jours
  const tooLong = validateDateRange('2025-01-01', '2026-02-01'); // > 366 j
  assert.equal(tooLong.valid, false);
  assert.ok(tooLong.message.includes('366 jours'));
});
