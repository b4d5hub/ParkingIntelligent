// frontend/js/pages/admin-tariffs.js
// Page de gestion des tarifs horaires et historique pour les administrateurs.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatDate, formatMoney } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';

export function renderAdminTariffsPage() {
  const container = createDomNode('section', '', 'history', {
    'aria-label': 'Tarifs du parking'
  });

  let currentHistoryPage = 0;

  // En-tête
  const header = createDomNode('div', '', 'section-heading');
  const introDiv = createDomNode('div');
  introDiv.appendChild(createDomNode('h1', 'Tarif horaire'));
  introDiv.appendChild(createDomNode('p', 'Consultez et ajustez le tarif horaire de base appliqué aux réservations.', 'muted'));
  const refreshBtn = createDomNode('button', 'Actualiser', 'quiet', { type: 'button' });
  header.appendChild(introDiv);
  header.appendChild(refreshBtn);

  // Carte de tarification
  const card = createDomNode('div', '', 'card admin-controls');

  // Affichage du tarif actuel
  const displayBox = createDomNode('div', '', 'tariff-display');
  displayBox.appendChild(createDomNode('span', 'Tarif actuel en vigueur', 'muted'));
  const currentRateEl = createDomNode('strong', 'Chargement…');
  displayBox.appendChild(currentRateEl);

  // Formulaire de modification
  const form = createDomNode('form', '', '', { id: 'update-tariff-form' });
  const rateLabel = createDomNode('label', 'Nouveau tarif horaire (MAD)');
  const rateInput = createDomNode('input', '', '', {
    type: 'number',
    name: 'prixDh',
    step: '0.01',
    min: '0.01',
    max: '10000',
    placeholder: 'Ex. 12.50',
    required: true
  });
  rateLabel.appendChild(rateInput);

  const submitBtn = createDomNode('button', 'Modifier le tarif', '', { type: 'submit' });
  form.appendChild(rateLabel);
  form.appendChild(submitBtn);

  card.appendChild(displayBox);
  card.appendChild(form);

  // Section Historique
  const historyCard = createDomNode('div', '', 'card card-section', { 'aria-label': 'Historique des tarifs' });
  historyCard.appendChild(createDomNode('h2', 'Historique des tarifs'));
  historyCard.appendChild(createDomNode('p', 'Consultez les évolutions antérieures du tarif horaire.', 'muted'));

  const historyContainer = createDomNode('div', '', 'history-content');
  const pagerContainer = createDomNode('div', '', 'row pager');
  historyCard.appendChild(historyContainer);
  historyCard.appendChild(pagerContainer);

  container.appendChild(header);
  container.appendChild(card);
  container.appendChild(historyCard);

  async function loadHourlyRate() {
    const revision = sessionRevision();
    currentRateEl.textContent = 'Chargement…';

    try {
      const data = await api('/api/tarifs/hourly');
      assertCurrentSession(revision);

      if (!data || typeof data.prixDh !== 'number') {
        throw new Error('Réponse invalide du service tarifs.');
      }

      currentRateEl.textContent = `${formatMoney(data.prixDh, data.currency || 'MAD')} / h`;
      if (!rateInput.value || document.activeElement !== rateInput) {
        rateInput.value = data.prixDh;
      }
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      currentRateEl.textContent = 'Indisponible';
      showErrorToast(error.message);
    }
  }

  async function loadHistory(page = 0) {
    const revision = sessionRevision();
    currentHistoryPage = page;
    historyContainer.replaceChildren(createLoadingIndicator('Chargement de l’historique…'));
    pagerContainer.replaceChildren();

    try {
      const data = await api(`/api/tarifs/hourly/history?page=${page}&size=10`);
      assertCurrentSession(revision);

      const items = Array.isArray(data?.content) ? data.content : [];
      if (items.length === 0) {
        historyContainer.replaceChildren(createEmptyState('Aucun historique de tarif disponible.'));
        return;
      }

      const tableWrapper = createDomNode('div', '', 'table-responsive');
      const table = createDomNode('table', '', 'data-table');
      const thead = createDomNode('thead');
      const headerRow = createDomNode('tr');
      headerRow.appendChild(createDomNode('th', 'Tarif'));
      headerRow.appendChild(createDomNode('th', 'Valable à partir du'));
      headerRow.appendChild(createDomNode('th', 'Auteur'));
      headerRow.appendChild(createDomNode('th', 'Enregistré le'));
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createDomNode('tbody');
      for (const item of items) {
        const row = createDomNode('tr');
        const rateCell = createDomNode('td');
        rateCell.appendChild(createDomNode('strong', `${formatMoney(item.prixDh)} / h`));
        row.appendChild(rateCell);
        row.appendChild(createDomNode('td', formatDate(item.valableAPartir)));
        row.appendChild(createDomNode('td', item.creePar || '—'));
        row.appendChild(createDomNode('td', formatDate(item.creeLe)));
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      historyContainer.replaceChildren(tableWrapper);

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
      const pageInfo = createDomNode('span', `Page ${page + 1} sur ${totalPages} (${data.totalElements || items.length} entrées)`);

      prevBtn.addEventListener('click', () => {
        if (page > 0) loadHistory(page - 1);
      });
      nextBtn.addEventListener('click', () => {
        if (page < totalPages - 1) loadHistory(page + 1);
      });

      pagerContainer.replaceChildren(prevBtn, pageInfo, nextBtn);
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      historyContainer.replaceChildren(createEmptyState('Impossible de charger l’historique des tarifs.'));
      showErrorToast(error.message);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const val = parseFloat(rateInput.value);
    if (isNaN(val) || val <= 0) {
      showErrorToast('Le tarif horaire doit être un nombre strictement positif.');
      return;
    }

    executeButtonAction(submitBtn, async checkSession => {
      const updated = await api('/api/tarifs/hourly', {
        method: 'PUT',
        body: { prixDh: val }
      });
      checkSession();

      const rateFormatted = `${formatMoney(updated.prixDh, updated.currency || 'MAD')} / h`;
      currentRateEl.textContent = rateFormatted;
      showToast(`Tarif horaire mis à jour avec succès : ${rateFormatted}`, 'success');
      await loadHistory(0);
    });
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, async () => {
      await Promise.all([loadHourlyRate(), loadHistory(currentHistoryPage)]);
    });
  });

  loadHourlyRate();
  loadHistory(0);

  return container;
}
