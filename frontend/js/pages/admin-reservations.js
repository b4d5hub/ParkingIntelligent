// frontend/js/pages/admin-reservations.js
// Page de consultation et filtrage de toutes les réservations pour les administrateurs.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatDate, formatMoney, buildQueryString, validateDateRange } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';
import { getReservationStatusInfo } from '../ui/labels.js';

export function renderAdminReservationsPage() {
  const container = createDomNode('section', '', 'history', {
    'aria-label': 'Toutes les réservations du parking'
  });

  let currentPage = 0;
  let activeFilters = {
    status: '',
    from: '',
    to: '',
    placeId: '',
    conducteurId: ''
  };

  // En-tête
  const header = createDomNode('div', '', 'section-heading');
  const introDiv = createDomNode('div');
  introDiv.appendChild(createDomNode('h1', 'Réservations'));
  introDiv.appendChild(createDomNode('p', 'Consultez, filtrez et suivez l’ensemble des réservations du parking.', 'muted'));
  const refreshBtn = createDomNode('button', 'Actualiser', 'quiet', { type: 'button' });
  header.appendChild(introDiv);
  header.appendChild(refreshBtn);

  // Formulaire de filtrage
  const filterForm = createDomNode('form', '', 'card admin-controls', { 'aria-label': 'Filtres de réservations' });
  filterForm.appendChild(createDomNode('h2', 'Filtres de recherche'));

  const filtersGrid = createDomNode('div', '', 'filters');

  // 1. Statut
  const statusLabel = createDomNode('label', 'Statut');
  const statusSelect = createDomNode('select', '', '', { name: 'status' });
  statusSelect.appendChild(createDomNode('option', 'Tous les statuts', '', { value: '' }));
  statusSelect.appendChild(createDomNode('option', 'Confirmée', '', { value: 'CONFIRMED' }));
  statusSelect.appendChild(createDomNode('option', 'En cours', '', { value: 'IN_PROGRESS' }));
  statusSelect.appendChild(createDomNode('option', 'Terminée', '', { value: 'COMPLETED' }));
  statusSelect.appendChild(createDomNode('option', 'Annulée', '', { value: 'CANCELLED' }));
  statusSelect.appendChild(createDomNode('option', 'Expirée', '', { value: 'EXPIRED' }));
  statusLabel.appendChild(statusSelect);

  // 2. Date Début (from)
  const fromLabel = createDomNode('label', 'Du (date début)');
  const fromInput = createDomNode('input', '', '', {
    type: 'date',
    name: 'from'
  });
  fromLabel.appendChild(fromInput);

  // 3. Date Fin (to)
  const toLabel = createDomNode('label', 'Au (date fin)');
  const toInput = createDomNode('input', '', '', {
    type: 'date',
    name: 'to'
  });
  toLabel.appendChild(toInput);

  // 4. Place ID
  const placeLabel = createDomNode('label', 'N° Place (ID)');
  const placeInput = createDomNode('input', '', '', {
    type: 'number',
    name: 'placeId',
    placeholder: 'Ex. 1',
    min: '1'
  });
  placeLabel.appendChild(placeInput);

  // 5. Conducteur ID
  const driverLabel = createDomNode('label', 'Conducteur (ID)');
  const driverInput = createDomNode('input', '', '', {
    type: 'number',
    name: 'conducteurId',
    placeholder: 'Ex. 2',
    min: '1'
  });
  driverLabel.appendChild(driverInput);

  filtersGrid.appendChild(statusLabel);
  filtersGrid.appendChild(fromLabel);
  filtersGrid.appendChild(toLabel);
  filtersGrid.appendChild(placeLabel);
  filtersGrid.appendChild(driverLabel);

  const filterActions = createDomNode('div', '', 'row');
  const submitFilterBtn = createDomNode('button', 'Appliquer les filtres', '', { type: 'submit' });
  const resetFilterBtn = createDomNode('button', 'Réinitialiser', 'secondary', { type: 'button' });
  filterActions.appendChild(submitFilterBtn);
  filterActions.appendChild(resetFilterBtn);

  filterForm.appendChild(filtersGrid);
  filterForm.appendChild(filterActions);

  // Liste et table
  const listCard = createDomNode('section', '', 'card card-section', { 'aria-label': 'Résultats des réservations' });
  const statusEl = createDomNode('p', 'Chargement des réservations…', 'muted', { role: 'status' });
  const tableContainer = createDomNode('div', '', 'reservations-table-container');
  const pagerContainer = createDomNode('div', '', 'row pager');

  listCard.appendChild(statusEl);
  listCard.appendChild(tableContainer);
  listCard.appendChild(pagerContainer);

  container.appendChild(header);
  container.appendChild(filterForm);
  container.appendChild(listCard);

  async function loadReservations(page = 0) {
    const revision = sessionRevision();
    currentPage = page;

    // Validation des dates côté client
    if (activeFilters.from && activeFilters.to) {
      const check = validateDateRange(activeFilters.from, activeFilters.to);
      if (!check.valid) {
        showErrorToast(check.message);
        return;
      }
    }

    statusEl.textContent = 'Chargement…';
    tableContainer.replaceChildren(createLoadingIndicator('Chargement des réservations…'));
    pagerContainer.replaceChildren();

    const params = {
      page,
      size: 15,
      status: activeFilters.status || undefined,
      from: activeFilters.from ? `${activeFilters.from}T00:00:00Z` : undefined,
      to: activeFilters.to ? `${activeFilters.to}T23:59:59Z` : undefined,
      placeId: activeFilters.placeId || undefined,
      conducteurId: activeFilters.conducteurId || undefined
    };

    const query = buildQueryString(params);

    try {
      const data = await api(`/api/reservations/admin${query}`);
      assertCurrentSession(revision);

      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) {
        statusEl.textContent = 'Aucune réservation trouvée.';
        tableContainer.replaceChildren(createEmptyState('Aucune réservation ne correspond à vos filtres.'));
        return;
      }

      statusEl.textContent = `${data.totalElements || items.length} réservation(s) trouvée(s).`;

      const tableWrapper = createDomNode('div', '', 'table-responsive');
      const table = createDomNode('table', '', 'data-table');
      const thead = createDomNode('thead');
      const trHead = createDomNode('tr');
      trHead.appendChild(createDomNode('th', 'ID'));
      trHead.appendChild(createDomNode('th', 'Conducteur'));
      trHead.appendChild(createDomNode('th', 'Place'));
      trHead.appendChild(createDomNode('th', 'Début prévu'));
      trHead.appendChild(createDomNode('th', 'Fin prévue'));
      trHead.appendChild(createDomNode('th', 'Statut'));
      trHead.appendChild(createDomNode('th', 'Arrivée réelle'));
      trHead.appendChild(createDomNode('th', 'Départ réel'));
      trHead.appendChild(createDomNode('th', 'Montant'));
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = createDomNode('tbody');

      for (const r of items) {
        const tr = createDomNode('tr');

        // ID
        const idCell = createDomNode('td');
        idCell.appendChild(createDomNode('strong', `#${r.id}`));
        tr.appendChild(idCell);

        // Conducteur
        tr.appendChild(createDomNode('td', `ID ${r.conducteurId}`));

        // Place
        tr.appendChild(createDomNode('td', `Place ${r.placeId}`));

        // Dates prévues
        tr.appendChild(createDomNode('td', formatDate(r.debutPrevu)));
        tr.appendChild(createDomNode('td', formatDate(r.finPrevue)));

        // Statut
        const statusCell = createDomNode('td');
        const statusInfo = getReservationStatusInfo(r.statut);
        statusCell.appendChild(createDomNode('span', statusInfo.label, statusInfo.badgeClass));
        tr.appendChild(statusCell);

        // Arrivée & Départ réels
        tr.appendChild(createDomNode('td', formatDate(r.arriveeReelle)));
        tr.appendChild(createDomNode('td', formatDate(r.departReel)));

        // Montant
        const montant = (r.bookingPaid !== undefined ? Number(r.bookingPaid) : 0) +
                        (r.extraPaid !== undefined ? Number(r.extraPaid) : 0);
        const montantFinal = r.montantTotal !== undefined && r.montantTotal !== null
          ? Number(r.montantTotal)
          : montant;

        const amountCell = createDomNode('td');
        amountCell.appendChild(createDomNode('strong', formatMoney(montantFinal, r.devise || 'MAD')));
        tr.appendChild(amountCell);

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      tableContainer.replaceChildren(tableWrapper);

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
        if (page > 0) loadReservations(page - 1);
      });
      nextBtn.addEventListener('click', () => {
        if (page < totalPages - 1) loadReservations(page + 1);
      });

      pagerContainer.replaceChildren(prevBtn, pageInfo, nextBtn);
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      statusEl.textContent = 'Erreur de chargement.';
      tableContainer.replaceChildren(createEmptyState('Impossible de charger les réservations.'));
      showErrorToast(error.message);
    }
  }

  // Soumission des filtres
  filterForm.addEventListener('submit', event => {
    event.preventDefault();
    activeFilters = {
      status: statusSelect.value,
      from: fromInput.value,
      to: toInput.value,
      placeId: placeInput.value.trim(),
      conducteurId: driverInput.value.trim()
    };
    loadReservations(0);
  });

  resetFilterBtn.addEventListener('click', () => {
    statusSelect.value = '';
    fromInput.value = '';
    toInput.value = '';
    placeInput.value = '';
    driverInput.value = '';
    activeFilters = { status: '', from: '', to: '', placeId: '', conducteurId: '' };
    loadReservations(0);
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, () => loadReservations(currentPage));
  });

  loadReservations(0);

  return container;
}
