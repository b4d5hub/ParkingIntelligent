import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { buildQueryString, formatDate, formatMoney, validateDateRange } from '../../../js/ui/formatters.js';
import { getReservationStatusInfo } from '../../../js/ui/labels.js';
import { showErrorToast } from '../../../js/ui/toast.js';

type Filters = { status: string; from: string; to: string; placeId: string; conducteurId: string };
type Reservation = { id: string | number; conducteurId: string | number; placeId: string | number; debutPrevu?: string; finPrevue?: string; statut: string; arriveeReelle?: string; departReel?: string; bookingPaid?: number; extraPaid?: number; montantTotal?: number; devise?: string };

@Component({
  selector: 'parking-admin-reservations',
  standalone: true,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="m-0 text-[0.67rem] font-bold tracking-[0.14em] text-emerald-800">ESPACE ADMINISTRATEUR</p><h1 class="mb-1 mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Réservations</h1><p class="m-0 text-sm text-slate-500">Consultez et filtrez les réservations du parking.</p></div>
        <button class="min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" type="button" [disabled]="loading" (click)="loadReservations(currentPage)">{{ loading ? 'Actualisation…' : 'Actualiser' }}</button>
      </header>

      <form class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Filtres de réservations" (ngSubmit)="applyFilters()">
        <div class="flex items-center justify-between gap-3"><div><h2 class="m-0 text-sm font-bold text-slate-900">Filtres de recherche</h2><p class="mb-0 mt-1 text-xs text-slate-500">Combinez un statut, une période ou un identifiant.</p></div><span class="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:inline">{{ totalElements }} résultat{{ totalElements > 1 ? 's' : '' }}</span></div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label class="grid gap-1 text-xs font-semibold text-slate-600">Statut<select class="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm font-normal text-slate-800" name="status" [(ngModel)]="draftFilters.status"><option value="">Tous les statuts</option><option value="CONFIRMED">Confirmée</option><option value="IN_PROGRESS">En cours</option><option value="COMPLETED">Terminée</option><option value="CANCELLED">Annulée</option><option value="EXPIRED">Expirée</option></select></label>
          <label class="grid gap-1 text-xs font-semibold text-slate-600">Du (date début)<input class="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm font-normal" type="date" name="from" [(ngModel)]="draftFilters.from"></label>
          <label class="grid gap-1 text-xs font-semibold text-slate-600">Au (date fin)<input class="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm font-normal" type="date" name="to" [(ngModel)]="draftFilters.to"></label>
          <label class="grid gap-1 text-xs font-semibold text-slate-600">N° Place (ID)<input class="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm font-normal" type="number" name="placeId" min="1" placeholder="Ex. 1" [(ngModel)]="draftFilters.placeId"></label>
          <label class="grid gap-1 text-xs font-semibold text-slate-600">Conducteur (ID)<input class="h-10 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-sm font-normal" type="number" name="conducteurId" min="1" placeholder="Ex. 2" [(ngModel)]="draftFilters.conducteurId"></label>
        </div>
        @if (filterError) { <p class="m-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">{{ filterError }}</p> }
        <div class="flex flex-wrap gap-2"><button class="min-h-10 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-950 disabled:opacity-60" type="submit" [disabled]="loading">Appliquer les filtres</button><button class="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button" (click)="resetFilters()">Réinitialiser</button></div>
      </form>

      <section class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Résultats des réservations">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 class="m-0 text-base font-bold text-slate-900">Toutes les réservations</h2><p class="mb-0 mt-1 text-xs text-slate-500" role="status">{{ statusMessage }}</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:hidden">{{ totalElements }} résultat{{ totalElements > 1 ? 's' : '' }}</span></div>
        @if (loading) {
          <div class="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Chargement des réservations…</div>
        } @else if (errorMessage) {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{{ errorMessage }}</div>
        } @else if (reservations.length === 0) {
          <div class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucune réservation ne correspond à vos filtres.</div>
        } @else {
          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="min-w-[1050px] w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th class="px-3 py-3">ID</th><th class="px-3 py-3">Conducteur</th><th class="px-3 py-3">Place</th><th class="px-3 py-3">Début prévu</th><th class="px-3 py-3">Fin prévue</th><th class="px-3 py-3">Statut</th><th class="px-3 py-3">Arrivée réelle</th><th class="px-3 py-3">Départ réel</th><th class="px-3 py-3 text-right">Montant</th></tr></thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (reservation of reservations; track reservation.id) {
                  <tr class="align-top hover:bg-slate-50"><td class="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">#{{ reservation.id }}</td><td class="whitespace-nowrap px-3 py-3 text-slate-700">ID {{ reservation.conducteurId }}</td><td class="whitespace-nowrap px-3 py-3 text-slate-700">Place {{ reservation.placeId }}</td><td class="whitespace-nowrap px-3 py-3 text-slate-600">{{ formatDate(reservation.debutPrevu) }}</td><td class="whitespace-nowrap px-3 py-3 text-slate-600">{{ formatDate(reservation.finPrevue) }}</td><td class="whitespace-nowrap px-3 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="statusClass(reservation.statut)">{{ reservationStatus(reservation.statut) }}</span></td><td class="whitespace-nowrap px-3 py-3 text-slate-600">{{ formatDate(reservation.arriveeReelle) }}</td><td class="whitespace-nowrap px-3 py-3 text-slate-600">{{ formatDate(reservation.departReel) }}</td><td class="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">{{ formatMoney(amount(reservation), reservation.devise || 'MAD') }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><p class="m-0 text-xs text-slate-500">Page {{ currentPage + 1 }} sur {{ totalPages }}</p><div class="flex gap-2"><button class="min-h-9 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40" type="button" [disabled]="currentPage === 0 || loading" (click)="loadReservations(currentPage - 1)">← Précédent</button><button class="min-h-9 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40" type="button" [disabled]="currentPage >= totalPages - 1 || loading" (click)="loadReservations(currentPage + 1)">Suivant →</button></div></div>
        }
      </section>
    </main>
  `
})
export class AdminReservationsComponent implements OnInit, OnDestroy {
  draftFilters: Filters = this.emptyFilters();
  activeFilters: Filters = this.emptyFilters();
  reservations: Reservation[] = [];
  currentPage = 0;
  totalPages = 1;
  totalElements = 0;
  loading = true;
  statusMessage = 'Chargement des réservations…';
  errorMessage = '';
  filterError = '';
  private destroyed = false;

  ngOnInit(): void { void this.loadReservations(0); }
  ngOnDestroy(): void { this.destroyed = true; }
  formatDate = formatDate;
  formatMoney = formatMoney;

  private emptyFilters(): Filters { return { status: '', from: '', to: '', placeId: '', conducteurId: '' }; }

  reservationStatus(status: string): string { return getReservationStatusInfo(status).label; }
  amount(reservation: Reservation): number {
    if (reservation.montantTotal !== undefined && reservation.montantTotal !== null) return Number(reservation.montantTotal);
    return (reservation.bookingPaid !== undefined ? Number(reservation.bookingPaid) : 0) + (reservation.extraPaid !== undefined ? Number(reservation.extraPaid) : 0);
  }
  statusClass(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'bg-sky-50 text-sky-800';
      case 'IN_PROGRESS': return 'bg-amber-50 text-amber-900';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-800';
      case 'CANCELLED': return 'bg-slate-100 text-slate-700';
      case 'EXPIRED': return 'bg-rose-50 text-rose-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  applyFilters(): void {
    if (this.draftFilters.from && this.draftFilters.to) {
      const validation = validateDateRange(this.draftFilters.from, this.draftFilters.to);
      if (!validation.valid) { this.filterError = validation.message || 'La période sélectionnée est invalide.'; showErrorToast(this.filterError); return; }
    }
    this.filterError = '';
    this.activeFilters = { ...this.draftFilters };
    void this.loadReservations(0);
  }

  resetFilters(): void { this.draftFilters = this.emptyFilters(); this.activeFilters = this.emptyFilters(); this.filterError = ''; void this.loadReservations(0); }

  async loadReservations(page = 0): Promise<void> {
    const revision = sessionRevision();
    this.currentPage = page;
    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = 'Chargement…';
    const filters = this.activeFilters;
    const query = buildQueryString({
      page, size: 15, status: filters.status || undefined,
      from: filters.from ? `${filters.from}T00:00:00Z` : undefined,
      to: filters.to ? `${filters.to}T23:59:59Z` : undefined,
      placeId: filters.placeId || undefined,
      conducteurId: filters.conducteurId || undefined
    });
    try {
      const data = await api(`/api/reservations/admin${query}`);
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.reservations = Array.isArray(data?.items) ? data.items : [];
      this.totalPages = data.totalPages || 1;
      this.totalElements = Number(data.totalElements || this.reservations.length);
      this.statusMessage = this.reservations.length ? `${this.totalElements} réservation(s) trouvée(s).` : 'Aucune réservation trouvée.';
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.reservations = [];
      this.statusMessage = 'Erreur de chargement.';
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les réservations.';
      showErrorToast(this.errorMessage);
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.loading = false; }
  }
}
