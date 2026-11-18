// frontend/test/formatters.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDate, formatMoney, toLocalIsoString } from '../js/ui/formatters.js';

test('formatters: formatMoney', () => {
  assert.equal(formatMoney(null), '—');
  assert.equal(formatMoney(undefined), '—');
  assert.equal(formatMoney('abc'), '—');

  const formattedMad = formatMoney(45.5, 'MAD');
  // Intl format may use non-breaking space or regular space
  assert.match(formattedMad, /45,50/);
  assert.match(formattedMad, /MAD/);

  const formattedZero = formatMoney(0, 'MAD');
  assert.match(formattedZero, /0,00/);

  const withoutCurrency = formatMoney(10, '');
  assert.equal(withoutCurrency, '10.00 (devise à vérifier)');
});

test('formatters: formatDate', () => {
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate('invalid-date'), '—');

  const dateIso = '2026-11-16T14:30:00.000Z';
  const formatted = formatDate(dateIso);
  assert.notEqual(formatted, '—');
  assert.match(formatted, /2026/);
});

test('formatters: toLocalIsoString', () => {
  const d = new Date(2026, 10, 16, 15, 30); // 16 nov 2026 15:30 local
  const isoStr = toLocalIsoString(d);
  assert.equal(isoStr, '2026-11-16T15:30');

  assert.equal(toLocalIsoString('invalid'), '');
});
