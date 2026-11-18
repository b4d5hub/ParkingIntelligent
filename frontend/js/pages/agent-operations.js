// frontend/js/pages/agent-operations.js
// Page de gestion des opérations de parking pour les agents (arrivées, départs, occupation).

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatDate, formatMoney, toLocalIsoString } from '../ui/formatters.js';
import { getReservationStatusInfo } from '../ui/labels.js';
import { confirmModal } from '../ui/modal.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';

export function renderAgentOperationsPage() {
  const container = createDomNode('section', '', '', {
    'aria-label': 'Arrivées et départs'
  });

  // State local
  let places = [];
  let operations = [];
  let currentPage = 0;
  const pageSize = 20;

  // En-tête de la page
  container.appendChild(createDomNode('h1', 'Arrivées et départs'));

  // Filtres par dates
  const filtersForm = createDomNode('form', '', 'filters', { id: 'operations-form' });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);

  const startLabel = createDomNode('label', 'Du');
  const startInput = createDomNode('input', '', '', {
    type: 'datetime-local',
    name: 'start',
    required: true,
    value: toLocalIsoString(startOfDay)
  });
  startLabel.appendChild(startInput);

  const endLabel = createDomNode('label', 'Au');
  const endInput = createDomNode('input', '', '', {
    type: 'datetime-local',
    name: 'end',
    required: true,
    value: toLocalIsoString(endOfTomorrow)
  });
  endLabel.appendChild(endInput);

  const filterBtn = createDomNode('button', 'Actualiser', 'secondary', { type: 'submit' });
  filtersForm.appendChild(startLabel);
  filtersForm.appendChild(endLabel);
  filtersForm.appendChild(filterBtn);
  container.appendChild(filtersForm);

  // Disposition en deux colonnes
  const dashboard = createDomNode('div', '', 'dashboard');

  // Colonne Gauche : Plan d'occupation
  const mapSection = createDomNode('section', '', '', { 'aria-label': 'Occupation du parking' });
  const mapStatusEl = createDomNode('p', 'Chargement des places…', 'muted', { role: 'status' });
  const mapGrid = createDomNode('div', '', 'lot', { 'aria-label': 'Occupation actuelle' });

  const legend = createDomNode('ul', '', 'legend', { 'aria-label': 'Légende' });
  const legendItems = [
    { keyClass: 'key unchecked', label: 'Libre' },
    { keyClass: 'key awaiting', label: 'Arrivée attendue' },
    { keyClass: 'key occupied', label: 'Occupée' },
    { keyClass: 'key unavailable', label: 'Hors service' }
  ];
  for (const item of legendItems) {
    const li = createDomNode('li');
    li.appendChild(createDomNode('i', '', item.keyClass, { 'aria-hidden': 'true' }));
    li.appendChild(document.createTextNode(item.label));
    legend.appendChild(li);
  }

  const mapPolicy = createDomNode(
    'p',
    'Le plan indique l’occupation actuelle et les arrivées attendues sur la page affichée.',
    'muted policy'
  );

  mapSection.appendChild(mapStatusEl);
  mapSection.appendChild(mapGrid);
  mapSection.appendChild(legend);
  mapSection.appendChild(mapPolicy);

  // Colonne Droite : Liste des réservations de la période
  const opsSection = createDomNode('section', '', 'card operations', { 'aria-label': 'Réservations de la période' });
  opsSection.appendChild(createDomNode('h2', 'Réservations de la période'));

  const opsList = createDomNode('div', '', 'reservation-list', { role: 'region', 'aria-label': 'Liste des réservations' });
  const pagerDiv = createDomNode('div', '', 'pager');
  const prevBtn = createDomNode('button', 'Précédent', 'secondary', { type: 'button', disabled: true });
  const pageInfoEl = createDomNode('span', 'Page 1');
  const nextBtn = createDomNode('button', 'Suivant', 'secondary', { type: 'button', disabled: true });
  pagerDiv.appendChild(prevBtn);
  pagerDiv.appendChild(pageInfoEl);
  pagerDiv.appendChild(nextBtn);

  opsSection.appendChild(opsList);
  opsSection.appendChild(pagerDiv);

  dashboard.appendChild(mapSection);
  dashboard.appendChild(opsSection);
  container.appendChild(dashboard);

  function renderMap() {
    const nowTime = Date.now();
    const occupiedCount = places.filter(p => p.statut === 'OCCUPEE').length;
    mapStatusEl.textContent = places.length
      ? `${occupiedCount} occupée(s) · ${places.length} place(s) au total`
      : 'Aucune place configurée.';

    mapGrid.replaceChildren();

    for (const place of places) {
      const matchingOps = operations.filter(op => String(op.placeId) === String(place.id));
      const activeOp = matchingOps.find(op => op.statut === 'IN_PROGRESS');
      const waitingOp = matchingOps.find(op => op.statut === 'CONFIRMED' && new Date(op.finPrevue).getTime() > nowTime);
      const targetOp = activeOp || waitingOp;

      let state = 'unchecked';
      let stateLabel = 'Libre';

      if (place.statut === 'HORS_SERVICE') {
        state = 'unavailable';
        stateLabel = 'Hors service';
      } else if (place.statut === 'OCCUPEE') {
        state = 'occupied';
        stateLabel = 'Occupée';
      } else if (activeOp) {
        state = 'awaiting';
        stateLabel = 'Arrivée enregistrée';
      } else if (waitingOp) {
        state = 'awaiting';
        stateLabel = 'Arrivée attendue';
      } else if (place.statut === 'RESERVEE') {
        state = 'awaiting';
        stateLabel = 'Réservée';
      }

      const bay = createDomNode(targetOp ? 'button' : 'div', '', 'bay', {
        'aria-label': `Place ${place.numero}`
      });
      bay.dataset.state = state;
      bay.appendChild(createDomNode('strong', place.numero));
      bay.appendChild(createDomNode('span', stateLabel, 'bay-state'));

      if (targetOp) {
        bay.type = 'button';
        bay.addEventListener('click', () => {
          const card = document.getElementById(`operation-${targetOp.id}`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            card.focus({ preventScroll: true });
          }
        });
      }

      mapGrid.appendChild(bay);
    }
  }

  function buildOperationCard(op) {
    const card = createDomNode('article', '', 'reservation', {
      id: `operation-${op.id}`,
      tabindex: -1
    });

    const headerRow = createDomNode('div', '', 'row');
    const placeMatch = places.find(p => String(p.id) === String(op.placeId));
    const placeNum = placeMatch ? placeMatch.numero : op.placeId;

    headerRow.appendChild(createDomNode('h3', `Place ${placeNum} · Réservation n°${op.id}`));
    const statusInfo = getReservationStatusInfo(op.statut);
    headerRow.appendChild(createDomNode('span', statusInfo.label, statusInfo.badgeClass));
    card.appendChild(headerRow);

    // Dates
    card.appendChild(createDomNode('p', `Du ${formatDate(op.debutPrevu)} au ${formatDate(op.finPrevue)}`));

    // Montants
    const estText = `Estimation : ${formatMoney(op.montantEstime, op.currency)}`;
    const finalText = op.montantFinal !== null && op.montantFinal !== undefined
      ? ` · Final : ${formatMoney(op.montantFinal, op.currency)}`
      : '';
    card.appendChild(createDomNode('p', `${estText}${finalText}`, 'muted'));

    // Infos conducteur & arrivées/départs
    const arrText = op.arriveeReelle ? formatDate(op.arriveeReelle) : 'Non enregistrée';
    const depText = op.departReel ? formatDate(op.departReel) : 'Non enregistré';
    card.appendChild(createDomNode('p', `Conducteur n°${op.conducteurId} · Arrivée : ${arrText} · Départ : ${depText}`, 'muted'));

    if (op.paymentStatus === 'PAID') {
      const ref = op.paymentReference ? ` · ${op.paymentReference}` : '';
      card.appendChild(createDomNode('p', `Paiement simulé enregistré${ref}`, 'muted'));
    }

    if (op.bookingPaid !== null && op.bookingPaid !== undefined) {
      const balanceMsg = op.statut === 'CANCELLED'
        ? 'Paiement conservé, sans remboursement'
        : op.extraPaid === null || op.extraPaid === undefined
          ? 'Complément à calculer au départ'
          : `Complément payé : ${formatMoney(op.extraPaid, op.currency)}`;
      card.appendChild(createDomNode('p', `Créneau payé : ${formatMoney(op.bookingPaid, op.currency)} · ${balanceMsg}`, 'muted'));
    }

    if (op.extraPaymentReference) {
      card.appendChild(createDomNode('p', `Paiement complémentaire simulé : ${op.extraPaymentReference}`, 'muted'));
    }

    if (op.placesSyncPending) {
      card.appendChild(createDomNode('p', 'Mise à jour de la place en attente. Actualisez pour vérifier la synchronisation.', 'sync'));
    }

    // Boutons d'action agent
    if (op.statut === 'CONFIRMED') {
      const arrivalBtn = createDomNode('button', 'Enregistrer l’arrivée', 'secondary', { type: 'button' });
      arrivalBtn.addEventListener('click', () => {
        executeButtonAction(arrivalBtn, async checkSession => {
          await api(`/api/reservations/${encodeURIComponent(op.id)}/arrival`, { method: 'POST' });
          checkSession();
          showToast(`Arrivée enregistrée pour la place ${placeNum}.`, 'success');
          await Promise.all([loadPlaces(), loadOperations()]);
        });
      });
      card.appendChild(arrivalBtn);
    } else if (op.statut === 'IN_PROGRESS') {
      const departureBtn = createDomNode('button', 'Enregistrer le départ', 'secondary', { type: 'button' });
      departureBtn.addEventListener('click', async () => {
        const confirmed = await confirmModal({
          title: 'Enregistrer le départ',
          message: `Confirmer le départ réel du véhicule de la place ${placeNum} et le règlement simulé ?`,
          confirmText: 'Confirmer le départ',
          cancelText: 'Annuler'
        });
        if (!confirmed) return;

        executeButtonAction(departureBtn, async checkSession => {
          const res = await api(`/api/reservations/${encodeURIComponent(op.id)}/departure`, { method: 'POST' });
          checkSession();
          const extraInfo = res?.extraPaid && res.extraPaid > 0
            ? ` (dépassement facturé : ${formatMoney(res.extraPaid, res.currency)})`
            : '';
          showToast(`Départ enregistré pour la place ${placeNum}${extraInfo}.`, 'success');
          await Promise.all([loadPlaces(), loadOperations()]);
        });
      });
      card.appendChild(departureBtn);
    }

    return card;
  }

  async function loadPlaces() {
    const revision = sessionRevision();
    try {
      const list = await api('/api/places');
      assertCurrentSession(revision);
      if (Array.isArray(list)) {
        places = list.map(p => ({ ...p, id: String(p.id) }));
        renderMap();
      }
    } catch {
      // Échec géré au niveau global
    }
  }

  async function loadOperations() {
    const revision = sessionRevision();
    opsList.replaceChildren(createLoadingIndicator('Chargement des réservations…'));

    const start = new Date(startInput.value);
    const end = new Date(endInput.value);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      showErrorToast('Veuillez sélectionner un intervalle de dates valide (fin après le début).');
      opsList.replaceChildren(createEmptyState('Période invalide.'));
      return;
    }

    try {
      const query = new URLSearchParams({
        page: String(currentPage),
        size: String(pageSize),
        start: start.toISOString(),
        end: end.toISOString()
      });
      const data = await api('/api/reservations/operations?' + query);
      assertCurrentSession(revision);

      opsList.replaceChildren();

      if (!data?.items || data.items.length === 0) {
        opsList.appendChild(createEmptyState('Aucune réservation pour cette consultation.'));
        pageInfoEl.textContent = 'Page 1 · 0 réservation';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        operations = [];
        renderMap();
        return;
      }

      operations = data.items;
      renderMap();

      for (const op of data.items) {
        opsList.appendChild(buildOperationCard(op));
      }

      const pageIndex = data.page || 0;
      const total = data.total || 0;
      pageInfoEl.textContent = `Page ${pageIndex + 1} · ${total} réservation(s)`;
      prevBtn.disabled = pageIndex === 0;
      nextBtn.disabled = (pageIndex + 1) * pageSize >= total;

    } catch (error) {
      if (!isCurrentSession(revision)) return;
      opsList.replaceChildren(createEmptyState('Impossible de charger les réservations pour cette période.'));
      showErrorToast(error.message);
    }
  }

  filtersForm.addEventListener('submit', event => {
    event.preventDefault();
    currentPage = 0;
    executeButtonAction(filterBtn, () => Promise.all([loadPlaces(), loadOperations()]));
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage--;
      loadOperations();
    }
  });

  nextBtn.addEventListener('click', () => {
    currentPage++;
    loadOperations();
  });

  Promise.all([loadPlaces(), loadOperations()]);

  return container;
}
