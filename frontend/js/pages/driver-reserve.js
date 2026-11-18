// frontend/js/pages/driver-reserve.js
// Page de réservation de place pour les conducteurs.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatMoney, toLocalIsoString } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { navigate, ROUTES } from '../router.js';

let bookingAttempt = null;

export function renderDriverReservePage() {
  const container = createDomNode('section', '', 'dashboard', {
    'aria-label': 'Réserver une place'
  });

  // State local
  let places = [];
  let availability = new Map();
  let availabilityTimer = null;
  let mapRevision = 0;
  let quoteRevision = 0;
  let quotedBookingFingerprint = null;
  let selectedPlaceId = '';

  // Colonne Gauche : Plan du parking
  const mapSection = createDomNode('section', '', '', { 'aria-label': 'Plan de réservation' });
  const mapHeading = createDomNode('div', '', 'map-heading');
  const placesStatusEl = createDomNode('p', 'Chargement des places…', 'muted', { role: 'status' });
  const refreshPlacesBtn = createDomNode('button', 'Actualiser les places', 'quiet', { type: 'button' });
  mapHeading.appendChild(placesStatusEl);
  mapHeading.appendChild(refreshPlacesBtn);

  const lotGrid = createDomNode('div', '', 'lot', {
    'aria-label': 'Places du parking',
    role: 'region'
  });

  const legend = createDomNode('ul', '', 'legend', { 'aria-label': 'Légende' });
  const legendItems = [
    { keyClass: 'key available', label: 'Disponible' },
    { keyClass: 'key selected', label: 'Sélectionnée' },
    { keyClass: 'key unavailable', label: 'Indisponible' },
    { keyClass: 'key unchecked', label: 'À vérifier' }
  ];
  for (const item of legendItems) {
    const li = createDomNode('li');
    li.appendChild(createDomNode('i', '', item.keyClass, { 'aria-hidden': 'true' }));
    li.appendChild(document.createTextNode(item.label));
    legend.appendChild(li);
  }

  mapSection.appendChild(mapHeading);
  mapSection.appendChild(lotGrid);
  mapSection.appendChild(legend);

  // Colonne Droite : Formulaire de réservation
  const formSection = createDomNode('section', '', 'card booking', {
    'aria-labelledby': 'booking-title'
  });
  const bookingTitle = createDomNode('h2', 'Votre créneau', '', { id: 'booking-title' });
  const form = createDomNode('form', '', '', { id: 'booking-form' });

  // Dates par défaut : prochain quart d'heure
  const now = new Date();
  const startDefault = new Date(Math.ceil((now.getTime() + 60_000) / 900_000) * 900_000);
  const endDefault = new Date(startDefault.getTime() + 7_200_000); // +2h

  const startLabel = createDomNode('label', 'Début prévu');
  const startInput = createDomNode('input', '', '', {
    type: 'datetime-local',
    name: 'debutPrevu',
    required: true,
    value: toLocalIsoString(startDefault)
  });
  startLabel.appendChild(startInput);

  const endLabel = createDomNode('label', 'Fin prévue');
  const endInput = createDomNode('input', '', '', {
    type: 'datetime-local',
    name: 'finPrevue',
    required: true,
    value: toLocalIsoString(endDefault)
  });
  endLabel.appendChild(endInput);

  // Durées rapides
  const durationsFieldset = createDomNode('fieldset', '', 'durations');
  durationsFieldset.appendChild(createDomNode('legend', 'Durée rapide'));
  for (const h of [1, 2, 3, 4]) {
    const btn = createDomNode('button', `${h} h`, 'secondary', {
      type: 'button',
      'data-hours': String(h)
    });
    btn.addEventListener('click', () => {
      const s = new Date(startInput.value);
      if (isNaN(s.getTime())) {
        startInput.focus();
        return;
      }
      endInput.value = toLocalIsoString(new Date(s.getTime() + h * 3_600_000));
      scheduleAvailability();
    });
    durationsFieldset.appendChild(btn);
  }

  // Type de véhicule
  const vehicleLabel = createDomNode('label', 'Type de véhicule');
  const vehicleInput = createDomNode('input', '', '', {
    type: 'text',
    name: 'typeVehicule',
    maxlength: 32,
    pattern: '[A-Za-z0-9_\\x2d]{1,32}',
    value: 'VOITURE',
    required: true
  });
  vehicleLabel.appendChild(vehicleInput);

  // Résumé sélection & montant
  const summaryPlace = createDomNode('div', '', 'booking-summary');
  summaryPlace.appendChild(createDomNode('span', 'Place sélectionnée'));
  const selectedPlaceText = createDomNode('strong', '—');
  summaryPlace.appendChild(selectedPlaceText);

  const summaryQuote = createDomNode('div', '', 'booking-summary');
  summaryQuote.appendChild(createDomNode('span', 'Montant estimé'));
  const quoteAmountText = createDomNode('strong', '—');
  summaryQuote.appendChild(quoteAmountText);

  const quoteNotice = createDomNode('p', '', 'muted', { role: 'status' });

  // Boutons d'action
  const actionsDiv = createDomNode('div', '', 'booking-actions');
  const estimateBtn = createDomNode('button', 'Obtenir le devis', 'secondary', {
    type: 'button',
    disabled: true
  });
  const bookBtn = createDomNode('button', 'Réserver et payer (simulation)', '', {
    type: 'submit',
    disabled: true
  });
  actionsDiv.appendChild(estimateBtn);
  actionsDiv.appendChild(bookBtn);

  const policyP = createDomNode(
    'p',
    'Le créneau est payé à la réservation. L’annulation ne donne pas lieu à un remboursement. Seul le temps supplémentaire est facturé au départ.',
    'muted policy'
  );

  form.appendChild(startLabel);
  form.appendChild(endLabel);
  form.appendChild(durationsFieldset);
  form.appendChild(vehicleLabel);
  form.appendChild(summaryPlace);
  form.appendChild(summaryQuote);
  form.appendChild(quoteNotice);
  form.appendChild(actionsDiv);
  form.appendChild(policyP);

  formSection.appendChild(bookingTitle);
  formSection.appendChild(form);

  container.appendChild(mapSection);
  container.appendChild(formSection);

  // Helpers de validation
  function getBookingDates() {
    const start = new Date(startInput.value);
    const end = new Date(endInput.value);
    const now = new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    if (start <= now || end <= start) return null;
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function getBookingPayload() {
    const dates = getBookingDates();
    if (!dates) {
      throw new Error('Veuillez choisir une date de début dans le futur et une date de fin postérieure au début.');
    }
    if (!selectedPlaceId) {
      throw new Error('Veuillez sélectionner une place disponible sur le plan.');
    }
    const typeVehicule = (vehicleInput.value || 'VOITURE').trim().toUpperCase();
    return {
      placeId: selectedPlaceId,
      typeVehicule,
      debutPrevu: dates.start,
      finPrevue: dates.end
    };
  }

  function updateButtons() {
    const dates = getBookingDates();
    const hasPlace = !!selectedPlaceId;
    const isAvail = availability.get(selectedPlaceId) !== false;
    estimateBtn.disabled = !dates || !hasPlace || !isAvail;
    bookBtn.disabled = estimateBtn.disabled || !quotedBookingFingerprint;
  }

  function clearQuote() {
    quoteRevision++;
    quotedBookingFingerprint = null;
    quoteAmountText.textContent = '—';
    quoteNotice.textContent = '';
    updateButtons();
  }

  function updateTiles() {
    const tiles = lotGrid.children;
    places.forEach((place, index) => {
      const tile = tiles[index];
      if (!tile) return;
      const isClosed = place.statut === 'HORS_SERVICE';
      const avail = availability.get(place.id);
      const isSelected = place.id === selectedPlaceId;

      let state = 'unchecked';
      let stateLabel = 'À vérifier';

      if (isClosed) {
        state = 'unavailable';
        stateLabel = 'Hors service';
      } else if (avail === false) {
        state = 'unavailable';
        stateLabel = 'Indisponible';
      } else if (isSelected) {
        state = 'selected';
        stateLabel = 'Sélectionnée';
      } else if (avail === true) {
        state = 'available';
        stateLabel = 'Disponible';
      }

      tile.dataset.state = state;
      const stateSpan = tile.querySelector('.bay-state');
      if (stateSpan) stateSpan.textContent = stateLabel;
      tile.disabled = isClosed || avail === false;
      tile.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function selectPlace(place) {
    if (!place || place.statut === 'HORS_SERVICE' || availability.get(place.id) === false) {
      selectedPlaceId = '';
      selectedPlaceText.textContent = '—';
    } else {
      selectedPlaceId = place.id;
      selectedPlaceText.textContent = place.numero;
    }
    clearQuote();
    updateTiles();
  }

  function renderMap() {
    lotGrid.replaceChildren();
    for (const place of places) {
      const bay = createDomNode('button', '', 'bay', {
        type: 'button',
        'aria-label': `Place ${place.numero}`
      });
      bay.appendChild(createDomNode('strong', place.numero));
      bay.appendChild(createDomNode('span', 'À vérifier', 'bay-state'));
      bay.addEventListener('click', () => selectPlace(place));
      lotGrid.appendChild(bay);
    }
    updateTiles();
  }

  function scheduleAvailability() {
    clearTimeout(availabilityTimer);
    const revision = ++mapRevision;
    const session = sessionRevision();
    const dates = getBookingDates();

    availability = new Map();
    clearQuote();
    updateTiles();

    if (!places.length) {
      placesStatusEl.textContent = 'Aucune place à afficher.';
      return;
    }
    if (!dates) {
      placesStatusEl.textContent = 'Choisissez un créneau futur pour vérifier les places.';
      return;
    }

    placesStatusEl.textContent = 'Vérification des disponibilités pour ce créneau…';

    availabilityTimer = setTimeout(async () => {
      const candidates = places.filter(p => p.statut !== 'HORS_SERVICE');
      for (let offset = 0; offset < candidates.length && revision === mapRevision && isCurrentSession(session); offset += 6) {
        const batch = candidates.slice(offset, offset + 6);
        await Promise.all(batch.map(async place => {
          try {
            const query = new URLSearchParams({ placeId: place.id, ...dates });
            const res = await api('/api/reservations/availability?' + query);
            if (revision === mapRevision && isCurrentSession(session) && typeof res.available === 'boolean') {
              availability.set(place.id, res.available);
            }
          } catch {
            // Ignoré individuellement
          }
        }));

        if (revision !== mapRevision || !isCurrentSession(session)) return;
        updateTiles();
        updateButtons();
      }

      if (revision !== mapRevision || !isCurrentSession(session)) return;
      const openCount = [...availability.values()].filter(Boolean).length;
      placesStatusEl.textContent = availability.size === candidates.length
        ? `${openCount} place${openCount === 1 ? '' : 's'} disponible${openCount === 1 ? '' : 's'} pour ce créneau.`
        : 'Disponibilité partielle. Les places non vérifiées seront validées au devis.';
    }, 200);
  }

  async function loadPlaces() {
    const revision = sessionRevision();
    placesStatusEl.textContent = 'Chargement des places…';
    try {
      const list = await api('/api/places');
      assertCurrentSession(revision);
      if (!Array.isArray(list)) throw new Error('Format de places invalide.');
      places = list.map(p => ({ ...p, id: String(p.id) }));
      renderMap();
      scheduleAvailability();
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      placesStatusEl.textContent = 'Impossible de charger les places. Réessayez plus tard.';
      showErrorToast(error.message);
    }
  }

  // Événements du formulaire
  startInput.addEventListener('input', () => scheduleAvailability());
  endInput.addEventListener('input', () => scheduleAvailability());
  vehicleInput.addEventListener('input', () => clearQuote());

  refreshPlacesBtn.addEventListener('click', () => {
    executeButtonAction(refreshPlacesBtn, () => loadPlaces());
  });

  estimateBtn.addEventListener('click', () => {
    executeButtonAction(estimateBtn, async checkSession => {
      clearQuote();
      const currentRev = quoteRevision;
      const payload = getBookingPayload();

      // Vérification disponibilité
      const checkQuery = new URLSearchParams({
        placeId: payload.placeId,
        start: payload.debutPrevu,
        end: payload.finPrevue
      });
      const avail = await api('/api/reservations/availability?' + checkQuery);
      checkSession();
      if (currentRev !== quoteRevision) return;

      if (!avail.available) {
        throw new Error('Cette place est indisponible sur ce créneau.');
      }

      const quote = await api('/api/reservations/quote', {
        method: 'POST',
        body: payload
      });
      checkSession();
      if (currentRev !== quoteRevision) return;

      quotedBookingFingerprint = JSON.stringify(payload);
      quoteAmountText.textContent = formatMoney(quote.amount, quote.currency);
      quoteNotice.textContent = 'Tarif calculé. La place et le prix seront verrouillés lors de la confirmation.';
      updateButtons();
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    executeButtonAction(bookBtn, async checkSession => {
      const payload = getBookingPayload();
      const fingerprint = JSON.stringify(payload);

      if (quotedBookingFingerprint !== fingerprint) {
        throw new Error('Veuillez obtenir un devis actualisé pour cette sélection avant de confirmer.');
      }

      if (!bookingAttempt || bookingAttempt.fingerprint !== fingerprint) {
        bookingAttempt = { fingerprint, key: crypto.randomUUID() };
      }

      const reservation = await api('/api/reservations', {
        method: 'POST',
        body: payload,
        headers: { 'Idempotency-Key': bookingAttempt.key }
      });

      checkSession();
      bookingAttempt = null;
      clearQuote();

      showToast(`Réservation n°${reservation.id} confirmée avec succès. Paiement simulé enregistré.`, 'success');
      navigate(ROUTES.HISTORY);
    });
  });

  // Premier chargement
  loadPlaces();

  return container;
}
