// frontend/js/pages/driver-history.js
// Historique paginé des réservations du conducteur.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatDate, formatMoney } from '../ui/formatters.js';
import { getReservationStatusInfo } from '../ui/labels.js';
import { confirmModal } from '../ui/modal.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';

export function renderDriverHistoryPage() {
  const container = createDomNode('section', '', 'history', {
    'aria-label': 'Historique des réservations'
  });

  let currentPage = 0;
  const pageSize = 20;

  // En-tête
  const header = createDomNode('div', '', 'section-heading');
  const introDiv = createDomNode('div');
  introDiv.appendChild(createDomNode('h1', 'Mes réservations'));
  introDiv.appendChild(createDomNode('p', 'Retrouvez vos créneaux et leurs paiements.', 'muted'));
  const refreshBtn = createDomNode('button', 'Actualiser', 'quiet', { type: 'button' });
  header.appendChild(introDiv);
  header.appendChild(refreshBtn);

  // Conteneur de liste
  const listContainer = createDomNode('div', '', 'reservation-list', {
    role: 'region',
    'aria-label': 'Liste des réservations'
  });

  // Pagination
  const pagerDiv = createDomNode('div', '', 'pager');
  const prevBtn = createDomNode('button', 'Précédent', 'secondary', { type: 'button', disabled: true });
  const pageInfoEl = createDomNode('span', 'Page 1');
  const nextBtn = createDomNode('button', 'Suivant', 'secondary', { type: 'button', disabled: true });
  pagerDiv.appendChild(prevBtn);
  pagerDiv.appendChild(pageInfoEl);
  pagerDiv.appendChild(nextBtn);

  container.appendChild(header);
  container.appendChild(listContainer);
  container.appendChild(pagerDiv);

  function buildReservationCard(res) {
    const card = createDomNode('article', '', 'reservation');
    const headerRow = createDomNode('div', '', 'row');

    const placeNumber = res.placeNumero ? `Place ${res.placeNumero}` : `Place n°${res.placeId}`;
    const title = createDomNode('h3', `${placeNumber} · Réservation n°${res.id}`);
    const statusInfo = getReservationStatusInfo(res.statut);
    const badge = createDomNode('span', statusInfo.label, statusInfo.badgeClass);

    headerRow.appendChild(title);
    headerRow.appendChild(badge);
    card.appendChild(headerRow);

    // Dates
    const datesP = createDomNode('p', `Du ${formatDate(res.debutPrevu)} au ${formatDate(res.finPrevue)}`);
    card.appendChild(datesP);

    // Estimations et montants finaux
    const estText = `Estimation : ${formatMoney(res.montantEstime, res.currency)}`;
    const finalText = res.montantFinal !== null && res.montantFinal !== undefined
      ? ` · Final : ${formatMoney(res.montantFinal, res.currency)}`
      : '';
    card.appendChild(createDomNode('p', `${estText}${finalText}`, 'muted'));

    // Paiements
    if (res.bookingPaid !== null && res.bookingPaid !== undefined) {
      let balanceMsg = '';
      if (res.statut === 'CANCELLED') {
        balanceMsg = 'Paiement conservé, sans remboursement';
      } else if (res.extraPaid === null || res.extraPaid === undefined) {
        balanceMsg = 'Complément à calculer au départ';
      } else {
        balanceMsg = `Complément payé : ${formatMoney(res.extraPaid, res.currency)}`;
      }
      card.appendChild(createDomNode('p', `Créneau payé : ${formatMoney(res.bookingPaid, res.currency)} · ${balanceMsg}`, 'muted'));
    }

    if (res.paymentStatus === 'PAID') {
      const ref = res.paymentReference ? ` · Réf: ${res.paymentReference}` : '';
      card.appendChild(createDomNode('p', `Paiement simulé enregistré${ref}`, 'muted'));
    }

    if (res.extraPaymentReference) {
      card.appendChild(createDomNode('p', `Paiement complémentaire simulé : ${res.extraPaymentReference}`, 'muted'));
    }

    if (res.placesSyncPending) {
      card.appendChild(createDomNode('p', 'Mise à jour de la place en attente. Actualisez pour vérifier la synchronisation.', 'sync'));
    }

    // Bouton Annuler si permis
    const canCancel = res.statut === 'CONFIRMED' && new Date(res.debutPrevu) > new Date();
    if (canCancel) {
      const cancelBtn = createDomNode('button', 'Annuler la réservation', 'secondary', { type: 'button' });
      cancelBtn.addEventListener('click', async () => {
        const confirmed = await confirmModal({
          title: 'Annuler la réservation',
          message: 'Annuler cette réservation ? Le créneau est payé à la réservation et reste acquis sans remboursement.',
          confirmText: 'Confirmer l’annulation',
          cancelText: 'Retour',
          isDanger: true
        });
        if (!confirmed) return;

        executeButtonAction(cancelBtn, async checkSession => {
          await api(`/api/reservations/${encodeURIComponent(res.id)}/cancel`, { method: 'POST' });
          checkSession();
          showToast('Réservation annulée avec succès.', 'success');
          await loadReservations();
        });
      });
      card.appendChild(cancelBtn);
    }

    return card;
  }

  async function loadReservations() {
    const revision = sessionRevision();
    listContainer.replaceChildren(createLoadingIndicator('Chargement de vos réservations…'));

    try {
      const query = new URLSearchParams({ page: String(currentPage), size: String(pageSize) });
      const data = await api('/api/reservations/me?' + query);
      assertCurrentSession(revision);

      listContainer.replaceChildren();

      if (!data?.items || data.items.length === 0) {
        listContainer.appendChild(createEmptyState('Vous n’avez aucune réservation pour le moment.'));
        pageInfoEl.textContent = 'Page 1 · 0 réservation';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }

      // Séparation Actives / Passées
      const isActive = r => ['CONFIRMED', 'IN_PROGRESS'].includes(r.statut);
      const activeItems = data.items.filter(isActive);
      const pastItems = data.items.filter(r => !isActive(r));

      if (activeItems.length > 0) {
        listContainer.appendChild(createDomNode('h2', 'À venir et en cours', 'group-title'));
        for (const item of activeItems) {
          listContainer.appendChild(buildReservationCard(item));
        }
      }

      if (pastItems.length > 0) {
        listContainer.appendChild(createDomNode('h2', 'Passées et annulées', 'group-title'));
        for (const item of pastItems) {
          listContainer.appendChild(buildReservationCard(item));
        }
      }

      // Mise à jour de la pagination
      const pageIndex = data.page || 0;
      const total = data.total || 0;
      pageInfoEl.textContent = `Page ${pageIndex + 1} · ${total} réservation(s)`;
      prevBtn.disabled = pageIndex === 0;
      nextBtn.disabled = (pageIndex + 1) * pageSize >= total;

    } catch (error) {
      if (!isCurrentSession(revision)) return;
      listContainer.replaceChildren(createEmptyState('Impossible de charger les réservations.'));
      showErrorToast(error.message);
    }
  }

  prevBtn.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      loadReservations();
    }
  });

  nextBtn.addEventListener('click', () => {
    currentPage++;
    loadReservations();
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, () => loadReservations());
  });

  loadReservations();

  return container;
}
