import { api, renewCsrf, resetSession } from './api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession, StaleSessionError } from './session.js';
const $ = id => document.getElementById(id);
let user, mode, bookingAttempt;
let places = [], agentReservations = [], availability = new Map(), mapRevision = 0;
let placeRequest = 0, quoteRevision = 0, quotedBooking, availabilityTimer;
const pages = { driver: 0, agent: 0 };
const activeActions = new WeakMap();
const statusNames = { CONFIRMED: 'Confirmée', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', CANCELLED: 'Annulée', EXPIRED: 'Expirée' };
const date = value => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
function money(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  if (!currency) return `${amount} (devise à vérifier)`;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}
function notice(message = '', error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message; }
function signedOut() {
  resetSession(); user = null; bookingAttempt = null; pages.driver = 0; pages.agent = 0;
  $('workspace').hidden = true; $('identity').hidden = true; $('login-panel').hidden = false;
  $('driver-list').replaceChildren(); $('agent-list').replaceChildren(); $('display-name').textContent = '';
  $('booking-form').reset(); $('quote').textContent = ''; $('login-form').elements.password.value = '';
  places = []; agentReservations = []; availability.clear(); ++mapRevision; ++placeRequest;
  clearTimeout(availabilityTimer);
  $('driver-map').replaceChildren(); $('agent-map').replaceChildren();
  $('selected-place').textContent = '—'; $('quote-amount').textContent = '—'; quotedBooking = undefined;
  $('places-status').textContent = '';
  for (const button of document.querySelectorAll('button')) { activeActions.delete(button); button.disabled = false; }
  updateBookingButtons();
}
async function action(button, task) {
  const revision = sessionRevision(), operation = Symbol(); activeActions.set(button, operation);
  button.disabled = true; notice();
  if (button.id === 'estimate' || button.id === 'book') updateBookingButtons();
  try { await task(() => assertCurrentSession(revision)); }
  catch (error) {
    if (error instanceof StaleSessionError || !isCurrentSession(revision)) return;
    if (error.status === 401 && error.code !== 'INVALID_CREDENTIALS') signedOut(); notice(error.message, true);
  }
  finally {
    if (activeActions.get(button) === operation) {
      activeActions.delete(button);
      button.disabled = false;
      if (button.id === 'estimate' || button.id === 'book') updateBookingButtons();
    }
  }
}
function node(tag, text, className) { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }
function localDate(value) { const offset = value.getTimezoneOffset() * 60_000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); }
function bookingDates() {
  const { debutPrevu, finPrevue } = $('booking-form').elements;
  const start = new Date(debutPrevu.value), end = new Date(finPrevue.value);
  return start > new Date() && end > start ? { start: start.toISOString(), end: end.toISOString() } : null;
}
function bookingBody() {
  const form = $('booking-form');
  if (!form.reportValidity()) throw new Error('Complétez les champs du formulaire.');
  const values = new FormData(form);
  const placeId = values.get('placeId');
  if (!places.some(place => place.id === placeId && place.statut !== 'HORS_SERVICE')) throw new Error('Choisissez une place sur le plan.');
  const dates = bookingDates();
  if (!dates) throw new Error('Choisissez un début futur et une fin après le début.');
  return { placeId, typeVehicule: values.get('typeVehicule').toUpperCase(), debutPrevu: dates.start, finPrevue: dates.end };
}
function updateBookingButtons() {
  $('estimate').disabled = !bookingDates() || !$('place-select').value || availability.get($('place-select').value) === false || activeActions.has($('estimate')) || activeActions.has($('book'));
  $('book').disabled = $('estimate').disabled || !quotedBooking;
}
function clearQuote() {
  ++quoteRevision;
  quotedBooking = undefined;
  $('quote-amount').textContent = '—';
  $('quote').textContent = '';
  updateBookingButtons();
}
async function enter(current) {
  user = current; $('display-name').textContent = current.displayName;
  $('identity').hidden = false; $('login-panel').hidden = true; $('workspace').hidden = false;
  $('driver-tab').hidden = !user.roles.includes('CONDUCTEUR'); $('agent-tab').hidden = !user.roles.includes('AGENT');
  $('history-tab').hidden = $('driver-tab').hidden;
  const now = new Date(), tomorrow = new Date(now.getTime() + 86_400_000);
  const start = new Date(Math.ceil((now.getTime() + 60_000) / 900_000) * 900_000);
  $('booking-form').elements.debutPrevu.value = localDate(start);
  $('booking-form').elements.finPrevue.value = localDate(new Date(start.getTime() + 7_200_000));
  $('operations-form').elements.start.value = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  $('operations-form').elements.end.value = localDate(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()));
  if (user.roles.includes('CONDUCTEUR')) await show('driver');
  else if (user.roles.includes('AGENT')) await show('agent');
  else {
    for (const panel of ['driver', 'history', 'agent']) $(panel + '-panel').hidden = true;
    $('page-title').textContent = 'Votre espace';
    notice('Ce compte ne possède pas de rôle conducteur ou agent.');
  }
}
async function show(selected) {
  mode = selected;
  for (const view of ['driver', 'history', 'agent']) {
    $(view + '-panel').hidden = view !== mode;
    const tab = $(view + '-tab');
    tab.classList.toggle('active', view === mode);
    if (view === mode) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  }
  $('page-title').textContent = ({ driver: 'Réserver une place', history: 'Mes réservations', agent: 'Arrivées et départs' })[mode];
  if (selected === 'driver') await loadPlaces();
  else if (selected === 'history') await load('driver');
  else await Promise.all([load('agent'), loadPlaces()]);
}
async function loadPlaces() {
  const revision = sessionRevision(), request = ++placeRequest;
  const status = $(mode === 'agent' ? 'agent-places-status' : 'places-status');
  status.textContent = 'Chargement des places…';
  try {
    const result = await api('/api/places');
    assertCurrentSession(revision);
    if (request !== placeRequest) return;
    if (!Array.isArray(result) || result.some(place => !/^[1-9][0-9]*$/.test(place.id || '') || BigInt(place.id) > 9223372036854775807n || typeof place.numero !== 'string' || !['LIBRE', 'OCCUPEE', 'RESERVEE', 'HORS_SERVICE'].includes(place.statut))) throw new Error('La liste des places reçue est invalide.');
    places = result.map(place => ({ ...place, id: String(place.id) }));
    if (!places.some(place => place.id === $('place-select').value && place.statut !== 'HORS_SERVICE')) selectPlace(null);
    if (mode === 'driver') scheduleAvailability();
    renderAgentMap();
  } catch (error) {
    if (error instanceof StaleSessionError || !isCurrentSession(revision)) throw error;
    if (request !== placeRequest) return;
    places = []; availability.clear(); ++mapRevision;
    selectPlace(null);
    $('driver-map').replaceChildren();
    $('agent-map').replaceChildren();
    status.textContent = 'Impossible de charger les places. Actualisez pour réessayer.';
    if (error.status === 401) throw error;
  }
}
function selectPlace(place) {
  $('place-select').value = place?.id ?? '';
  $('selected-place').textContent = place?.numero ?? '—';
  clearQuote();
  updateDriverTiles();
}
function tile(place, click) {
  const item = node(click ? 'button' : 'div', '', 'bay');
  item.append(node('strong', place.numero), node('span', '', 'bay-state'));
  if (click) { item.type = 'button'; item.addEventListener('click', click); }
  return item;
}
function updateDriverTiles() {
  const tiles = $('driver-map').children;
  places.forEach((place, index) => {
    const item = tiles[index];
    if (!item) return;
    const available = availability.get(place.id);
    const closed = place.statut === 'HORS_SERVICE', selected = $('place-select').value === place.id;
    item.dataset.state = closed || available === false ? 'unavailable' : selected ? 'selected' : available === true ? 'available' : 'unchecked';
    item.querySelector('.bay-state').textContent = closed ? 'Hors service' : available === false ? 'Indisponible' : available === true ? 'Disponible' : 'À vérifier';
    item.disabled = closed || available === false;
    item.setAttribute('aria-pressed', String(selected));
  });
}
function renderDriverMap() {
  $('driver-map').replaceChildren(...places.map(place => tile(place, () => selectPlace(place))));
  updateDriverTiles();
}
function scheduleAvailability() {
  clearTimeout(availabilityTimer);
  const revision = ++mapRevision, session = sessionRevision(), dates = bookingDates();
  availability = new Map();
  clearQuote();
  renderDriverMap();
  const status = $('places-status');
  if (!places.length) { status.textContent = 'Aucune place à afficher.'; return; }
  if (!dates) { status.textContent = 'Choisissez un créneau futur pour vérifier les places.'; return; }
  status.textContent = 'Vérification des places pour ce créneau…';
  availabilityTimer = setTimeout(async () => {
    const candidates = places.filter(place => place.statut !== 'HORS_SERVICE');
    for (let offset = 0; offset < candidates.length && revision === mapRevision && isCurrentSession(session); offset += 6) {
      await Promise.all(candidates.slice(offset, offset + 6).map(async place => {
        try {
          const query = new URLSearchParams({ placeId: place.id, ...dates });
          const result = await api('/api/reservations/availability?' + query);
          if (revision === mapRevision && isCurrentSession(session) && typeof result.available === 'boolean') availability.set(place.id, result.available);
        } catch (error) {
          if (error.status === 401 && isCurrentSession(session)) signedOut();
        }
      }));
      if (revision !== mapRevision || !isCurrentSession(session)) return;
      updateDriverTiles();
      updateBookingButtons();
    }
    if (revision !== mapRevision || !isCurrentSession(session)) return;
    const open = [...availability.values()].filter(Boolean).length;
    status.textContent = availability.size === candidates.length
      ? `${open} place${open === 1 ? '' : 's'} disponible${open === 1 ? '' : 's'} pour ce créneau.`
      : 'Disponibilité partielle. Les places à vérifier seront contrôlées au devis.';
  }, 200);
}
function renderAgentMap() {
  const now = Date.now();
  const occupied = places.filter(place => place.statut === 'OCCUPEE').length;
  $('agent-places-status').textContent = places.length ? `${occupied} occupée(s) · ${places.length} place(s) au total` : 'Aucune place à afficher.';
  $('agent-map').replaceChildren(...places.map(place => {
    const matches = agentReservations.filter(reservation => String(reservation.placeId) === place.id);
    const active = matches.find(reservation => reservation.statut === 'IN_PROGRESS');
    const waiting = matches.find(reservation => reservation.statut === 'CONFIRMED' && new Date(reservation.finPrevue).getTime() > now);
    const target = active || waiting;
    const item = tile(place, target ? () => {
      const card = document.getElementById('operation-' + target.id);
      card?.scrollIntoView({ block: 'nearest' });
      card?.focus({ preventScroll: true });
    } : null);
    const state = place.statut === 'HORS_SERVICE' ? ['unavailable', 'Hors service']
      : place.statut === 'OCCUPEE' ? ['occupied', 'Occupée']
      : active ? ['awaiting', 'Arrivée enregistrée']
      : waiting ? ['awaiting', 'Arrivée attendue']
      : place.statut === 'RESERVEE' ? ['awaiting', 'Réservée'] : ['unchecked', 'Libre'];
    item.dataset.state = state[0];
    item.querySelector('.bay-state').textContent = state[1];
    return item;
  }));
}
async function load(role) {
  const revision = sessionRevision();
  let path = '/api/reservations/me?';
  const parameters = new URLSearchParams({ page: pages[role], size: 20 });
  if (role === 'agent') {
    const form = $('operations-form');
    if (!form.reportValidity()) return;
    const start = new Date(form.elements.start.value), end = new Date(form.elements.end.value);
    if (!(end > start)) throw new Error('La fin doit être après le début.');
    parameters.set('start', start.toISOString()); parameters.set('end', end.toISOString()); path = '/api/reservations/operations?';
  }
  const result = await api(path + parameters);
  assertCurrentSession(revision);
  const list = $(role + '-list'); list.replaceChildren();
  if (!result.items.length) list.append(node('p', 'Aucune réservation pour cette consultation.', 'muted'));
  if (role === 'driver') {
    const active = item => ['CONFIRMED', 'IN_PROGRESS'].includes(item.statut);
    for (const [title, items] of [
      ['À venir et en cours', result.items.filter(active)],
      ['Passées et annulées', result.items.filter(item => !active(item))]
    ]) {
      if (!items.length) continue;
      list.append(node('h2', title, 'group-title'), ...items.map(item => reservationCard(item, role)));
    }
  } else {
    agentReservations = result.items;
    for (const item of result.items) list.append(reservationCard(item, role));
    renderAgentMap();
  }
  $(role + '-page').textContent = `Page ${result.page + 1} · ${result.total} réservation(s)`;
  $('previous-' + role).disabled = result.page === 0;
  $('next-' + role).disabled = (result.page + 1) * result.size >= result.total;
}
function reservationCard(reservation, role) {
  const card = node('article', '', 'reservation');
  if (role === 'agent') { card.id = 'operation-' + reservation.id; card.tabIndex = -1; }
  const placeNumber = places.find(place => place.id === String(reservation.placeId))?.numero ?? reservation.placeId;
  const heading = node('div', '', 'row'); heading.append(node('h3', `Place ${placeNumber} · Réservation ${reservation.id}`), node('span', statusNames[reservation.statut] || reservation.statut, 'badge ' + reservation.statut.toLowerCase())); card.append(heading);
  card.append(node('p', `${date(reservation.debutPrevu)} → ${date(reservation.finPrevue)}`));
  card.append(node('p', `Estimation : ${money(reservation.montantEstime, reservation.currency)}${reservation.montantFinal !== null ? ' · Final : ' + money(reservation.montantFinal, reservation.currency) : ''}`, 'muted'));
  if (role === 'agent') card.append(node('p', `Conducteur ${reservation.conducteurId} · Arrivée : ${date(reservation.arriveeReelle)} · Départ : ${date(reservation.departReel)}`, 'muted'));
  if (reservation.paymentStatus === 'PAID') card.append(node('p', 'Paiement simulé enregistré · ' + reservation.paymentReference, 'muted'));
  if (reservation.bookingPaid != null) {
    const balance = reservation.statut === 'CANCELLED' ? 'Paiement conservé, sans remboursement' : reservation.extraPaid == null ? 'Complément à calculer au départ' : 'Complément payé : ' + money(reservation.extraPaid, reservation.currency);
    card.append(node('p', `Créneau payé : ${money(reservation.bookingPaid, reservation.currency)} · ${balance}`, 'muted'));
  }
  if (reservation.extraPaymentReference) card.append(node('p', 'Paiement complémentaire simulé : ' + reservation.extraPaymentReference, 'muted'));
  if (reservation.placesSyncPending) card.append(node('p', 'Mise à jour de la place en attente. Actualisez pour vérifier la synchronisation.', 'sync'));
  let operation, label;
  if (role === 'driver' && reservation.statut === 'CONFIRMED' && new Date(reservation.debutPrevu) > new Date()) { operation = 'cancel'; label = 'Annuler la réservation'; }
  if (role === 'agent' && reservation.statut === 'CONFIRMED') { operation = 'arrival'; label = 'Enregistrer l’arrivée'; }
  if (role === 'agent' && reservation.statut === 'IN_PROGRESS') { operation = 'departure'; label = 'Enregistrer le départ'; }
  if (operation) {
    const button = node('button', label, 'secondary');
    button.addEventListener('click', () => {
      if (operation === 'cancel' && !window.confirm('Annuler cette réservation ? Le paiement reste acquis, sans remboursement.')) return;
      if (operation === 'departure' && !window.confirm('Confirmer le départ réel et le paiement simulé ?')) return;
      action(button, async check => {
        await api(`/api/reservations/${encodeURIComponent(reservation.id)}/${operation}`, { method: 'POST' });
        check();
        if (role === 'agent') await loadPlaces();
        check();
        await load(role);
        check();
        notice('Opération enregistrée.');
      });
    }); card.append(button);
  }
  return card;
}
$('login-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  resetSession(); const revision = sessionRevision();
  action(form.querySelector('button'), async check => {
    try { const current = await api('/api/auth/login', { method: 'POST', body: new URLSearchParams(new FormData(form)) }); check(); await renewCsrf(); check(); await enter(current); }
    finally { if (isCurrentSession(revision)) form.elements.password.value = ''; }
  });
});
$('logout').addEventListener('click', event => action(event.currentTarget, async check => { await api('/api/auth/logout', { method: 'POST' }); check(); signedOut(); await renewCsrf(); }));
$('estimate').addEventListener('click', event => action(event.currentTarget, async check => {
  clearQuote();
  const revision = quoteRevision;
  const body = bookingBody(); const query = new URLSearchParams({ placeId: body.placeId, start: body.debutPrevu, end: body.finPrevue });
  const availability = await api('/api/reservations/availability?' + query);
  check();
  if (revision !== quoteRevision) return;
  if (!availability.available) throw new Error('Cette place est indisponible sur ce créneau.');
  const quote = await api('/api/reservations/quote', { method: 'POST', body });
  check();
  if (revision !== quoteRevision) return;
  quotedBooking = JSON.stringify(body);
  $('quote-amount').textContent = money(quote.amount, quote.currency);
  $('quote').textContent = 'Le tarif et la disponibilité sont revérifiés à la réservation.';
}));
$('booking-form').addEventListener('input', event => {
  if (['debutPrevu', 'finPrevue'].includes(event.target.name)) scheduleAvailability();
  else clearQuote();
});
for (const button of document.querySelectorAll('[data-hours]')) {
  button.addEventListener('click', () => {
    const { debutPrevu, finPrevue } = $('booking-form').elements;
    const start = new Date(debutPrevu.value);
    if (!Number.isFinite(start.getTime())) { debutPrevu.focus(); return; }
    finPrevue.value = localDate(new Date(start.getTime() + Number(button.dataset.hours) * 3_600_000));
    scheduleAvailability();
  });
}
$('booking-form').addEventListener('submit', event => {
  event.preventDefault(); action($('book'), async check => {
    const body = bookingBody(), fingerprint = JSON.stringify(body);
    if (quotedBooking !== fingerprint) throw new Error('Obtenez un devis pour cette place et ce créneau.');
    if (!bookingAttempt || bookingAttempt.fingerprint !== fingerprint) bookingAttempt = { fingerprint, key: crypto.randomUUID() };
    const reservation = await api('/api/reservations', { method: 'POST', body, headers: { 'Idempotency-Key': bookingAttempt.key } });
    check(); bookingAttempt = null; clearQuote(); pages.driver = 0;
    if (mode === 'driver') await show('history'); else if (mode === 'history') await load('driver');
    check(); notice(`Réservation ${reservation.id} confirmée. Paiement du créneau simulé, sans remboursement.`);
  });
});
for (const view of ['driver', 'history', 'agent']) $(view + '-tab').addEventListener('click', event => action(event.currentTarget, () => show(view)));
for (const role of ['driver', 'agent']) {
  for (const direction of ['previous', 'next']) $(direction + '-' + role).addEventListener('click', async () => {
    const revision = sessionRevision();
    notice(); pages[role] += direction === 'next' ? 1 : -1;
    try { await load(role); } catch (error) { if (error instanceof StaleSessionError || !isCurrentSession(revision)) return; pages[role] += direction === 'next' ? -1 : 1; if (error.status === 401) signedOut(); notice(error.message, true); }
  });
}
$('refresh-driver').addEventListener('click', event => action(event.currentTarget, () => load('driver')));
$('refresh-places').addEventListener('click', event => action(event.currentTarget, () => loadPlaces()));
$('operations-form').addEventListener('submit', event => {
  event.preventDefault();
  pages.agent = 0;
  action(event.currentTarget.querySelector('button'), () => Promise.all([load('agent'), loadPlaces()]));
});
const bootstrapRevision = sessionRevision();
try { await renewCsrf(); assertCurrentSession(bootstrapRevision); const current = await api('/api/auth/me'); assertCurrentSession(bootstrapRevision); await enter(current); }
catch (error) { if (!(error instanceof StaleSessionError) && isCurrentSession(bootstrapRevision)) { signedOut(); if (error.status !== 401) notice(error.message, true); } }
