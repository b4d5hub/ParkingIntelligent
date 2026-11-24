import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPageBannerComponent } from './admin-page-banner.component';
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
type ChartPoint = { key: string; label: string; value: number; accent: string };

@Component({
  selector: 'parking-admin-dashboard',
  standalone: true,
  host: { class: 'block' },
  imports: [FormsModule, AdminPageBannerComponent],
  template: `
    <section class="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8" aria-label="Tableau de bord administrateur">
      <parking-admin-banner title="Tableau de bord" description="Une vue d’ensemble de l’activité de votre parking." code="00">
        <button banner-action type="button" class="min-h-10 rounded-lg bg-[#c5f277] px-4 py-2 text-sm font-bold text-[#101d2c] transition hover:bg-[#d2fa8d] disabled:opacity-60" [disabled]="refreshing" (click)="refresh()"><span class="mr-1 text-lg" aria-hidden="true">↻</span>{{ refreshing ? 'Actualisation…' : 'Actualiser' }}</button>
      </parking-admin-banner>

      <section class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5" aria-label="Période des statistiques">
        <div class="flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-xl bg-[#eff9d9] text-xl text-[#405624]" aria-hidden="true">⌁</span>
          <div class="grid gap-0.5"><strong class="text-sm text-slate-800">Analyse des réservations</strong><small class="text-xs text-slate-500">Choisissez la période à afficher</small></div>
        </div>
        <div class="w-full sm:w-auto">
          <label class="sr-only" for="admin-period">Période d’analyse</label>
          <select class="h-11 w-full min-w-52 rounded-lg border border-[#cbd5df] bg-[#eef4f8] px-3 text-sm text-slate-800 focus:border-[#527097] focus:outline-none focus:ring-4 focus:ring-[#527097]/10 sm:w-auto" id="admin-period" name="period" [(ngModel)]="period" (ngModelChange)="onPeriodChange()">
            <option value="30d">30 derniers jours</option>
            <option value="7d">7 derniers jours</option>
            <option value="today">Aujourd’hui</option>
            <option value="all">Tout l’historique</option>
            <option value="custom">Période personnalisée</option>
          </select>
        </div>
        @if (period === 'custom') {
          <div class="flex w-full flex-wrap items-end justify-end gap-3 border-t border-slate-100 pt-4">
            <label class="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-slate-600 sm:flex-none">Du <input class="h-10 rounded-lg border border-[#cbd5df] bg-[#eef4f8] px-2 text-sm" type="date" name="customFrom" [(ngModel)]="customFrom"></label>
            <label class="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-slate-600 sm:flex-none">Au <input class="h-10 rounded-lg border border-[#cbd5df] bg-[#eef4f8] px-2 text-sm" type="date" name="customTo" [(ngModel)]="customTo"></label>
            <button type="button" class="min-h-10 rounded-lg bg-[#101d2c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#263649]" (click)="loadReservations()">Appliquer</button>
          </div>
        }
      </section>

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs clés" aria-live="polite">
        <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5"><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">CHIFFRE D’AFFAIRES</p>@if (reservationsLoading) { <p class="mb-0 mt-3 text-sm text-slate-500">Chargement…</p> } @else if (reservationError) { <p class="mb-0 mt-3 text-xs text-rose-800">Indisponible</p> } @else if (reservations) { <p class="mb-0 mt-2 text-2xl font-bold tracking-tight text-[#101d2c]">{{ reservations.revenue }}</p><p class="mb-0 mt-1 text-xs text-slate-500">Période sélectionnée</p> }</article>
        <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5"><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">TAUX D’OCCUPATION</p>@if (placesLoading) { <p class="mb-0 mt-3 text-sm text-slate-500">Chargement…</p> } @else if (placesError) { <p class="mb-0 mt-3 text-xs text-rose-800">Indisponible</p> } @else if (places) { <p class="mb-0 mt-2 text-3xl font-bold tracking-tight text-[#101d2c]">{{ occupancyPercent }}<span class="ml-1 text-lg text-[#527097]">%</span></p><p class="mb-0 mt-1 text-xs text-slate-500">{{ places.occupee + places.reservee }} occupée(s) ou réservée(s) / {{ places.total }}</p> }</article>
        <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5"><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">RÉSERVATIONS</p>@if (reservationsLoading) { <p class="mb-0 mt-3 text-sm text-slate-500">Chargement…</p> } @else if (reservationError) { <p class="mb-0 mt-3 text-xs text-rose-800">Indisponible</p> } @else if (reservations) { <p class="mb-0 mt-2 text-3xl font-bold tracking-tight text-[#101d2c]">{{ reservations.total }}</p><p class="mb-0 mt-1 text-xs text-slate-500">{{ reservations.active }} active(s) ou en cours</p> }</article>
        <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5"><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">DURÉE MOYENNE</p>@if (reservationsLoading) { <p class="mb-0 mt-3 text-sm text-slate-500">Chargement…</p> } @else if (reservationError) { <p class="mb-0 mt-3 text-xs text-rose-800">Indisponible</p> } @else if (reservations) { <p class="mb-0 mt-2 text-2xl font-bold tracking-tight text-[#101d2c]">{{ reservations.averageDuration }}</p><p class="mb-0 mt-1 text-xs text-slate-500">Stationnements terminés</p> }</article>
      </section>

      <section class="grid gap-4 lg:grid-cols-2" aria-label="Graphiques du parking">
        <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-5 shadow-sm sm:p-6">
          <div class="mb-5"><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">ANALYSE DE PÉRIODE</p><h2 class="mb-0 mt-1 text-lg font-bold text-[#101d2c]">Réservations par statut</h2><p class="mb-0 mt-1 text-xs text-slate-500">Répartition selon la période sélectionnée.</p></div>
          @if (reservationsLoading) { <p class="text-sm text-slate-500">Chargement des réservations…</p> } @else if (reservationError) { <p class="text-sm text-rose-800" role="alert">{{ reservationError }}</p> } @else if (reservations) {
            <div class="space-y-4">@for (point of reservationChart; track point.key) { <div class="grid grid-cols-[100px_minmax(0,1fr)_36px] items-center gap-3"><span class="text-xs font-medium text-slate-600">{{ point.label }}</span><progress class="h-2.5 w-full overflow-hidden rounded-full bg-[#eef4f8]" [class]="point.accent" [value]="point.value" [max]="reservationChartMax" [attr.aria-label]="point.label + ' : ' + point.value"></progress><strong class="text-right text-xs tabular-nums text-[#101d2c]">{{ point.value }}</strong></div> }</div>
            <p class="mb-0 mt-5 border-t border-[#e5eaf0] pt-3 text-xs text-slate-500">{{ reservations.total }} réservation(s) au total · {{ reservations.completed }} terminée(s)</p>
          }
        </article>

        <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-5 shadow-sm sm:p-6">
          <div class="mb-5"><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">ÉTAT EN DIRECT</p><h2 class="mb-0 mt-1 text-lg font-bold text-[#101d2c]">Répartition des places</h2><p class="mb-0 mt-1 text-xs text-slate-500">Occupation actuelle, tous créneaux confondus.</p></div>
          @if (placesLoading) { <p class="text-sm text-slate-500">Chargement des places…</p> } @else if (placesError) { <p class="text-sm text-rose-800" role="alert">{{ placesError }}</p> } @else if (places) {
            <div class="space-y-4">@for (point of placeChart; track point.key) { <div class="grid grid-cols-[100px_minmax(0,1fr)_36px] items-center gap-3"><span class="text-xs font-medium text-slate-600">{{ point.label }}</span><progress class="h-2.5 w-full overflow-hidden rounded-full bg-[#eef4f8]" [class]="point.accent" [value]="point.value" [max]="placeChartMax" [attr.aria-label]="point.label + ' : ' + point.value"></progress><strong class="text-right text-xs tabular-nums text-[#101d2c]">{{ point.value }}</strong></div> }</div>
            <p class="mb-0 mt-5 border-t border-[#e5eaf0] pt-3 text-xs text-slate-500">{{ places.total }} place(s) configurée(s) · {{ occupancyPercent }} % occupé ou réservé</p>
          }
        </article>
      </section>

      <section class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" aria-label="Compléments d’activité">
        <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-5 shadow-sm"><div class="flex items-start justify-between gap-4"><div><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">ABONNEMENTS</p><h2 class="mb-0 mt-1 text-lg font-bold text-[#101d2c]">Suivi des souscriptions</h2></div><span class="rounded-full bg-[#eff9d9] px-3 py-1 text-xs font-bold text-[#405624]">{{ subscriptions?.active || 0 }} actifs observés</span></div>@if (subscriptionsLoading) { <p class="mb-0 mt-4 text-sm text-slate-500">Chargement…</p> } @else if (subscriptionsError) { <p class="mb-0 mt-4 text-sm text-rose-800">{{ subscriptionsError }}</p> } @else if (subscriptions) { <div class="mt-4 grid grid-cols-2 gap-3 text-sm"><span class="rounded-lg bg-[#eef4f8] p-3 text-slate-600">Total <b class="float-right text-[#101d2c]">{{ subscriptions.total }}</b></span><span class="rounded-lg bg-[#eef4f8] p-3 text-slate-600">En attente <b class="float-right text-[#101d2c]">{{ subscriptions.pending }}</b></span><span class="rounded-lg bg-[#eef4f8] p-3 text-slate-600">Expirés <b class="float-right text-[#101d2c]">{{ subscriptions.expired }}</b></span><span class="rounded-lg bg-[#eef4f8] p-3 text-slate-600">Annulés <b class="float-right text-[#101d2c]">{{ subscriptions.cancelled }}</b></span></div><p class="mb-0 mt-3 text-xs text-slate-500">Statuts observés sur {{ subscriptions.sampleSize }} souscriptions récentes.</p> }</article>
        <article class="rounded-2xl bg-[#101d2c] p-5 text-white shadow-lg shadow-slate-900/10"><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#c5f277]">À PROPOS DES INDICATEURS</p><h2 class="mb-2 mt-2 text-lg font-bold text-white">Des chiffres issus des services</h2><p class="m-0 text-sm leading-6 text-slate-300">Les revenus et statuts de réservation suivent la période choisie. L’occupation reflète l’état actuel des places. Les souscriptions affichées correspondent à l’échantillon chargé par l’API.</p></article>
      </section>
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

  get reservationChartMax(): number { return Math.max(this.reservations?.total || 0, 1); }
  get placeChartMax(): number { return Math.max(this.places?.total || 0, 1); }
  get reservationChart(): ChartPoint[] {
    const data = this.reservations;
    if (!data) return [];
    return [
      { key: 'confirmed', label: 'Confirmées', value: data.confirmed, accent: 'accent-[#6bb5ff]' },
      { key: 'in-progress', label: 'En cours', value: data.inProgress, accent: 'accent-[#f4c578]' },
      { key: 'completed', label: 'Terminées', value: data.completed, accent: 'accent-[#c5f277]' },
      { key: 'cancelled', label: 'Annulées', value: data.cancelled, accent: 'accent-slate-400' },
      { key: 'expired', label: 'Expirées', value: data.expired, accent: 'accent-rose-500' }
    ];
  }
  get placeChart(): ChartPoint[] {
    const data = this.places;
    if (!data) return [];
    return [
      { key: 'free', label: 'Libres', value: data.libre, accent: 'accent-[#c5f277]' },
      { key: 'occupied', label: 'Occupées', value: data.occupee, accent: 'accent-[#6bb5ff]' },
      { key: 'reserved', label: 'Réservées', value: data.reservee, accent: 'accent-[#f4c578]' },
      { key: 'out-of-service', label: 'Hors service', value: data.horsService, accent: 'accent-rose-500' }
    ];
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
