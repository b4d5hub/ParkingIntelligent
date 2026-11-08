import { api, renewCsrf, resetSession } from './api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession, StaleSessionError } from './session.js';
const $ = id => document.getElementById(id);
let user, mode, bookingAttempt;
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
  $('place-select').replaceChildren(node('option', 'Connectez-vous pour choisir une place.'));
  $('place-select').firstChild.value = ''; $('place-select').disabled = true;
  $('places-status').textContent = '';
  for (const button of document.querySelectorAll('button')) { activeActions.delete(button); button.disabled = false; }
}
async function action(button, task) {
  const revision = sessionRevision(), operation = Symbol(); activeActions.set(button, operation);
  button.disabled = true; notice();
  try { await task(() => assertCurrentSession(revision)); }
  catch (error) {
    if (error instanceof StaleSessionError || !isCurrentSession(revision)) return;
    if (error.status === 401 && error.code !== 'INVALID_CREDENTIALS') signedOut(); notice(error.message, true);
  }
  finally { if (activeActions.get(button) === operation) { activeActions.delete(button); button.disabled = false; } }
}
function node(tag, text, className) { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }
function localDate(value) { const offset = value.getTimezoneOffset() * 60_000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); }
function bookingBody() {
  const form = $('booking-form');
  if (!form.reportValidity()) throw new Error('Complétez les champs du formulaire.');
  const values = new FormData(form);
  const placeId = values.get('placeId');
  if ($('place-select').disabled || !/^[1-9][0-9]*$/.test(placeId || '') || BigInt(placeId) > 9223372036854775807n) throw new Error('Choisissez une place dans la liste.');
  const start = new Date(values.get('debutPrevu')), end = new Date(values.get('finPrevue'));
  if (!(start > new Date()) || !(end > start)) throw new Error('Choisissez un début futur et une fin après le début.');
  return { placeId, typeVehicule: values.get('typeVehicule').toUpperCase(), debutPrevu: start.toISOString(), finPrevue: end.toISOString() };
}
async function enter(current) {
  user = current; $('display-name').textContent = current.displayName;
  $('identity').hidden = false; $('login-panel').hidden = true; $('workspace').hidden = false;
  $('driver-tab').hidden = !user.roles.includes('CONDUCTEUR'); $('agent-tab').hidden = !user.roles.includes('AGENT');
  const now = new Date(), tomorrow = new Date(now.getTime() + 86_400_000);
  $('operations-form').elements.start.value = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  $('operations-form').elements.end.value = localDate(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()));
  if (user.roles.includes('CONDUCTEUR')) await show('driver');
  else if (user.roles.includes('AGENT')) await show('agent');
  else { $('driver-panel').hidden = true; $('agent-panel').hidden = true; notice('Ce compte ne possède pas de rôle conducteur ou agent.'); }
}
async function show(selected) {
  mode = selected;
  for (const role of ['driver', 'agent']) { $(role + '-panel').hidden = role !== mode; $(role + '-tab').classList.toggle('active', role === mode); }
  $('page-title').textContent = mode === 'driver' ? 'Mes réservations' : 'Opérations du parking';
  await Promise.all(selected === 'driver' ? [load(selected), loadPlaces()] : [load(selected)]);
}
async function loadPlaces() {
  const revision = sessionRevision(), select = $('place-select'), previous = select.value;
  select.disabled = true; $('places-status').textContent = 'Chargement des places…';
  try {
    const places = await api('/api/places');
    assertCurrentSession(revision);
    if (!Array.isArray(places) || places.some(place => !/^[1-9][0-9]*$/.test(place.id || '') || BigInt(place.id) > 9223372036854775807n || typeof place.numero !== 'string' || !['LIBRE', 'OCCUPEE', 'RESERVEE', 'HORS_SERVICE'].includes(place.statut))) throw new Error('La liste des places reçue est invalide.');
    const choices = places.filter(place => place.statut !== 'HORS_SERVICE');
    const placeholder = node('option', choices.length ? 'Choisissez une place' : 'Aucune place en service'); placeholder.value = '';
    select.replaceChildren(placeholder);
    for (const place of choices) {
      const option = node('option', `Place ${place.numero}${place.statut === 'OCCUPEE' ? ' · occupée actuellement' : ''}`);
      option.value = place.id; select.append(option);
    }
    if (choices.some(place => place.id === previous)) select.value = previous;
    select.disabled = !choices.length;
    $('quote').textContent = '';
    $('places-status').textContent = choices.length ? 'Une place occupée maintenant peut être réservée pour plus tard. Vérifiez votre créneau.' : 'Aucune place en service. Vous pouvez actualiser la liste.';
  } catch (error) {
    if (error instanceof StaleSessionError || !isCurrentSession(revision)) throw error;
    const placeholder = node('option', 'Places indisponibles'); placeholder.value = ''; select.replaceChildren(placeholder);
    $('places-status').textContent = 'Impossible de charger les places. Vos réservations restent consultables ; réessayez avec « Actualiser les places ».';
    if (error.status === 401) throw error;
  }
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
  for (const reservation of result.items) list.append(reservationCard(reservation, role));
  $(role + '-page').textContent = `Page ${result.page + 1} · ${result.total} réservation(s)`;
  $('previous-' + role).disabled = result.page === 0;
  $('next-' + role).disabled = (result.page + 1) * result.size >= result.total;
}
function reservationCard(reservation, role) {
  const card = node('article', '', 'reservation');
  const heading = node('div', '', 'row'); heading.append(node('h3', `Place ${reservation.placeId} · Réservation ${reservation.id}`), node('span', statusNames[reservation.statut] || reservation.statut, 'badge ' + reservation.statut.toLowerCase())); card.append(heading);
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
      action(button, async check => { await api(`/api/reservations/${encodeURIComponent(reservation.id)}/${operation}`, { method: 'POST' }); check(); await load(role); check(); notice('Opération enregistrée.'); });
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
  const body = bookingBody(); const query = new URLSearchParams({ placeId: body.placeId, start: body.debutPrevu, end: body.finPrevue });
  const availability = await api('/api/reservations/availability?' + query);
  check();
  if (!availability.available) throw new Error('Cette place est indisponible sur ce créneau.');
  const quote = await api('/api/reservations/quote', { method: 'POST', body });
  check();
  $('quote').textContent = `Estimation : ${money(quote.amount, quote.currency)}. Disponibilité à confirmer lors de la réservation.`;
}));
$('booking-form').addEventListener('input', () => { $('quote').textContent = 'Les paramètres ont changé. Vérifiez votre estimation.'; });
$('booking-form').addEventListener('submit', event => {
  event.preventDefault(); action(event.currentTarget.querySelector('[type=submit]'), async check => {
    const body = bookingBody(), fingerprint = JSON.stringify(body);
    if (!bookingAttempt || bookingAttempt.fingerprint !== fingerprint) bookingAttempt = { fingerprint, key: crypto.randomUUID() };
    const reservation = await api('/api/reservations', { method: 'POST', body, headers: { 'Idempotency-Key': bookingAttempt.key } });
    check(); bookingAttempt = null; pages.driver = 0; await load('driver'); check(); notice(`Réservation ${reservation.id} confirmée. Paiement du créneau simulé, sans remboursement.`);
  });
});
for (const role of ['driver', 'agent']) {
  $(role + '-tab').addEventListener('click', event => action(event.currentTarget, () => show(role)));
  for (const direction of ['previous', 'next']) $(direction + '-' + role).addEventListener('click', async () => {
    const revision = sessionRevision();
    notice(); pages[role] += direction === 'next' ? 1 : -1;
    try { await load(role); } catch (error) { if (error instanceof StaleSessionError || !isCurrentSession(revision)) return; pages[role] += direction === 'next' ? -1 : 1; if (error.status === 401) signedOut(); notice(error.message, true); }
  });
}
$('refresh-driver').addEventListener('click', event => action(event.currentTarget, () => load('driver')));
$('refresh-places').addEventListener('click', event => action(event.currentTarget, () => loadPlaces()));
$('operations-form').addEventListener('submit', event => { event.preventDefault(); pages.agent = 0; action(event.currentTarget.querySelector('button'), () => load('agent')); });
const bootstrapRevision = sessionRevision();
try { await renewCsrf(); assertCurrentSession(bootstrapRevision); const current = await api('/api/auth/me'); assertCurrentSession(bootstrapRevision); await enter(current); }
catch (error) { if (!(error instanceof StaleSessionError) && isCurrentSession(bootstrapRevision)) { signedOut(); if (error.status !== 401) notice(error.message, true); } }
