import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { formatDate, formatMoney, toLocalIsoString } from '../../../js/ui/formatters.js';
import { getReservationStatusInfo } from '../../../js/ui/labels.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';

type Place = { id: string; numero: string; statut: string };
type Operation = {
  id: string | number; placeId: string | number; conducteurId: string | number; statut: string;
  debutPrevu: string; finPrevue: string; montantEstime?: number; montantFinal?: number | null;
  currency?: string; arriveeReelle?: string; departReel?: string; paymentStatus?: string;
  paymentReference?: string; bookingPaid?: number | null; extraPaid?: number | null;
  extraPaymentReference?: string; placesSyncPending?: boolean;
};

function startOfToday(): string {
  const now = new Date();
  return toLocalIsoString(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}
function endOfTomorrow(): string {
  const now = new Date();
  return toLocalIsoString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59));
}

@Component({
  selector: 'parking-agent-operations',
  standalone: true,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header class="relative isolate overflow-hidden rounded-[1.75rem] bg-[#101d2c] px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-8"><span class="absolute -right-20 -top-32 -z-10 size-80 rounded-full border-[42px] border-white/[0.04]" aria-hidden="true"></span><span class="absolute -bottom-24 right-28 -z-10 size-52 rounded-full bg-[#c5f277]/[0.08] blur-2xl" aria-hidden="true"></span><div class="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><p class="mb-3 flex items-center gap-2 text-[0.67rem] font-bold tracking-[0.18em] text-[#c5f277]"><span class="size-2 rounded-full bg-[#c5f277]"></span> PARKING INTELLIGENT <span class="text-white/35">/</span> ESPACE AGENT</p><h1 class="mb-2 mt-0 text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">Le terrain,<br><span class="text-[#c5f277]">en temps réel.</span></h1><p class="m-0 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Suivez l’occupation, accueillez les arrivées et clôturez les stationnements.</p></div><span class="flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 pr-5"><span class="grid size-11 place-items-center rounded-xl bg-[#c5f277] text-sm font-black text-[#101d2c]">AG</span><span><strong class="block text-sm text-white">Centre des opérations</strong><small class="text-xs text-slate-300">{{ places.length }} places suivies</small></span></span></div></header>

      <form class="grid gap-3 rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5" aria-label="Période des opérations" (ngSubmit)="applyFilters()">
        <div class="sm:col-span-3"><p class="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-[#527097]">PÉRIODE À CONSULTER</p><p class="mb-0 mt-1 text-sm text-slate-500">Filtrez les arrivées et départs par créneau.</p></div>
        <label class="grid gap-1.5 text-xs font-semibold text-[#263649]">Du<input class="h-11 rounded-lg border border-[#d6dee8] bg-white px-3 text-sm font-normal text-[#101d2c] focus:border-[#527097] focus:outline-none focus:ring-4 focus:ring-[#527097]/10" type="datetime-local" name="start" required [(ngModel)]="startLocal"></label>
        <label class="grid gap-1.5 text-xs font-semibold text-[#263649]">Au<input class="h-11 rounded-lg border border-[#d6dee8] bg-white px-3 text-sm font-normal text-[#101d2c] focus:border-[#527097] focus:outline-none focus:ring-4 focus:ring-[#527097]/10" type="datetime-local" name="end" required [(ngModel)]="endLocal"></label>
        <button class="min-h-11 rounded-lg bg-[#c5f277] px-5 py-2.5 text-sm font-bold text-[#101d2c] transition hover:bg-[#d2fa8d] disabled:opacity-50" type="submit" [disabled]="loadingOperations">{{ loadingOperations ? 'Actualisation…' : 'Afficher la période →' }}</button>
      </form>

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section class="min-w-0 overflow-hidden rounded-[1.5rem] border border-[#263649] bg-[#172638] p-4 text-white shadow-xl shadow-slate-900/10 sm:p-6" aria-label="Occupation du parking">
          <div class="mb-5"><p class="m-0 text-[0.62rem] font-bold tracking-[0.18em] text-[#c5f277]">VUE DU PARKING <span class="text-white/35">/ NIVEAU 01</span></p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-white">Occupation actuelle</h2><p class="mb-0 mt-1 text-xs text-slate-300" role="status">{{ mapMessage }}</p></div>
          @if (placesError) { <p class="rounded-lg border border-rose-300/30 bg-rose-950/40 p-3 text-sm text-rose-100" role="alert">{{ placesError }}</p> }
          @if (placesLoading) { <div class="rounded-xl bg-white/[0.05] p-7 text-center text-sm text-slate-300" role="status">Chargement des places…</div> }
          @else if (places.length === 0) { <div class="rounded-xl border border-dashed border-white/20 p-7 text-center text-sm text-slate-300">Aucune place configurée.</div> }
          @else { <div class="grid grid-cols-2 gap-2.5 rounded-2xl border border-white/[0.06] bg-[#101d2c] p-3 sm:grid-cols-3 sm:gap-3 sm:p-4" aria-label="Occupation actuelle">@for (place of places; track place.id) {
            <button class="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center transition hover:-translate-y-0.5 disabled:cursor-default sm:min-h-28" [class]="placeClass(place)" [disabled]="!linkedOperation(place)" type="button" [attr.aria-label]="'Place ' + place.numero + ' : ' + placeState(place)" (click)="focusOperation(place)"><span class="text-[0.58rem] font-black tracking-widest opacity-80">PARK</span><strong class="text-lg font-bold">{{ place.numero }}</strong><span class="text-[0.65rem] font-semibold">{{ placeState(place) }}</span></button>
          }</div> }
          <ul class="m-0 mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-[0.68rem] text-slate-300" aria-label="Légende"><li class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-[#c5f277]"></i>Libre</li><li class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-[#f4c578]"></i>Arrivée attendue</li><li class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-[#6bb5ff]"></i>Occupée</li><li class="flex items-center gap-1.5"><i class="size-2 rounded-full bg-[#fb7185]"></i>Hors service</li></ul>
          <p class="mb-0 mt-4 text-xs leading-5 text-slate-400">Le plan montre l’occupation actuelle et les arrivées attendues sur la page consultée.</p>
        </section>

        <section class="min-w-0 rounded-[1.5rem] border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5" aria-label="Réservations de la période">
          <div class="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p class="m-0 text-[0.62rem] font-bold tracking-[0.16em] text-[#527097]">SUIVI OPÉRATIONNEL</p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-[#101d2c]">Réservations de la période</h2><p class="mb-0 mt-1 text-xs text-slate-500" role="status">{{ operationsMessage }}</p></div><span class="rounded-full bg-[#eef4f8] px-3 py-1.5 text-xs font-bold text-[#263649]">{{ total }} au total</span></div>
          @if (operationsError) { <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">{{ operationsError }}</p> }
          @if (loadingOperations) { <div class="rounded-xl bg-[#eef4f8] p-8 text-center text-sm text-slate-500" role="status">Chargement des réservations…</div> }
          @else if (operations.length === 0) { <div class="rounded-xl border border-dashed border-[#cbd5df] p-8 text-center"><span class="mx-auto grid size-10 place-items-center rounded-xl bg-[#101d2c] text-sm font-black text-[#c5f277]">✓</span><p class="mb-0 mt-3 text-sm font-semibold text-[#263649]">Aucune réservation sur cette période</p></div> }
          @else { <div class="space-y-3">@for (operation of operations; track operation.id) {
            <article class="scroll-mt-6 rounded-xl border border-[#d6dee8] border-l-4 border-l-[#c5f277] bg-white p-4 shadow-sm" [attr.id]="'operation-' + operation.id" tabindex="-1">
              <div class="flex flex-wrap items-start justify-between gap-2"><div><p class="m-0 text-[0.62rem] font-bold tracking-widest text-[#718399]">RÉSERVATION N°{{ operation.id }}</p><h3 class="mb-0 mt-1 text-base font-bold text-[#101d2c]">Place {{ placeNumber(operation.placeId) }}</h3></div><span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="statusClass(operation.statut)">{{ statusLabel(operation.statut) }}</span></div>
              <p class="mb-0 mt-2 text-xs text-slate-600">{{ formatDate(operation.debutPrevu) }} <span class="text-[#9aabba]">→</span> {{ formatDate(operation.finPrevue) }}</p>
              <div class="mt-3 grid gap-2 border-t border-[#e5eaf0] pt-3 text-xs text-slate-600 sm:grid-cols-2"><p class="m-0"><span class="font-semibold text-[#263649]">Conducteur</span> · n°{{ operation.conducteurId }}</p><p class="m-0"><span class="font-semibold text-[#263649]">Arrivée</span> · {{ operation.arriveeReelle ? formatDate(operation.arriveeReelle) : 'Non enregistrée' }}</p><p class="m-0"><span class="font-semibold text-[#263649]">Départ</span> · {{ operation.departReel ? formatDate(operation.departReel) : 'Non enregistré' }}</p><p class="m-0"><span class="font-semibold text-[#263649]">Estimation</span> · {{ formatMoney(operation.montantEstime, operation.currency) }}{{ operation.montantFinal !== null && operation.montantFinal !== undefined ? ' · final ' + formatMoney(operation.montantFinal, operation.currency) : '' }}</p></div>
              @if (operation.paymentStatus === 'PAID') { <p class="mb-0 mt-2 text-xs text-slate-500">Paiement simulé enregistré{{ operation.paymentReference ? ' · ' + operation.paymentReference : '' }}</p> }
              @if (operation.bookingPaid !== null && operation.bookingPaid !== undefined) { <p class="mb-0 mt-2 text-xs text-slate-500">Créneau payé : {{ formatMoney(operation.bookingPaid, operation.currency) }} · {{ paymentMessage(operation) }}</p> }
              @if (operation.extraPaymentReference) { <p class="mb-0 mt-2 text-xs text-slate-500">Paiement complémentaire simulé : {{ operation.extraPaymentReference }}</p> }
              @if (operation.placesSyncPending) { <p class="mb-0 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Mise à jour de la place en attente. Actualisez pour vérifier la synchronisation.</p> }
              @if (operation.statut === 'CONFIRMED') { <button class="mt-3 min-h-10 rounded-lg bg-[#c5f277] px-4 py-2 text-sm font-bold text-[#101d2c] hover:bg-[#d2fa8d] disabled:opacity-50" type="button" [disabled]="actionId === operation.id" (click)="registerArrival(operation)">{{ actionId === operation.id ? 'Enregistrement…' : 'Enregistrer l’arrivée →' }}</button> }
              @else if (operation.statut === 'IN_PROGRESS') { <button class="mt-3 min-h-10 rounded-lg bg-[#101d2c] px-4 py-2 text-sm font-bold text-white hover:bg-[#263649] disabled:opacity-50" type="button" [disabled]="actionId === operation.id" (click)="askDeparture(operation)">{{ actionId === operation.id ? 'Enregistrement…' : 'Enregistrer le départ →' }}</button> }
            </article>
          }</div> }
          @if (!loadingOperations) { <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5eaf0] pt-4"><p class="m-0 text-xs text-slate-500">Page {{ currentPage + 1 }} · {{ total }} réservation(s)</p><div class="flex gap-2"><button class="min-h-9 rounded-lg border border-[#cbd5df] bg-white px-3 text-xs font-semibold text-[#263649] hover:bg-[#eef4f8] disabled:opacity-40" type="button" [disabled]="currentPage === 0" (click)="loadOperations(currentPage - 1)">← Précédent</button><button class="min-h-9 rounded-lg border border-[#cbd5df] bg-white px-3 text-xs font-semibold text-[#263649] hover:bg-[#eef4f8] disabled:opacity-40" type="button" [disabled]="(currentPage + 1) * pageSize >= total" (click)="loadOperations(currentPage + 1)">Suivant →</button></div></div> }
        </section>
      </div>
    </main>

    @if (departureToConfirm) { <div class="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" (click)="departureToConfirm = null"><section class="w-full max-w-md rounded-2xl bg-[#fcfdff] p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="departure-title" (click)="$event.stopPropagation()"><p class="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-[#527097]">CONFIRMATION OPÉRATIONNELLE</p><h2 class="mb-2 mt-1 text-xl font-bold text-[#101d2c]" id="departure-title">Enregistrer le départ ?</h2><p class="m-0 text-sm leading-6 text-slate-600">Confirmer le départ réel du véhicule de la place {{ placeNumber(departureToConfirm.placeId) }} et le règlement simulé.</p><div class="mt-5 flex justify-end gap-2"><button class="min-h-10 rounded-lg border border-[#cbd5df] bg-white px-4 text-sm font-semibold text-[#263649]" type="button" (click)="departureToConfirm = null">Retour</button><button class="min-h-10 rounded-lg bg-[#101d2c] px-4 text-sm font-bold text-white hover:bg-[#263649] disabled:opacity-50" type="button" [disabled]="actionId !== null" (click)="registerDeparture()">{{ actionId !== null ? 'Enregistrement…' : 'Confirmer le départ' }}</button></div></section></div> }
  `
})
export class AgentOperationsComponent implements OnInit, OnDestroy {
  readonly pageSize = 20;
  places: Place[] = [];
  operations: Operation[] = [];
  currentPage = 0;
  total = 0;
  startLocal = startOfToday();
  endLocal = endOfTomorrow();
  placesLoading = true;
  loadingOperations = true;
  placesError = '';
  operationsError = '';
  mapMessage = 'Chargement des places…';
  operationsMessage = 'Chargement…';
  actionId: string | number | null = null;
  departureToConfirm: Operation | null = null;
  private destroyed = false;

  ngOnInit(): void { void Promise.all([this.loadPlaces(), this.loadOperations(0)]); }
  ngOnDestroy(): void { this.destroyed = true; }
  formatDate = formatDate;
  formatMoney = formatMoney;

  statusLabel(status: string): string { return getReservationStatusInfo(status).label; }
  statusClass(status: string): string {
    switch (status) { case 'CONFIRMED': return 'bg-[#eef4f8] text-[#385a7b]'; case 'IN_PROGRESS': return 'bg-amber-50 text-amber-900'; case 'COMPLETED': return 'bg-[#eff9d9] text-[#405624]'; case 'CANCELLED': return 'bg-slate-100 text-slate-700'; case 'EXPIRED': return 'bg-rose-50 text-rose-800'; default: return 'bg-slate-100 text-slate-700'; }
  }
  placeNumber(placeId: string | number): string { return this.places.find(place => String(place.id) === String(placeId))?.numero || String(placeId); }
  linkedOperation(place: Place): Operation | undefined {
    const matching = this.operations.filter(operation => String(operation.placeId) === String(place.id));
    const active = matching.find(operation => operation.statut === 'IN_PROGRESS');
    const waiting = matching.find(operation => operation.statut === 'CONFIRMED' && new Date(operation.finPrevue).getTime() > Date.now());
    return active || waiting;
  }
  placeState(place: Place): string {
    if (place.statut === 'HORS_SERVICE') return 'Hors service';
    if (place.statut === 'OCCUPEE') return 'Occupée';
    const linked = this.linkedOperation(place);
    if (linked?.statut === 'IN_PROGRESS') return 'Arrivée enregistrée';
    if (linked) return 'Arrivée attendue';
    if (place.statut === 'RESERVEE') return 'Réservée';
    return 'Libre';
  }
  placeClass(place: Place): string {
    switch (this.placeState(place)) {
      case 'Hors service': return 'border-[#59616b] bg-[repeating-linear-gradient(135deg,#303b47_0px,#303b47_8px,#26313c_8px,#26313c_16px)] text-slate-300';
      case 'Occupée': return 'border-[#6bb5ff] bg-[#6bb5ff] text-[#101d2c]';
      case 'Arrivée enregistrée': case 'Arrivée attendue': case 'Réservée': return 'border-[#846b3d] bg-[#352f25] text-[#f4c578] hover:border-[#f4c578]';
      default: return 'border-[#647b63] bg-[#263b37] text-[#d2fa8d]';
    }
  }
  paymentMessage(item: Operation): string {
    if (item.statut === 'CANCELLED') return 'Paiement conservé, sans remboursement';
    if (item.extraPaid === null || item.extraPaid === undefined) return 'Complément à calculer au départ';
    return `Complément payé : ${formatMoney(item.extraPaid, item.currency)}`;
  }
  focusOperation(place: Place): void {
    const operation = this.linkedOperation(place);
    if (!operation) return;
    const card = document.getElementById(`operation-${operation.id}`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    card?.focus({ preventScroll: true });
  }

  async loadPlaces(): Promise<void> {
    const revision = sessionRevision();
    this.placesLoading = true;
    this.placesError = '';
    this.mapMessage = 'Chargement des places…';
    try {
      const list = await api('/api/places');
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.places = Array.isArray(list) ? list.map((place: Place) => ({ ...place, id: String(place.id) })) : [];
      this.updateMapMessage();
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.placesError = error instanceof Error ? error.message : 'Impossible de charger les places.';
      this.mapMessage = 'Le plan du parking est indisponible.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.placesLoading = false; }
  }

  private updateMapMessage(): void {
    const occupied = this.places.filter(place => place.statut === 'OCCUPEE').length;
    this.mapMessage = this.places.length ? `${occupied} occupée(s) · ${this.places.length} place(s) au total` : 'Aucune place configurée.';
  }

  async applyFilters(): Promise<void> {
    const start = new Date(this.startLocal);
    const end = new Date(this.endLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      showErrorToast('Veuillez sélectionner un intervalle de dates valide (fin après le début).');
      return;
    }
    this.currentPage = 0;
    await Promise.all([this.loadPlaces(), this.loadOperations(0)]);
  }

  async loadOperations(page = this.currentPage): Promise<void> {
    const start = new Date(this.startLocal);
    const end = new Date(this.endLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      showErrorToast('Veuillez sélectionner un intervalle de dates valide (fin après le début).');
      this.operationsError = 'Période invalide.';
      this.loadingOperations = false;
      return;
    }
    const revision = sessionRevision();
    this.currentPage = Math.max(0, page);
    this.loadingOperations = true;
    this.operationsError = '';
    this.operationsMessage = 'Chargement…';
    try {
      const query = new URLSearchParams({ page: String(this.currentPage), size: String(this.pageSize), start: start.toISOString(), end: end.toISOString() });
      const data = await api('/api/reservations/operations?' + query);
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.operations = Array.isArray(data?.items) ? data.items : [];
      this.currentPage = Number(data?.page || 0);
      this.total = Number(data?.total || 0);
      this.operationsMessage = this.operations.length ? `${this.total} réservation(s) sur la période.` : 'Aucune réservation sur cette période.';
      this.updateMapMessage();
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.operations = [];
      this.operationsError = error instanceof Error ? error.message : 'Impossible de charger les réservations pour cette période.';
      this.operationsMessage = 'Échec du chargement.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.loadingOperations = false; }
  }

  async registerArrival(operation: Operation): Promise<void> {
    const revision = sessionRevision();
    this.actionId = operation.id;
    try {
      await api(`/api/reservations/${encodeURIComponent(operation.id)}/arrival`, { method: 'POST' });
      assertCurrentSession(revision);
      showToast(`Arrivée enregistrée pour la place ${this.placeNumber(operation.placeId)}.`, 'success');
      await Promise.all([this.loadPlaces(), this.loadOperations()]);
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible d’enregistrer cette arrivée.');
    } finally { this.actionId = null; }
  }

  askDeparture(operation: Operation): void { this.departureToConfirm = operation; }

  async registerDeparture(): Promise<void> {
    const operation = this.departureToConfirm;
    if (!operation) return;
    const revision = sessionRevision();
    this.actionId = operation.id;
    try {
      const result = await api(`/api/reservations/${encodeURIComponent(operation.id)}/departure`, { method: 'POST' });
      assertCurrentSession(revision);
      const extra = result?.extraPaid && result.extraPaid > 0 ? ` (dépassement facturé : ${formatMoney(result.extraPaid, result.currency)})` : '';
      showToast(`Départ enregistré pour la place ${this.placeNumber(operation.placeId)}${extra}.`, 'success');
      this.departureToConfirm = null;
      await Promise.all([this.loadPlaces(), this.loadOperations()]);
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible d’enregistrer ce départ.');
    } finally { this.actionId = null; }
  }
}
