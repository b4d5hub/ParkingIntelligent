import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { formatDate, formatMoney } from '../../../js/ui/formatters.js';
import { getReservationStatusInfo } from '../../../js/ui/labels.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';

type Reservation = {
  id: string | number; placeId: string | number; placeNumero?: string; statut: string;
  debutPrevu: string; finPrevue: string; montantEstime?: number; montantFinal?: number | null;
  currency?: string; bookingPaid?: number | null; extraPaid?: number | null; paymentStatus?: string;
  paymentReference?: string; extraPaymentReference?: string; placesSyncPending?: boolean;
};

@Component({
  selector: 'parking-driver-history',
  standalone: true,
  imports: [CommonModule],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header class="relative isolate overflow-hidden rounded-[1.75rem] bg-[#101d2c] px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-9"><span class="absolute -right-20 -top-32 -z-10 size-80 rounded-full border-[42px] border-white/[0.04]" aria-hidden="true"></span><div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p class="mb-3 flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.18em] text-[#c5f277]"><span class="size-2 rounded-full bg-[#c5f277]"></span> PARKING INTELLIGENT <span class="text-white/35">/</span> ESPACE CONDUCTEUR</p><h1 class="mb-2 mt-0 text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">Vos trajets,<br><span class="text-[#c5f277]">bien rangés.</span></h1><p class="m-0 max-w-lg text-sm leading-6 text-slate-300">Consultez vos prochaines arrivées et retrouvez l’historique de vos stationnements.</p></div><button class="min-h-10 self-start rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 sm:self-auto" type="button" [disabled]="loading" (click)="loadReservations()">↻ {{ loading ? 'Actualisation…' : 'Actualiser' }}</button></div><div class="mt-7 flex flex-wrap gap-2 text-xs font-semibold"><span class="rounded-full bg-[#c5f277] px-3 py-1.5 text-[#101d2c]">{{ activeReservations.length }} en cours ou à venir</span><span class="rounded-full border border-white/15 px-3 py-1.5 text-slate-200">{{ total }} au total</span></div></header>
      <section class="space-y-5" aria-label="Liste de mes réservations">
        @if (loading) { <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500" role="status">Chargement de vos réservations…</div> }
        @else if (errorMessage) { <div class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900" role="alert">{{ errorMessage }}</div> }
        @else if (reservations.length === 0) { <div class="rounded-2xl border border-dashed border-[#cbd5df] bg-[#fcfdff] p-10 text-center"><span class="mx-auto grid size-12 place-items-center rounded-2xl bg-[#101d2c] text-sm font-black text-[#c5f277]" aria-hidden="true">P</span><h2 class="mb-1 mt-4 text-lg font-bold text-[#101d2c]">Aucune réservation pour le moment</h2><p class="m-0 text-sm text-slate-500">Vos prochaines réservations apparaîtront ici.</p></div> }
        @else {
          @if (activeReservations.length) { <section class="space-y-3" aria-label="Réservations à venir et en cours"><div class="flex items-end justify-between gap-3"><div><p class="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-[#527097]">À SUIVRE</p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-[#101d2c]">À venir et en cours</h2><p class="mb-0 mt-1 text-xs text-slate-500">{{ activeReservations.length }} réservation{{ activeReservations.length > 1 ? 's' : '' }}</p></div></div>@for (reservation of activeReservations; track reservation.id) { <ng-container *ngTemplateOutlet="reservationCard; context: { $implicit: reservation }"></ng-container> }</section> }
          @if (pastReservations.length) { <section class="space-y-3" aria-label="Réservations passées et annulées"><div><p class="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-slate-400">ARCHIVES</p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-[#101d2c]">Passées et annulées</h2></div>@for (reservation of pastReservations; track reservation.id) { <ng-container *ngTemplateOutlet="reservationCard; context: { $implicit: reservation }"></ng-container> }</section> }
        }
        @if (!loading && !errorMessage) { <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d6dee8] bg-[#fcfdff] px-4 py-3"><p class="m-0 text-xs text-slate-500">{{ total }} réservation{{ total > 1 ? 's' : '' }} · Page {{ page + 1 }} sur {{ totalPages }}</p><div class="flex gap-2"><button class="min-h-9 rounded-lg border border-[#cbd5df] bg-white px-3 text-xs font-semibold text-[#263649] hover:bg-[#eef4f8] disabled:opacity-40" type="button" [disabled]="page === 0" (click)="loadReservations(page - 1)">← Précédent</button><button class="min-h-9 rounded-lg border border-[#cbd5df] bg-white px-3 text-xs font-semibold text-[#263649] hover:bg-[#eef4f8] disabled:opacity-40" type="button" [disabled]="(page + 1) * pageSize >= total" (click)="loadReservations(page + 1)">Suivant →</button></div></div> }
      </section>
    </main>

    <ng-template #reservationCard let-reservation>
      <article class="rounded-2xl border border-[#d8e0e8] border-l-4 border-l-[#c5f277] bg-[#fcfdff] p-4 shadow-sm shadow-slate-900/[0.03] sm:p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p class="m-0 text-[0.65rem] font-bold tracking-widest text-[#718399]">RÉSERVATION N°{{ reservation.id }}</p><h3 class="mb-0 mt-1 text-lg font-bold text-[#101d2c]">{{ reservation.placeNumero ? 'Place ' + reservation.placeNumero : 'Place n°' + reservation.placeId }}</h3><p class="mb-0 mt-1 text-sm text-slate-600">Du {{ formatDate(reservation.debutPrevu) }} au {{ formatDate(reservation.finPrevue) }}</p></div><span class="w-fit rounded-full px-3 py-1 text-xs font-semibold" [class]="statusClass(reservation.statut)">{{ statusLabel(reservation.statut) }}</span></div>
        <div class="mt-4 grid gap-3 border-t border-[#e5eaf0] pt-4 sm:grid-cols-2"><div class="rounded-xl bg-[#eef4f8] p-3"><p class="m-0 text-xs font-medium text-slate-500">Estimation</p><p class="mb-0 mt-1 text-base font-bold tabular-nums text-[#101d2c]">{{ formatMoney(reservation.montantEstime, reservation.currency) }}</p>@if (reservation.montantFinal !== null && reservation.montantFinal !== undefined) { <p class="mb-0 mt-1 text-xs text-slate-600">Montant final : {{ formatMoney(reservation.montantFinal, reservation.currency) }}</p> }</div>
          @if (reservation.bookingPaid !== null && reservation.bookingPaid !== undefined) { <div class="rounded-xl bg-[#eef4f8] p-3"><p class="m-0 text-xs font-medium text-slate-500">Paiement du créneau</p><p class="mb-0 mt-1 text-base font-bold tabular-nums text-[#101d2c]">{{ formatMoney(reservation.bookingPaid, reservation.currency) }}</p><p class="mb-0 mt-1 text-xs text-slate-600">{{ paymentMessage(reservation) }}</p></div> }
        </div>
        @if (reservation.paymentStatus === 'PAID') { <p class="mb-0 mt-3 text-xs text-slate-500">Paiement simulé enregistré{{ reservation.paymentReference ? ' · Réf. ' + reservation.paymentReference : '' }}</p> }
        @if (reservation.extraPaymentReference) { <p class="mb-0 mt-2 text-xs text-slate-500">Paiement complémentaire simulé : {{ reservation.extraPaymentReference }}</p> }
        @if (reservation.placesSyncPending) { <p class="mb-0 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Mise à jour de la place en attente. Actualisez pour vérifier la synchronisation.</p> }
        @if (canCancel(reservation)) { <div class="mt-4 border-t border-[#e5eaf0] pt-3"><button class="min-h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50" type="button" [disabled]="cancellingId === reservation.id" (click)="askCancel(reservation)">{{ cancellingId === reservation.id ? 'Annulation…' : 'Annuler la réservation' }}</button><p class="mb-0 mt-2 text-xs text-slate-500">Le paiement du créneau reste acquis sans remboursement.</p></div> }
      </article>
    </ng-template>

    @if (reservationToCancel) { <div class="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" (click)="reservationToCancel = null"><section class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cancel-title" (click)="$event.stopPropagation()"><p class="m-0 text-[0.65rem] font-bold tracking-widest text-rose-700">CONFIRMATION</p><h2 class="mb-2 mt-1 text-xl font-bold text-slate-900" id="cancel-title">Annuler cette réservation ?</h2><p class="m-0 text-sm leading-6 text-slate-600">Le créneau est payé à la réservation et le paiement reste acquis sans remboursement.</p><div class="mt-5 flex justify-end gap-2"><button class="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700" type="button" (click)="reservationToCancel = null">Retour</button><button class="min-h-10 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white disabled:opacity-50" type="button" [disabled]="cancellingId !== null" (click)="cancelReservation()">{{ cancellingId ? 'Annulation…' : 'Confirmer l’annulation' }}</button></div></section></div> }
  `
})
export class DriverHistoryComponent implements OnInit, OnDestroy {
  readonly pageSize = 20;
  reservations: Reservation[] = [];
  page = 0;
  total = 0;
  totalPages = 1;
  loading = true;
  errorMessage = '';
  cancellingId: string | number | null = null;
  reservationToCancel: Reservation | null = null;
  private destroyed = false;
  get activeReservations(): Reservation[] { return this.reservations.filter(item => ['CONFIRMED', 'IN_PROGRESS'].includes(item.statut)); }
  get pastReservations(): Reservation[] { return this.reservations.filter(item => !['CONFIRMED', 'IN_PROGRESS'].includes(item.statut)); }
  ngOnInit(): void { void this.loadReservations(); }
  ngOnDestroy(): void { this.destroyed = true; }
  formatDate = formatDate;
  formatMoney = formatMoney;
  statusLabel(status: string): string { return getReservationStatusInfo(status).label; }
  statusClass(status: string): string {
    switch (status) { case 'CONFIRMED': return 'bg-sky-50 text-sky-800'; case 'IN_PROGRESS': return 'bg-amber-50 text-amber-900'; case 'COMPLETED': return 'bg-emerald-50 text-emerald-800'; case 'CANCELLED': return 'bg-slate-100 text-slate-700'; case 'EXPIRED': return 'bg-rose-50 text-rose-800'; default: return 'bg-slate-100 text-slate-700'; }
  }
  paymentMessage(item: Reservation): string {
    if (item.statut === 'CANCELLED') return 'Paiement conservé, sans remboursement';
    if (item.extraPaid === null || item.extraPaid === undefined) return 'Complément à calculer au départ';
    return `Complément payé : ${formatMoney(item.extraPaid, item.currency)}`;
  }
  canCancel(item: Reservation): boolean { return item.statut === 'CONFIRMED' && new Date(item.debutPrevu) > new Date(); }
  askCancel(item: Reservation): void { this.reservationToCancel = item; }

  async loadReservations(page = this.page): Promise<void> {
    const revision = sessionRevision();
    this.page = Math.max(0, page);
    this.loading = true;
    this.errorMessage = '';
    try {
      const data = await api(`/api/reservations/me?page=${this.page}&size=${this.pageSize}`);
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.reservations = Array.isArray(data?.items) ? data.items : [];
      this.page = Number(data?.page || 0);
      this.total = Number(data?.total || 0);
      this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize));
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger vos réservations.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.loading = false; }
  }

  async cancelReservation(): Promise<void> {
    const reservation = this.reservationToCancel;
    if (!reservation || !this.canCancel(reservation)) return;
    const revision = sessionRevision();
    this.cancellingId = reservation.id;
    try {
      await api(`/api/reservations/${encodeURIComponent(reservation.id)}/cancel`, { method: 'POST' });
      assertCurrentSession(revision);
      this.reservationToCancel = null;
      showToast('Réservation annulée avec succès.', 'success');
      await this.loadReservations(this.page);
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible d’annuler cette réservation.');
    } finally { this.cancellingId = null; }
  }
}
