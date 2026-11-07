import { api, renewCsrf } from './api.js';
const $ = id => document.getElementById(id);
let user, mode, bookingAttempt;
const pages = { driver: 0, agent: 0 };
const statusNames = { CONFIRMED: 'Confirmée', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', CANCELLED: 'Annulée', EXPIRED: 'Expirée' };
const date = value => value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
function money(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  if (!currency) return `${amount} (devise à vérifier)`;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}
function notice(message = '', error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = !message; }
function signedOut() { user = null; bookingAttempt = null; $('workspace').hidden = true; $('identity').hidden = true; $('login-panel').hidden = false; $('driver-list').replaceChildren(); $('agent-list').replaceChildren(); }
async function action(button, task) {
  button.disabled = true; notice();
  try { await task(); }
  catch (error) { if (error.status === 401 && error.code !== 'INVALID_CREDENTIALS') signedOut(); notice(error.message, true); }
  finally { button.disabled = false; }
}
function node(tag, text, className) { const item = document.createElement(tag); item.textContent = text; if (className) item.className = className; return item; }
function localDate(value) { const offset = value.getTimezoneOffset() * 60_000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); }
function bookingBody() {
  const form = $('booking-form');
  if (!form.reportValidity()) throw new Error('Complétez les champs du formulaire.');
  const values = new FormData(form);
  const placeId = values.get('placeId');
  if (BigInt(placeId) > 9223372036854775807n) throw new Error('Identifiant de place invalide.');
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
  await load(mode);
}
async function load(role) {
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
  if (reservation.placesSyncPending) card.append(node('p', 'Mise à jour de la place en attente. Actualisez pour vérifier la synchronisation.', 'sync'));
  let operation, label;
  if (role === 'driver' && reservation.statut === 'CONFIRMED' && new Date(reservation.debutPrevu) > new Date()) { operation = 'cancel'; label = 'Annuler la réservation'; }
  if (role === 'agent' && reservation.statut === 'CONFIRMED') { operation = 'arrival'; label = 'Enregistrer l’arrivée'; }
  if (role === 'agent' && reservation.statut === 'IN_PROGRESS') { operation = 'departure'; label = 'Enregistrer le départ'; }
  if (operation) {
    const button = node('button', label, 'secondary');
    button.addEventListener('click', () => {
      if (operation === 'cancel' && !window.confirm('Annuler cette réservation ?')) return;
      if (operation === 'departure' && !window.confirm('Confirmer le départ réel et le paiement simulé ?')) return;
      action(button, async () => { await api(`/api/reservations/${encodeURIComponent(reservation.id)}/${operation}`, { method: 'POST' }); await load(role); notice('Opération enregistrée.'); });
    }); card.append(button);
  }
  return card;
}
$('login-form').addEventListener('submit', event => {
  event.preventDefault(); const form = event.currentTarget;
  action(form.querySelector('button'), async () => {
    try { const current = await api('/api/auth/login', { method: 'POST', body: new URLSearchParams(new FormData(form)) }); await renewCsrf(); await enter(current); }
    finally { form.elements.password.value = ''; }
  });
});
$('logout').addEventListener('click', event => action(event.currentTarget, async () => { await api('/api/auth/logout', { method: 'POST' }); signedOut(); await renewCsrf(); }));
$('estimate').addEventListener('click', event => action(event.currentTarget, async () => {
  const body = bookingBody(); const query = new URLSearchParams({ placeId: body.placeId, start: body.debutPrevu, end: body.finPrevue });
  const availability = await api('/api/reservations/availability?' + query);
  if (!availability.available) throw new Error('Cette place est indisponible sur ce créneau.');
  const quote = await api('/api/reservations/quote', { method: 'POST', body });
  $('quote').textContent = `Estimation : ${money(quote.amount, quote.currency)}. Disponibilité à confirmer lors de la réservation.`;
}));
$('booking-form').addEventListener('input', () => { $('quote').textContent = 'Les paramètres ont changé. Vérifiez votre estimation.'; });
$('booking-form').addEventListener('submit', event => {
  event.preventDefault(); action(event.currentTarget.querySelector('[type=submit]'), async () => {
    const body = bookingBody(), fingerprint = JSON.stringify(body);
    if (!bookingAttempt || bookingAttempt.fingerprint !== fingerprint) bookingAttempt = { fingerprint, key: crypto.randomUUID() };
    const reservation = await api('/api/reservations', { method: 'POST', body, headers: { 'Idempotency-Key': bookingAttempt.key } });
    bookingAttempt = null; pages.driver = 0; await load('driver'); notice(`Réservation ${reservation.id} confirmée. Aucun paiement prélevé.`);
  });
});
for (const role of ['driver', 'agent']) {
  $(role + '-tab').addEventListener('click', event => action(event.currentTarget, () => show(role)));
  for (const direction of ['previous', 'next']) $(direction + '-' + role).addEventListener('click', async () => {
    notice(); pages[role] += direction === 'next' ? 1 : -1;
    try { await load(role); } catch (error) { pages[role] += direction === 'next' ? -1 : 1; if (error.status === 401) signedOut(); notice(error.message, true); }
  });
}
$('refresh-driver').addEventListener('click', event => action(event.currentTarget, () => load('driver')));
$('operations-form').addEventListener('submit', event => { event.preventDefault(); pages.agent = 0; action(event.currentTarget.querySelector('button'), () => load('agent')); });
try { await renewCsrf(); await enter(await api('/api/auth/me')); }
catch (error) { signedOut(); if (error.status !== 401) notice(error.message, true); }
