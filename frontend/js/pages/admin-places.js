// frontend/js/pages/admin-places.js
// Page de gestion des places du parking pour les administrateurs.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode } from '../ui/formatters.js';
import { getPlaceStatusInfo } from '../ui/labels.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';

export function renderAdminPlacesPage() {
  const container = createDomNode('section', '', 'dashboard', {
    'aria-label': 'Gestion des places du parking'
  });

  // Colonne Gauche : Liste des places
  const listCol = createDomNode('section', '', '', { 'aria-label': 'Places du parking' });
  const listHeader = createDomNode('div', '', 'section-heading');
  const listIntro = createDomNode('div');
  listIntro.appendChild(createDomNode('h1', 'Places du parking'));
  listIntro.appendChild(createDomNode('p', 'Gérez la disponibilité des places et leur mise hors service.', 'muted'));
  const refreshBtn = createDomNode('button', 'Actualiser', 'quiet', { type: 'button' });
  listHeader.appendChild(listIntro);
  listHeader.appendChild(refreshBtn);

  const placesStatusEl = createDomNode('p', 'Chargement des places…', 'muted', { role: 'status' });
  const placesList = createDomNode('div', '', 'admin-places-list', { role: 'region', 'aria-label': 'Liste des places' });

  listCol.appendChild(listHeader);
  listCol.appendChild(placesStatusEl);
  listCol.appendChild(placesList);

  // Colonne Droite : Formulaire d'ajout de place
  const formCol = createDomNode('section', '', 'card admin-controls', { 'aria-label': 'Ajouter une place' });
  formCol.appendChild(createDomNode('h2', 'Ajouter une place'));

  const addForm = createDomNode('form', '', '', { id: 'add-place-form' });
  const numLabel = createDomNode('label', 'Numéro de la place');
  const numInput = createDomNode('input', '', '', {
    type: 'text',
    name: 'numero',
    maxlength: 20,
    placeholder: 'Ex. A-101',
    required: true
  });
  numLabel.appendChild(numInput);

  const submitBtn = createDomNode('button', 'Ajouter la place', '', { type: 'submit' });
  addForm.appendChild(numLabel);
  addForm.appendChild(submitBtn);
  formCol.appendChild(addForm);

  container.appendChild(listCol);
  container.appendChild(formCol);

  async function loadPlaces() {
    const revision = sessionRevision();
    placesStatusEl.textContent = 'Chargement des places…';
    placesList.replaceChildren(createLoadingIndicator('Chargement des places…'));

    try {
      const list = await api('/api/places');
      assertCurrentSession(revision);

      placesList.replaceChildren();

      if (!Array.isArray(list) || list.length === 0) {
        placesStatusEl.textContent = 'Aucune place configurée.';
        placesList.appendChild(createEmptyState('Aucune place enregistrée pour le moment.'));
        return;
      }

      placesStatusEl.textContent = `${list.length} place(s) enregistrée(s).`;

      for (const place of list) {
        const card = createDomNode('article', '', 'admin-place-card');
        const info = createDomNode('div', '', 'admin-place-info');

        info.appendChild(createDomNode('strong', `Place ${place.numero}`));
        const statusInfo = getPlaceStatusInfo(place.statut);
        info.appendChild(createDomNode('span', statusInfo.label, statusInfo.badgeClass));
        card.appendChild(info);

        if (place.statut === 'LIBRE') {
          const toggleBtn = createDomNode('button', 'Mettre hors service', 'secondary', { type: 'button' });
          toggleBtn.addEventListener('click', () => {
            executeButtonAction(toggleBtn, async checkSession => {
              await api(`/api/places/${encodeURIComponent(place.id)}/statut`, {
                method: 'PATCH',
                body: { statut: 'HORS_SERVICE' }
              });
              checkSession();
              showToast(`Place ${place.numero} mise hors service.`, 'success');
              await loadPlaces();
            });
          });
          card.appendChild(toggleBtn);
        } else if (place.statut === 'HORS_SERVICE') {
          const toggleBtn = createDomNode('button', 'Remettre en service', 'secondary', { type: 'button' });
          toggleBtn.addEventListener('click', () => {
            executeButtonAction(toggleBtn, async checkSession => {
              await api(`/api/places/${encodeURIComponent(place.id)}/statut`, {
                method: 'PATCH',
                body: { statut: 'LIBRE' }
              });
              checkSession();
              showToast(`Place ${place.numero} remise en service.`, 'success');
              await loadPlaces();
            });
          });
          card.appendChild(toggleBtn);
        } else {
          const lockedBtn = createDomNode('button', statusInfo.label, 'secondary', {
            type: 'button',
            disabled: true
          });
          card.appendChild(lockedBtn);
        }

        placesList.appendChild(card);
      }
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      placesStatusEl.textContent = 'Impossible de charger les places.';
      placesList.replaceChildren(createEmptyState('Impossible de charger les places. Réessayez plus tard.'));
      showErrorToast(error.message);
    }
  }

  addForm.addEventListener('submit', event => {
    event.preventDefault();
    const numero = (numInput.value || '').trim();
    if (!numero) {
      showErrorToast('Veuillez saisir un numéro de place.');
      return;
    }
    if (numero.length > 20) {
      showErrorToast('Le numéro de place ne doit pas dépasser 20 caractères.');
      return;
    }

    executeButtonAction(submitBtn, async checkSession => {
      const created = await api('/api/places', {
        method: 'POST',
        body: { numero }
      });
      checkSession();
      numInput.value = '';
      showToast(`Place ${created.numero || numero} ajoutée avec succès.`, 'success');
      await loadPlaces();
    });
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, () => loadPlaces());
  });

  loadPlaces();

  return container;
}
