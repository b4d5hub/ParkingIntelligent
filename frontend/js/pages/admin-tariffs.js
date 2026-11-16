// frontend/js/pages/admin-tariffs.js
// Page de gestion des tarifs horaires pour les administrateurs.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatMoney } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';

export function renderAdminTariffsPage() {
  const container = createDomNode('section', '', 'history', {
    'aria-label': 'Tarifs du parking'
  });

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

  container.appendChild(header);
  container.appendChild(card);

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
    });
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, () => loadHourlyRate());
  });

  loadHourlyRate();

  return container;
}
