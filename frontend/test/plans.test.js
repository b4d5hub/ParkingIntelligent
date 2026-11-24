// frontend/test/plans.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import { STATIC_PLANS, fetchSubscriptionPlans } from '../js/data/plans.js';

test('plans: static catalog has 4 plans with correct prices', () => {
  assert.equal(STATIC_PLANS.length, 4);

  const daily = STATIC_PLANS.find(p => p.period === 'DAILY');
  assert.equal(daily.price, 40.00);
  assert.equal(daily.currency, 'MAD');
  assert.equal(daily.title, 'Journalier');

  const weekly = STATIC_PLANS.find(p => p.period === 'WEEKLY');
  assert.equal(weekly.price, 180.00);
  assert.equal(weekly.currency, 'MAD');
  assert.equal(weekly.title, 'Hebdomadaire');

  const monthly = STATIC_PLANS.find(p => p.period === 'MONTHLY');
  assert.equal(monthly.price, 450.00);
  assert.equal(monthly.currency, 'MAD');
  assert.equal(monthly.title, 'Mensuel');
  assert.equal(monthly.featured, true);

  const annual = STATIC_PLANS.find(p => p.period === 'ANNUAL');
  assert.equal(annual.price, 4800.00);
  assert.equal(annual.currency, 'MAD');
  assert.equal(annual.title, 'Annuel');
});

test('plans: fetchSubscriptionPlans falls back to static catalog when fetch fails', async () => {
  // Global fetch mock to simulate 404 or failure
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return { ok: false, status: 404, json: async () => null };
  };

  try {
    const plans = await fetchSubscriptionPlans();
    assert.equal(plans.length, 4);
    assert.equal(plans[0].period, 'DAILY');
    assert.equal(plans[0].price, 40.00);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
