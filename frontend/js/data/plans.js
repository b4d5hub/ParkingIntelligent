// frontend/js/data/plans.js
// Catalogue des formules d'abonnement. Tente l'API puis bascule sur le catalogue statique.

import { api } from '../api.js';

export const STATIC_PLANS = [
  {
    period: 'DAILY',
    title: 'Journalier',
    price: 40.00,
    currency: 'MAD',
    description: 'Accès illimité pendant 24 heures.',
    featured: false
  },
  {
    period: 'WEEKLY',
    title: 'Hebdomadaire',
    price: 180.00,
    currency: 'MAD',
    description: 'Accès illimité pendant 7 jours.',
    featured: false
  },
  {
    period: 'MONTHLY',
    title: 'Mensuel',
    price: 450.00,
    currency: 'MAD',
    description: 'Accès illimité pendant 1 mois civil.',
    featured: true
  },
  {
    period: 'ANNUAL',
    title: 'Annuel',
    price: 4800.00,
    currency: 'MAD',
    description: 'Accès illimité pendant 1 an complet.',
    featured: false
  }
];

export async function fetchSubscriptionPlans() {
  try {
    const data = await api('/api/subscriptions/plans');
    if (Array.isArray(data) && data.length > 0) {
      return data.map(plan => ({
        period: plan.period,
        title: plan.title || (STATIC_PLANS.find(p => p.period === plan.period)?.title || plan.period),
        price: typeof plan.price === 'number' ? plan.price : parseFloat(plan.price) || 0,
        currency: plan.currency || 'MAD',
        description: plan.description || (STATIC_PLANS.find(p => p.period === plan.period)?.description || ''),
        featured: plan.period === 'MONTHLY'
      }));
    }
  } catch {
    // Si l'endpoint renvoie 404 ou échoue, fallback transparent sur le catalogue statique
  }
  return [...STATIC_PLANS];
}
