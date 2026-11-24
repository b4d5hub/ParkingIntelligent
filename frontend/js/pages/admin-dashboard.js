// frontend/js/pages/admin-dashboard.js
// Tableau de bord administrateur avec métriques agrégées et barres de progression CSS pur.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../session.js';
import { createDomNode, formatMoney, formatDuration, ratioToPctClass, buildQueryString, validateDateRange } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createLoadingIndicator } from '../ui/loading.js';

export function renderAdminDashboardPage() {
  const container = createDomNode('section', '', 'dashboard', {
    'aria-label': 'Tableau de bord administrateur'
  });

  // En-tête
  const header = createDomNode('div', '', 'section-heading');
  const introDiv = createDomNode('div');
  introDiv.appendChild(createDomNode('h1', 'Tableau de bord'));
  introDiv.appendChild(createDomNode('p', 'Vue d’ensemble de l’activité du parking, des places et des revenus.', 'muted'));
  const refreshBtn = createDomNode('button', 'Actualiser les données', 'quiet', { type: 'button' });
  header.appendChild(introDiv);
  header.appendChild(refreshBtn);

  // Sélecteur de période pour les statistiques de réservation
  const periodCard = createDomNode('div', '', 'card admin-controls');
  const periodHeading = createDomNode('div', '', 'row');
  periodHeading.appendChild(createDomNode('strong', 'Période d’analyse des réservations :'));

  const periodSelect = createDomNode('select', '', '', { name: 'period' });
  periodSelect.appendChild(createDomNode('option', '30 derniers jours', '', { value: '30d' }));
  periodSelect.appendChild(createDomNode('option', '7 derniers jours', '', { value: '7d' }));
  periodSelect.appendChild(createDomNode('option', 'Aujourd’hui', '', { value: 'today' }));
  periodSelect.appendChild(createDomNode('option', 'Tout l’historique', '', { value: 'all' }));
  periodSelect.appendChild(createDomNode('option', 'Personnalisée…', '', { value: 'custom' }));
  periodHeading.appendChild(periodSelect);

  const customDatesDiv = createDomNode('div', '', 'row filters', { hidden: true });
  const customFromInput = createDomNode('input', '', '', { type: 'date', name: 'customFrom' });
  const customToInput = createDomNode('input', '', '', { type: 'date', name: 'customTo' });
  const customApplyBtn = createDomNode('button', 'Filtrer', 'secondary', { type: 'button' });

  const customFromLabel = createDomNode('label', 'Du ');
  customFromLabel.appendChild(customFromInput);
  const customToLabel = createDomNode('label', 'Au ');
  customToLabel.appendChild(customToInput);

  customDatesDiv.appendChild(customFromLabel);
  customDatesDiv.appendChild(customToLabel);
  customDatesDiv.appendChild(customApplyBtn);

  periodCard.appendChild(periodHeading);
  periodCard.appendChild(customDatesDiv);

  // Grille des cartes métriques
  const statsGrid = createDomNode('div', '', 'stats-grid');

  // Carte 1 : Places du parking
  const placesCard = createDomNode('article', '', 'stat-card', { 'aria-label': 'État des places' });
  const placesTitle = createDomNode('h2', 'Places du parking');
  const placesValue = createDomNode('div', '—', 'stat-value');
  const placesSubtitle = createDomNode('div', 'Chargement des places…', 'stat-subtitle');
  const placesBar = createDomNode('div', '', 'bar-track');
  const placesBreakdown = createDomNode('div', '', 'stat-breakdown');
  placesCard.appendChild(placesTitle);
  placesCard.appendChild(placesValue);
  placesCard.appendChild(placesSubtitle);
  placesCard.appendChild(placesBar);
  placesCard.appendChild(placesBreakdown);

  // Carte 2 : Chiffre d'affaires & Durée moyenne
  const revenueCard = createDomNode('article', '', 'stat-card', { 'aria-label': 'Revenus et performances' });
  const revenueTitle = createDomNode('h2', 'Chiffre d’affaires');
  const revenueValue = createDomNode('div', '—', 'stat-value');
  const revenueSubtitle = createDomNode('div', 'Sur la période sélectionnée', 'stat-subtitle');
  const revenueBreakdown = createDomNode('div', '', 'stat-breakdown');
  revenueCard.appendChild(revenueTitle);
  revenueCard.appendChild(revenueValue);
  revenueCard.appendChild(revenueSubtitle);
  revenueCard.appendChild(revenueBreakdown);

  // Carte 3 : Activité des réservations
  const resCard = createDomNode('article', '', 'stat-card', { 'aria-label': 'Activité des réservations' });
  const resTitle = createDomNode('h2', 'Réservations');
  const resValue = createDomNode('div', '—', 'stat-value');
  const resSubtitle = createDomNode('div', 'Total sur la période', 'stat-subtitle');
  const resBar = createDomNode('div', '', 'bar-track');
  const resBreakdown = createDomNode('div', '', 'stat-breakdown');
  resCard.appendChild(resTitle);
  resCard.appendChild(resValue);
  resCard.appendChild(resSubtitle);
  resCard.appendChild(resBar);
  resCard.appendChild(resBreakdown);

  // Carte 4 : Abonnements
  const subsCard = createDomNode('article', '', 'stat-card', { 'aria-label': 'Abonnements conducteurs' });
  const subsTitle = createDomNode('h2', 'Abonnements');
  const subsValue = createDomNode('div', '—', 'stat-value');
  const subsSubtitle = createDomNode('div', 'Abonnements souscrits', 'stat-subtitle');
  const subsBar = createDomNode('div', '', 'bar-track');
  const subsBreakdown = createDomNode('div', '', 'stat-breakdown');
  subsCard.appendChild(subsTitle);
  subsCard.appendChild(subsValue);
  subsCard.appendChild(subsSubtitle);
  subsCard.appendChild(subsBar);
  subsCard.appendChild(subsBreakdown);

  statsGrid.appendChild(placesCard);
  statsGrid.appendChild(revenueCard);
  statsGrid.appendChild(resCard);
  statsGrid.appendChild(subsCard);

  container.appendChild(header);
  container.appendChild(periodCard);
  container.appendChild(statsGrid);

  function getDateRangeForPeriod(periodType) {
    const now = new Date();
    if (periodType === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (periodType === '7d') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (periodType === '30d') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    if (periodType === 'custom') {
      const f = customFromInput.value ? `${customFromInput.value}T00:00:00Z` : undefined;
      const t = customToInput.value ? `${customToInput.value}T23:59:59Z` : undefined;
      return { from: f, to: t };
    }
    return { from: undefined, to: undefined };
  }

  // 1. Charger les places
  async function loadPlacesMetrics() {
    const revision = sessionRevision();
    try {
      const list = await api('/api/places');
      assertCurrentSession(revision);

      const total = Array.isArray(list) ? list.length : 0;
      placesValue.textContent = `${total} place(s)`;

      if (total === 0) {
        placesSubtitle.textContent = 'Aucune place enregistrée';
        placesBar.replaceChildren();
        placesBreakdown.replaceChildren();
        return;
      }

      let libre = 0;
      let occupee = 0;
      let reservee = 0;
      let horsService = 0;

      for (const p of list) {
        if (p.statut === 'LIBRE') libre++;
        else if (p.statut === 'OCCUPEE') occupee++;
        else if (p.statut === 'RESERVEE') reservee++;
        else if (p.statut === 'HORS_SERVICE') horsService++;
      }

      const occupiedRatio = total > 0 ? (occupee + reservee) / total : 0;
      placesSubtitle.textContent = `Taux d’occupation : ${Math.round(occupiedRatio * 100)} %`;

      // Barre CSS pure
      const segLibre = createDomNode('div', '', `bar-segment bar-green ${ratioToPctClass(libre / total)}`);
      const segReservee = createDomNode('div', '', `bar-segment bar-blue ${ratioToPctClass(reservee / total)}`);
      const segOccupee = createDomNode('div', '', `bar-segment bar-amber ${ratioToPctClass(occupee / total)}`);
      const segHors = createDomNode('div', '', `bar-segment bar-danger ${ratioToPctClass(horsService / total)}`);
      placesBar.replaceChildren(segLibre, segReservee, segOccupee, segHors);

      // Détails
      placesBreakdown.replaceChildren(
        createStatRow('Libres', libre, 'green'),
        createStatRow('Occupées', occupee, 'amber'),
        createStatRow('Réservées', reservee, 'blue'),
        createStatRow('Hors service', horsService, 'danger')
      );
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      placesSubtitle.textContent = 'Erreur de chargement';
    }
  }

  // 2. Charger les statistiques de réservations et revenus
  async function loadReservationStats() {
    const revision = sessionRevision();
    const period = periodSelect.value;
    const range = getDateRangeForPeriod(period);

    if (period === 'custom' && range.from && range.to) {
      const check = validateDateRange(customFromInput.value, customToInput.value);
      if (!check.valid) {
        showErrorToast(check.message);
        return;
      }
    }

    const query = buildQueryString({ from: range.from, to: range.to });

    try {
      const stats = await api(`/api/reservations/admin/stats${query}`);
      assertCurrentSession(revision);

      const totals = stats.totalsByStatus || {};
      const confirmed = Number(totals.CONFIRMED || 0);
      const inProgress = Number(totals.IN_PROGRESS || 0);
      const completed = Number(totals.COMPLETED || 0);
      const cancelled = Number(totals.CANCELLED || 0);
      const expired = Number(totals.EXPIRED || 0);
      const totalRes = confirmed + inProgress + completed + cancelled + expired;

      // Revenus
      revenueValue.textContent = formatMoney(stats.revenue || 0, 'MAD');
      revenueSubtitle.textContent = `${completed} réservation(s) terminée(s)`;
      revenueBreakdown.replaceChildren(
        createStatRow('Réservations terminées', completed),
        createStatRow('Durée moyenne', formatDuration(stats.averageDurationMinutes || 0))
      );

      // Réservations
      resValue.textContent = `${totalRes} réservation(s)`;
      resSubtitle.textContent = `${confirmed + inProgress} active(s) ou en cours`;

      if (totalRes > 0) {
        const segComp = createDomNode('div', '', `bar-segment bar-green ${ratioToPctClass(completed / totalRes)}`);
        const segAct = createDomNode('div', '', `bar-segment bar-blue ${ratioToPctClass((confirmed + inProgress) / totalRes)}`);
        const segCanc = createDomNode('div', '', `bar-segment bar-neutral ${ratioToPctClass(cancelled / totalRes)}`);
        const segExp = createDomNode('div', '', `bar-segment bar-danger ${ratioToPctClass(expired / totalRes)}`);
        resBar.replaceChildren(segComp, segAct, segCanc, segExp);
      } else {
        resBar.replaceChildren();
      }

      resBreakdown.replaceChildren(
        createStatRow('Terminées', completed, 'green'),
        createStatRow('En cours', inProgress, 'blue'),
        createStatRow('Confirmées', confirmed, 'blue'),
        createStatRow('Annulées', cancelled, 'neutral'),
        createStatRow('Expirées', expired, 'danger')
      );
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      revenueSubtitle.textContent = 'Erreur de chargement';
      resSubtitle.textContent = 'Erreur de chargement';
    }
  }

  // 3. Charger les abonnements
  async function loadSubscriptionsMetrics() {
    const revision = sessionRevision();
    try {
      const data = await api('/api/subscriptions/admin?page=0&size=100');
      assertCurrentSession(revision);

      const items = Array.isArray(data?.content) ? data.content : [];
      const total = data.totalElements || items.length;

      let active = 0;
      let pending = 0;
      let expired = 0;
      let cancelled = 0;

      for (const s of items) {
        if (s.status === 'ACTIVE') active++;
        else if (s.status === 'PENDING_PAYMENT') pending++;
        else if (s.status === 'EXPIRED') expired++;
        else if (s.status === 'CANCELLED') cancelled++;
      }

      subsValue.textContent = `${active} actif(s)`;
      subsSubtitle.textContent = `${total} souscription(s) au total`;

      if (items.length > 0) {
        const count = items.length;
        const segActive = createDomNode('div', '', `bar-segment bar-green ${ratioToPctClass(active / count)}`);
        const segPending = createDomNode('div', '', `bar-segment bar-amber ${ratioToPctClass(pending / count)}`);
        const segExpired = createDomNode('div', '', `bar-segment bar-neutral ${ratioToPctClass(expired / count)}`);
        const segCanc = createDomNode('div', '', `bar-segment bar-danger ${ratioToPctClass(cancelled / count)}`);
        subsBar.replaceChildren(segActive, segPending, segExpired, segCanc);
      } else {
        subsBar.replaceChildren();
      }

      subsBreakdown.replaceChildren(
        createStatRow('Actifs', active, 'green'),
        createStatRow('En attente', pending, 'amber'),
        createStatRow('Expirés', expired, 'neutral'),
        createStatRow('Annulés', cancelled, 'danger')
      );
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      subsSubtitle.textContent = 'Erreur de chargement';
    }
  }

  function createStatRow(label, value, badgeColor = null) {
    const row = createDomNode('div', '', 'stat-row');
    const labelSpan = createDomNode('span', label, 'muted');
    const valueSpan = createDomNode('strong', String(value));
    if (badgeColor) {
      valueSpan.className = `badge ${badgeColor}`;
    }
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    return row;
  }

  periodSelect.addEventListener('change', () => {
    if (periodSelect.value === 'custom') {
      customDatesDiv.hidden = false;
    } else {
      customDatesDiv.hidden = true;
      loadReservationStats();
    }
  });

  customApplyBtn.addEventListener('click', () => {
    loadReservationStats();
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, async () => {
      await Promise.all([loadPlacesMetrics(), loadReservationStats(), loadSubscriptionsMetrics()]);
    });
  });

  loadPlacesMetrics();
  loadReservationStats();
  loadSubscriptionsMetrics();

  return container;
}
