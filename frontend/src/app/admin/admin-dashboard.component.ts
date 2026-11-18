import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { buildQueryString, formatDuration, formatMoney, validateDateRange } from '../../../js/ui/formatters.js';
import { showErrorToast } from '../../../js/ui/toast.js';

type PlaceCounts = { total: number; libre: number; occupee: number; reservee: number; horsService: number };
type ReservationMetrics = {
  total: number;
  active: number;
  completed: number;
  confirmed: number;
  inProgress: number;
  cancelled: number;
  expired: number;
  revenue: string;
  averageDuration: string;
};
type SubscriptionCounts = { total: number; sampleSize: number; active: number; pending: number; expired: number; cancelled: number };

@Component({
  selector: 'parking-admin-dashboard',
  standalone: true,
  host: { class: 'block' },
  imports: [FormsModule],
  template: `
    <section class="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8" aria-label="Tableau de bord administrateur">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="m-0 text-[0.67rem] font-bold tracking-[0.14em] text-emerald-800">ESPACE ADMINISTRATEUR</p>
          <h1 class="mb-1 mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tableau de bord</h1>
          <p class="m-0 text-sm text-slate-500">Une vue d’ensemble de l’activité de votre parking.</p>
        </div>
        <button type="button" class="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-900 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50 disabled:opacity-60" [disabled]="refreshing" (click)="refresh()">
          <span class="text-lg" aria-hidden="true">↻</span> {{ refreshing ? 'Actualisation…' : 'Actualiser' }}
        </button>
      </header>

      <section class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Période des statistiques">
        <div class="flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-xl bg-emerald-50 text-xl text-emerald-800" aria-hidden="true">⌁</span>
          <div class="grid gap-0.5"><strong class="text-sm text-slate-800">Analyse des réservations</strong><small class="text-xs text-slate-500">Choisissez la période à afficher</small></div>
        </div>
        <div class="w-full sm:w-auto">
          <label class="sr-only" for="admin-period">Période d’analyse</label>
          <select class="h-11 w-full min-w-52 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 focus:border-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-700/10 sm:w-auto" id="admin-period" name="period" [(ngModel)]="period" (ngModelChange)="onPeriodChange()">
            <option value="30d">30 derniers jours</option>
            <option value="7d">7 derniers jours</option>
            <option value="today">Aujourd’hui</option>
            <option value="all">Tout l’historique</option>
            <option value="custom">Période personnalisée</option>
          </select>
        </div>
        @if (period === 'custom') {
          <div class="flex w-full flex-wrap items-end justify-end gap-3 border-t border-slate-100 pt-4">
            <label class="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-slate-600 sm:flex-none">Du <input class="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm" type="date" name="customFrom" [(ngModel)]="customFrom"></label>
            <label class="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-slate-600 sm:flex-none">Au <input class="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2 text-sm" type="date" name="customTo" [(ngModel)]="customTo"></label>
            <button type="button" class="min-h-10 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-950" (click)="loadReservations()">Appliquer</button>
          </div>
        }
      </section>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-live="polite">
        <article class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div class="mb-4 flex items-center gap-3"><span class="grid size-9 place-items-center rounded-xl bg-emerald-50 font-bold text-emerald-800">P</span><span class="text-[0.65rem] font-bold tracking-[0.13em] text-slate-500">PLACES</span></div>
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Occupation du parking</h2>
          @if (placesLoading) { <p class="my-5 text-sm text-slate-500">Chargement des places…</p> }
          @else if (placesError) { <p class="my-5 text-sm text-red-800">{{ placesError }}</p> }
          @else if (places) {
            <div class="flex min-h-12 items-baseline gap-2"><strong class="text-4xl font-bold tracking-tight text-slate-900">{{ occupancyPercent }}<span class="ml-0.5 text-2xl text-emerald-800">%</span></strong><small class="text-xs text-slate-500">{{ places.total }} place{{ places.total > 1 ? 's' : '' }} au total</small></div>
            <progress class="my-4 h-2 w-full accent-emerald-700" [value]="occupancyPercent" max="100" [attr.aria-label]="'Taux d’occupation : ' + occupancyPercent + ' pour cent'"></progress>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-slate-600">
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-emerald-500"></i>Libres <b class="ml-auto tabular-nums text-slate-800">{{ places.libre }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-amber-500"></i>Occupées <b class="ml-auto tabular-nums text-slate-800">{{ places.occupee }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-sky-500"></i>Réservées <b class="ml-auto tabular-nums text-slate-800">{{ places.reservee }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-rose-500"></i>Hors service <b class="ml-auto tabular-nums text-slate-800">{{ places.horsService }}</b></span>
            </div>
          }
        </article>

        <article class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div class="mb-4 flex items-center gap-3"><span class="grid size-9 place-items-center rounded-xl bg-emerald-50 text-[0.58rem] font-bold text-emerald-800">MAD</span><span class="text-[0.65rem] font-bold tracking-[0.13em] text-slate-500">REVENUS</span></div>
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Chiffre d’affaires</h2>
          @if (reservationsLoading) { <p class="my-5 text-sm text-slate-500">Chargement des données…</p> }
          @else if (reservationError) { <p class="my-5 text-sm text-red-800">{{ reservationError }}</p> }
          @else if (reservations) {
            <div class="flex min-h-12 items-baseline"><strong class="text-[clamp(1.65rem,3vw,2.2rem)] font-bold tracking-tight text-slate-900">{{ reservations.revenue }}</strong></div>
            <p class="mb-4 mt-2 text-xs text-slate-500">{{ reservations.completed }} réservation{{ reservations.completed > 1 ? 's' : '' }} terminée{{ reservations.completed > 1 ? 's' : '' }}</p>
            <div class="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600"><span>Durée moyenne</span><b class="font-semibold text-slate-800">{{ reservations.averageDuration }}</b></div>
          }
        </article>

        <article class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div class="mb-4 flex items-center gap-3"><span class="grid size-9 place-items-center rounded-xl bg-sky-50 font-bold text-sky-800">R</span><span class="text-[0.65rem] font-bold tracking-[0.13em] text-slate-500">RÉSERVATIONS</span></div>
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Activité sur la période</h2>
          @if (reservationsLoading) { <p class="my-5 text-sm text-slate-500">Chargement des données…</p> }
          @else if (reservationError) { <p class="my-5 text-sm text-red-800">{{ reservationError }}</p> }
          @else if (reservations) {
            <div class="flex min-h-12 items-baseline gap-2"><strong class="text-4xl font-bold tracking-tight text-slate-900">{{ reservations.total }}</strong><small class="text-xs text-slate-500">{{ reservations.active }} active{{ reservations.active > 1 ? 's' : '' }} ou en cours</small></div>
            <progress class="my-4 h-2 w-full accent-sky-700" [value]="reservationPercent(reservations.active)" max="100" [attr.aria-label]="reservations.active + ' réservation(s) active(s) sur ' + reservations.total"></progress>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-slate-600">
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-emerald-500"></i>Terminées <b class="ml-auto tabular-nums text-slate-800">{{ reservations.completed }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-sky-500"></i>En cours <b class="ml-auto tabular-nums text-slate-800">{{ reservations.inProgress }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-blue-400"></i>Confirmées <b class="ml-auto tabular-nums text-slate-800">{{ reservations.confirmed }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-slate-400"></i>Annulées <b class="ml-auto tabular-nums text-slate-800">{{ reservations.cancelled }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-rose-500"></i>Expirées <b class="ml-auto tabular-nums text-slate-800">{{ reservations.expired }}</b></span>
            </div>
          }
        </article>

        <article class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div class="mb-4 flex items-center gap-3"><span class="grid size-9 place-items-center rounded-xl bg-violet-50 font-bold text-violet-800">A</span><span class="text-[0.65rem] font-bold tracking-[0.13em] text-slate-500">ABONNEMENTS</span></div>
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Suivi des souscriptions</h2>
          @if (subscriptionsLoading) { <p class="my-5 text-sm text-slate-500">Chargement des données…</p> }
          @else if (subscriptionsError) { <p class="my-5 text-sm text-red-800">{{ subscriptionsError }}</p> }
          @else if (subscriptions) {
            <div class="flex min-h-12 items-baseline gap-2"><strong class="text-4xl font-bold tracking-tight text-slate-900">{{ subscriptions.active }}</strong><small class="text-xs text-slate-500">abonnement{{ subscriptions.active > 1 ? 's' : '' }} actif{{ subscriptions.active > 1 ? 's' : '' }}</small></div>
            <p class="mb-1 mt-2 text-xs text-slate-500">{{ subscriptions.total }} souscription{{ subscriptions.total > 1 ? 's' : '' }} au total</p>
            <progress class="my-4 h-2 w-full accent-violet-700" [value]="subscriptionPercent(subscriptions.active)" max="100" [attr.aria-label]="subscriptions.active + ' abonnement(s) actif(s) parmi ' + subscriptions.total"></progress>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-slate-600">
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-emerald-500"></i>Actifs <b class="ml-auto tabular-nums text-slate-800">{{ subscriptions.active }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-amber-500"></i>En attente <b class="ml-auto tabular-nums text-slate-800">{{ subscriptions.pending }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-sky-500"></i>Expirés <b class="ml-auto tabular-nums text-slate-800">{{ subscriptions.expired }}</b></span>
              <span class="flex items-center gap-2"><i class="size-2 rounded-full bg-rose-500"></i>Annulés <b class="ml-auto tabular-nums text-slate-800">{{ subscriptions.cancelled }}</b></span>
            </div>
          }
        </article>
      </div>
    </section>
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  period = '30d';
  customFrom = '';
  customTo = '';
  places: PlaceCounts | null = null;
  reservations: ReservationMetrics | null = null;
  subscriptions: SubscriptionCounts | null = null;
  placesLoading = true;
  reservationsLoading = true;
  subscriptionsLoading = true;
  placesError = '';
  reservationError = '';
  subscriptionsError = '';
  refreshing = false;
  private destroyed = false;

  get occupancyPercent(): number {
    if (!this.places?.total) return 0;
    return Math.round(((this.places.occupee + this.places.reservee) / this.places.total) * 100);
  }

  ngOnInit(): void {
    void Promise.all([this.loadPlaces(), this.loadReservations(), this.loadSubscriptions()]);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
  }

  onPeriodChange(): void {
    if (this.period !== 'custom') void this.loadReservations();
  }

  async refresh(): Promise<void> {
    this.refreshing = true;
    try {
      await Promise.all([this.loadPlaces(), this.loadReservations(), this.loadSubscriptions()]);
    } finally {
      this.refreshing = false;
    }
  }

  reservationPercent(count: number): number {
    return this.reservations?.total ? count / this.reservations.total * 100 : 0;
  }

  subscriptionPercent(count: number): number {
    return this.subscriptions?.sampleSize ? count / this.subscriptions.sampleSize * 100 : 0;
  }

  async loadPlaces(): Promise<void> {
    const revision = sessionRevision();
    this.placesLoading = true;
    this.placesError = '';
    try {
      const list = await api('/api/places');
      assertCurrentSession(revision);
      if (this.destroyed) return;
      const places = Array.isArray(list) ? list : [];
      this.places = {
        total: places.length,
        libre: places.filter((place: any) => place.statut === 'LIBRE').length,
        occupee: places.filter((place: any) => place.statut === 'OCCUPEE').length,
        reservee: places.filter((place: any) => place.statut === 'RESERVEE').length,
        horsService: places.filter((place: any) => place.statut === 'HORS_SERVICE').length
      };
    } catch {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.placesError = 'Impossible de charger les places.';
    } finally {
      if (!this.destroyed && isCurrentSession(revision)) this.placesLoading = false;
    }
  }

  async loadReservations(): Promise<void> {
    const revision = sessionRevision();
    this.reservationsLoading = true;
    this.reservationError = '';
    try {
      const range = this.dateRange();
      if (this.period === 'custom' && range.from && range.to) {
        const validation = validateDateRange(this.customFrom, this.customTo);
        if (!validation.valid) {
          showErrorToast(validation.message);
          this.reservationsLoading = false;
          return;
        }
      }
      const query = buildQueryString({ from: range.from, to: range.to });
      const stats = await api(`/api/reservations/admin/stats${query}`);
      assertCurrentSession(revision);
      if (this.destroyed) return;
      const totals = stats.totalsByStatus || {};
      const confirmed = Number(totals.CONFIRMED || 0);
      const inProgress = Number(totals.IN_PROGRESS || 0);
      const completed = Number(totals.COMPLETED || 0);
      const cancelled = Number(totals.CANCELLED || 0);
      const expired = Number(totals.EXPIRED || 0);
      this.reservations = {
        total: confirmed + inProgress + completed + cancelled + expired,
        active: confirmed + inProgress,
        completed,
        confirmed,
        inProgress,
        cancelled,
        expired,
        revenue: formatMoney(stats.revenue || 0, 'MAD'),
        averageDuration: formatDuration(stats.averageDurationMinutes || 0)
      };
    } catch {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.reservationError = 'Impossible de charger les statistiques de réservation.';
    } finally {
      if (!this.destroyed && isCurrentSession(revision)) this.reservationsLoading = false;
    }
  }

  async loadSubscriptions(): Promise<void> {
    const revision = sessionRevision();
    this.subscriptionsLoading = true;
    this.subscriptionsError = '';
    try {
      const data = await api('/api/subscriptions/admin?page=0&size=100');
      assertCurrentSession(revision);
      if (this.destroyed) return;
      const items = Array.isArray(data?.content) ? data.content : [];
      this.subscriptions = {
        total: Number(data.totalElements || items.length),
        sampleSize: items.length,
        active: items.filter((item: any) => item.status === 'ACTIVE').length,
        pending: items.filter((item: any) => item.status === 'PENDING_PAYMENT').length,
        expired: items.filter((item: any) => item.status === 'EXPIRED').length,
        cancelled: items.filter((item: any) => item.status === 'CANCELLED').length
      };
    } catch {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.subscriptionsError = 'Impossible de charger les abonnements.';
    } finally {
      if (!this.destroyed && isCurrentSession(revision)) this.subscriptionsLoading = false;
    }
  }

  private dateRange(): { from?: string; to?: string } {
    const now = new Date();
    if (this.period === 'today') {
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), to: now.toISOString() };
    }
    if (this.period === '7d' || this.period === '30d') {
      const days = this.period === '7d' ? 7 : 30;
      return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() };
    }
    if (this.period === 'custom') {
      return {
        from: this.customFrom ? `${this.customFrom}T00:00:00Z` : undefined,
        to: this.customTo ? `${this.customTo}T23:59:59Z` : undefined
      };
    }
    return {};
  }
}
