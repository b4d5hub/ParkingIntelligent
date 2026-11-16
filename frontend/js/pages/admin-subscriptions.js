// frontend/js/pages/admin-subscriptions.js
// Page de gestion des formules tarifaires d'abonnement et liste de tous les abonnements.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatDate, formatMoney, buildQueryString } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';
import { getSubscriptionPeriodLabel, getSubscriptionStatusInfo } from '../ui/labels.js';

export function renderAdminSubscriptionsPage() {
  const container = createDomNode('section', '', 'history', {
    'aria-label': 'Gestion des abonnements'
  });

  let currentSubPage = 0;
  let currentStatusFilter = '';

  // En-tête
  const header = createDomNode('div', '', 'section-heading');
  const introDiv = createDomNode('div');
  introDiv.appendChild(createDomNode('h1', 'Abonnements'));
  introDiv.appendChild(createDomNode('p', 'Configurez les formules tarifaires et consultez l’ensemble des souscriptions.', 'muted'));
  const refreshBtn = createDomNode('button', 'Actualiser', 'quiet', { type: 'button' });
  header.appendChild(introDiv);
  header.appendChild(refreshBtn);

  // Section 1 : Édition des formules tarifaires
  const plansCard = createDomNode('section', '', 'card admin-controls', { 'aria-label': 'Tarifs des formules' });
  plansCard.appendChild(createDomNode('h2', 'Formules tarifaires d’abonnement'));
  plansCard.appendChild(createDomNode('p', 'Modifiez les tarifs ou activez/désactivez l’accès aux souscriptions pour chaque formule.', 'muted'));

  const plansContainer = createDomNode('div', '', 'plans-grid');
  plansCard.appendChild(plansContainer);

  // Section 2 : Liste paginée des abonnements
  const listCard = createDomNode('section', '', 'card card-section', { 'aria-label': 'Liste des souscriptions' });
  const listHeading = createDomNode('div', '', 'section-heading');
  const listIntro = createDomNode('div');
  listIntro.appendChild(createDomNode('h2', 'Toutes les souscriptions'));
  listIntro.appendChild(createDomNode('p', 'Historique global des souscriptions conducteurs avec filtre par statut.', 'muted'));
  listHeading.appendChild(listIntro);

  // Filtre de statut
  const filterForm = createDomNode('form', '', 'filters');
  const statusLabel = createDomNode('label', 'Filtrer par statut');
  const statusSelect = createDomNode('select', '', '', { name: 'status' });
  const optAll = createDomNode('option', 'Tous les statuts', '', { value: '' });
  const optActive = createDomNode('option', 'Actifs', '', { value: 'ACTIVE' });
  const optPending = createDomNode('option', 'En attente de paiement', '', { value: 'PENDING_PAYMENT' });
  const optExpired = createDomNode('option', 'Expirés', '', { value: 'EXPIRED' });
  const optCancelled = createDomNode('option', 'Annulés', '', { value: 'CANCELLED' });

  statusSelect.appendChild(optAll);
  statusSelect.appendChild(optActive);
  statusSelect.appendChild(optPending);
  statusSelect.appendChild(optExpired);
  statusSelect.appendChild(optCancelled);
  statusLabel.appendChild(statusSelect);

  filterForm.appendChild(statusLabel);

  const subsStatusEl = createDomNode('p', 'Chargement des abonnements…', 'muted', { role: 'status' });
  const subsTableContainer = createDomNode('div', '', 'subs-table-container');
  const subsPagerContainer = createDomNode('div', '', 'row pager');

  listCard.appendChild(listHeading);
  listCard.appendChild(filterForm);
  listCard.appendChild(subsStatusEl);
  listCard.appendChild(subsTableContainer);
  listCard.appendChild(subsPagerContainer);

  container.appendChild(header);
  container.appendChild(plansCard);
  container.appendChild(listCard);

  // Chargement des formules tarifaires
  async function loadPlans() {
    const revision = sessionRevision();
    plansContainer.replaceChildren(createLoadingIndicator('Chargement des formules…'));

    try {
      const plans = await api('/api/subscriptions/plans/all');
      assertCurrentSession(revision);

      if (!Array.isArray(plans) || plans.length === 0) {
        plansContainer.replaceChildren(createEmptyState('Aucune formule trouvée.'));
        return;
      }

      plansContainer.replaceChildren();

      for (const plan of plans) {
        const card = createDomNode('article', '', 'plan-card');

        const title = createDomNode('h3', getSubscriptionPeriodLabel(plan.period));
        const periodCode = createDomNode('span', `Code: ${plan.period}`, 'muted');
        const form = createDomNode('form', '', 'modal-form');

        const priceLabel = createDomNode('label', `Tarif (${plan.currency || 'MAD'})`);
        const priceInput = createDomNode('input', '', '', {
          type: 'number',
          step: '0.01',
          min: '0',
          value: plan.price !== undefined ? String(plan.price) : '0',
          required: true
        });
        priceLabel.appendChild(priceInput);

        const activeWrapper = createDomNode('label', '', 'checkbox-label');
        const activeInput = createDomNode('input', '', '', {
          type: 'checkbox'
        });
        activeInput.checked = plan.active !== false;
        activeWrapper.appendChild(activeInput);
        activeWrapper.appendChild(document.createTextNode(' Formule active'));

        const saveBtn = createDomNode('button', 'Enregistrer', 'secondary', { type: 'submit' });

        form.appendChild(priceLabel);
        form.appendChild(activeWrapper);
        form.appendChild(saveBtn);

        card.appendChild(title);
        card.appendChild(periodCode);
        card.appendChild(form);

        form.addEventListener('submit', event => {
          event.preventDefault();
          const newPrice = parseFloat(priceInput.value);
          if (isNaN(newPrice) || newPrice < 0) {
            showErrorToast('Le tarif doit être un nombre positif ou nul.');
            return;
          }
          const isActive = activeInput.checked;

          executeButtonAction(saveBtn, async checkSession => {
            const updated = await api(`/api/subscriptions/plans/${encodeURIComponent(plan.period)}`, {
              method: 'PUT',
              body: { price: newPrice, active: isActive }
            });
            checkSession();
            showToast(`Formule ${getSubscriptionPeriodLabel(plan.period)} mise à jour (${formatMoney(updated.price)}).`, 'success');
          });
        });

        plansContainer.appendChild(card);
      }
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      plansContainer.replaceChildren(createEmptyState('Impossible de charger les formules d’abonnement.'));
      showErrorToast(error.message);
    }
  }

  // Chargement de la liste paginée des abonnements
  async function loadSubscriptions(page = 0, status = currentStatusFilter) {
    const revision = sessionRevision();
    currentSubPage = page;
    currentStatusFilter = status;

    subsStatusEl.textContent = 'Chargement…';
    subsTableContainer.replaceChildren(createLoadingIndicator('Chargement des abonnements…'));
    subsPagerContainer.replaceChildren();

    const query = buildQueryString({ page, size: 10, status });

    try {
      const data = await api(`/api/subscriptions/admin${query}`);
      assertCurrentSession(revision);

      const items = Array.isArray(data?.content) ? data.content : [];
      if (items.length === 0) {
        subsStatusEl.textContent = 'Aucun abonnement trouvé.';
        subsTableContainer.replaceChildren(createEmptyState('Aucun abonnement ne correspond aux critères sélectionnés.'));
        return;
      }

      subsStatusEl.textContent = `${data.totalElements || items.length} abonnement(s) enregistré(s).`;

      const tableWrapper = createDomNode('div', '', 'table-responsive');
      const table = createDomNode('table', '', 'data-table');
      const thead = createDomNode('thead');
      const trHead = createDomNode('tr');
      trHead.appendChild(createDomNode('th', 'ID / Référence'));
      trHead.appendChild(createDomNode('th', 'Utilisateur'));
      trHead.appendChild(createDomNode('th', 'Formule'));
      trHead.appendChild(createDomNode('th', 'Statut'));
      trHead.appendChild(createDomNode('th', 'Début'));
      trHead.appendChild(createDomNode('th', 'Fin'));
      trHead.appendChild(createDomNode('th', 'Montant'));
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = createDomNode('tbody');

      for (const sub of items) {
        const tr = createDomNode('tr');

        const idCell = createDomNode('td');
        idCell.appendChild(createDomNode('strong', String(sub.id).slice(0, 8)));
        tr.appendChild(idCell);

        tr.appendChild(createDomNode('td', String(sub.userId || '—')));
        tr.appendChild(createDomNode('td', getSubscriptionPeriodLabel(sub.period)));

        const statusCell = createDomNode('td');
        const statusInfo = getSubscriptionStatusInfo(sub.status);
        statusCell.appendChild(createDomNode('span', statusInfo.label, statusInfo.badgeClass));
        tr.appendChild(statusCell);

        tr.appendChild(createDomNode('td', formatDate(sub.startsAt)));
        tr.appendChild(createDomNode('td', formatDate(sub.endsAt)));

        const priceCell = createDomNode('td');
        priceCell.appendChild(createDomNode('strong', formatMoney(sub.price, sub.currency || 'MAD')));
        tr.appendChild(priceCell);

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      subsTableContainer.replaceChildren(tableWrapper);

      // Pagination
      const totalPages = data.totalPages || 1;
      const prevBtn = createDomNode('button', '← Précédent', 'secondary', {
        type: 'button',
        disabled: page <= 0
      });
      const nextBtn = createDomNode('button', 'Suivant →', 'secondary', {
        type: 'button',
        disabled: page >= totalPages - 1
      });
      const pageInfo = createDomNode('span', `Page ${page + 1} sur ${totalPages}`);

      prevBtn.addEventListener('click', () => {
        if (page > 0) loadSubscriptions(page - 1, currentStatusFilter);
      });
      nextBtn.addEventListener('click', () => {
        if (page < totalPages - 1) loadSubscriptions(page + 1, currentStatusFilter);
      });

      subsPagerContainer.replaceChildren(prevBtn, pageInfo, nextBtn);
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      subsStatusEl.textContent = 'Erreur de chargement.';
      subsTableContainer.replaceChildren(createEmptyState('Impossible de charger les abonnements.'));
      showErrorToast(error.message);
    }
  }

  // Filtrage
  statusSelect.addEventListener('change', () => {
    loadSubscriptions(0, statusSelect.value);
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, async () => {
      await Promise.all([loadPlans(), loadSubscriptions(currentSubPage, currentStatusFilter)]);
    });
  });

  loadPlans();
  loadSubscriptions(0, '');

  return container;
}
