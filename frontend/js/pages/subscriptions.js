// frontend/js/pages/subscriptions.js
// Page de gestion et de souscription des abonnements pour les conducteurs.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatDate, formatMoney } from '../ui/formatters.js';
import { getSubscriptionStatusInfo, getSubscriptionPeriodLabel } from '../ui/labels.js';
import { fetchSubscriptionPlans } from '../data/plans.js';
import { confirmModal } from '../ui/modal.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';

export function renderSubscriptionsPage() {
  const container = createDomNode('section', '', '', {
    'aria-label': 'Abonnements'
  });

  // Section 1 : Catalogue des formules
  const catalogSection = createDomNode('section', '', '', { 'aria-label': 'Formules d’abonnement' });
  const catalogHeader = createDomNode('div', '', 'section-heading');
  const catalogIntro = createDomNode('div');
  catalogIntro.appendChild(createDomNode('h1', 'Formules d’abonnement'));
  catalogIntro.appendChild(createDomNode('p', 'Choisissez votre formule pour stationner en toute tranquillité.', 'muted'));
  catalogHeader.appendChild(catalogIntro);
  catalogSection.appendChild(catalogHeader);

  const plansGrid = createDomNode('div', '', 'plans-grid', { role: 'region', 'aria-label': 'Formules disponibles' });
  plansGrid.appendChild(createLoadingIndicator('Chargement des formules…'));
  catalogSection.appendChild(plansGrid);

  // Section 2 : Mes abonnements
  const mySubsSection = createDomNode('section', '', 'history card-section', { 'aria-label': 'Mes abonnements' });
  const mySubsHeader = createDomNode('div', '', 'section-heading');
  const mySubsIntro = createDomNode('div');
  mySubsIntro.appendChild(createDomNode('h2', 'Mes abonnements'));
  mySubsIntro.appendChild(createDomNode('p', 'Retrouvez vos abonnements actifs et passés.', 'muted'));
  const refreshBtn = createDomNode('button', 'Actualiser', 'quiet', { type: 'button' });
  mySubsHeader.appendChild(mySubsIntro);
  mySubsHeader.appendChild(refreshBtn);
  mySubsSection.appendChild(mySubsHeader);

  const subsListContainer = createDomNode('div', '', 'reservation-list', {
    role: 'region',
    'aria-label': 'Liste de mes abonnements'
  });
  mySubsSection.appendChild(subsListContainer);

  container.appendChild(catalogSection);
  container.appendChild(mySubsSection);

  // Charger les formules d'abonnement
  async function loadPlans() {
    const revision = sessionRevision();
    try {
      const plans = await fetchSubscriptionPlans();
      assertCurrentSession(revision);

      plansGrid.replaceChildren();

      for (const plan of plans) {
        const card = createDomNode('article', '', `plan-card ${plan.featured ? 'featured' : ''}`);
        const title = createDomNode('h3', plan.title);
        const price = createDomNode('p', formatMoney(plan.price, plan.currency), 'plan-price');
        const desc = createDomNode('p', plan.description, 'muted');
        const subscribeBtn = createDomNode('button', 'Souscrire', plan.featured ? '' : 'secondary', {
          type: 'button',
          'data-plan': plan.period
        });

        subscribeBtn.addEventListener('click', async () => {
          const confirmed = await confirmModal({
            title: `Souscrire à la formule ${plan.title}`,
            message: `Confirmez-vous la souscription à l’abonnement ${plan.title} au montant de ${formatMoney(plan.price, plan.currency)} ?`,
            confirmText: 'Confirmer la souscription',
            cancelText: 'Annuler'
          });
          if (!confirmed) return;

          executeButtonAction(subscribeBtn, async checkSession => {
            await api('/api/subscriptions', {
              method: 'POST',
              body: { period: plan.period }
            });
            checkSession();
            showToast(`Abonnement ${plan.title} souscrit avec succès.`, 'success');
            await loadUserSubscriptions();
          });
        });

        card.appendChild(title);
        card.appendChild(price);
        card.appendChild(desc);
        card.appendChild(subscribeBtn);
        plansGrid.appendChild(card);
      }
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      plansGrid.replaceChildren(createEmptyState('Impossible de charger les formules d’abonnement.'));
      showErrorToast(error.message);
    }
  }

  // Charger la liste des abonnements du conducteur
  async function loadUserSubscriptions() {
    const revision = sessionRevision();
    subsListContainer.replaceChildren(createLoadingIndicator('Chargement de vos abonnements…'));

    try {
      const list = await api('/api/subscriptions/me');
      assertCurrentSession(revision);

      subsListContainer.replaceChildren();

      if (!Array.isArray(list) || list.length === 0) {
        subsListContainer.appendChild(createEmptyState('Vous n’avez aucun abonnement pour le moment.'));
        return;
      }

      for (const sub of list) {
        const card = createDomNode('article', '', 'reservation');
        const row = createDomNode('div', '', 'row');

        const periodLabel = getSubscriptionPeriodLabel(sub.period);
        row.appendChild(createDomNode('h3', `Abonnement ${periodLabel}`));

        const statusInfo = getSubscriptionStatusInfo(sub.status);
        row.appendChild(createDomNode('span', statusInfo.label, statusInfo.badgeClass));
        card.appendChild(row);

        card.appendChild(createDomNode('p', `Montant : ${formatMoney(sub.price, sub.currency)}`));
        card.appendChild(createDomNode('p', `Du ${formatDate(sub.startsAt)} au ${formatDate(sub.endsAt)}`, 'muted'));

        if (sub.status === 'PENDING_PAYMENT') {
          const infoP = createDomNode(
            'p',
            'En attente de paiement : le module de paiement en ligne pour les abonnements sera bientôt disponible. Votre abonnement s’activera dès validation.',
            'muted sync'
          );
          card.appendChild(infoP);
        }

        subsListContainer.appendChild(card);
      }
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      subsListContainer.replaceChildren(createEmptyState('Impossible de charger vos abonnements.'));
      showErrorToast(error.message);
    }
  }

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, () => loadUserSubscriptions());
  });

  loadPlans();
  loadUserSubscriptions();

  return container;
}
