import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { formatMoney, toLocalIsoString } from '../../../js/ui/formatters.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';
import { navigate, ROUTES } from '../../../js/router.js';

type Place = { id: string; numero: string; statut: string };
type BookingPayload = { placeId: string; typeVehicule: string; debutPrevu: string; finPrevue: string };
let bookingAttempt: { fingerprint: string; key: string } | null = null;

function defaultStart(): string {
  const now = new Date();
  return toLocalIsoString(new Date(Math.ceil((now.getTime() + 60_000) / 900_000) * 900_000));
}

@Component({
  selector: 'parking-driver-reserve',
  standalone: true,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header class="relative isolate overflow-hidden rounded-[1.75rem] bg-[#101d2c] px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-9">
        <span class="absolute -right-20 -top-32 -z-10 size-80 rounded-full border-[42px] border-white/[0.04]" aria-hidden="true"></span><span class="absolute -bottom-28 right-24 -z-10 size-56 rounded-full bg-[#c5f277]/[0.08] blur-2xl" aria-hidden="true"></span>
        <div class="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between"><div class="max-w-2xl"><p class="mb-3 flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.18em] text-[#c5f277]"><span class="size-2 rounded-full bg-[#c5f277]"></span> PARKING INTELLIGENT <span class="text-white/35">/</span> ESPACE CONDUCTEUR</p><h1 class="mb-3 mt-0 max-w-xl text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">Votre place.<br><span class="text-[#c5f277]">À votre heure.</span></h1><p class="m-0 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">Planifiez votre arrivée, choisissez votre emplacement et confirmez en quelques secondes.</p></div><div class="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 pr-5 backdrop-blur"><span class="grid size-11 place-items-center rounded-xl bg-[#c5f277] text-lg font-black text-[#101d2c]">01</span><span><strong class="block text-sm text-white">Réservation rapide</strong><small class="text-xs text-slate-300">Paiement simulé sécurisé</small></span></div></div>
        <div class="mt-8 grid max-w-xl grid-cols-3 border-t border-white/10 pt-4 text-[0.65rem] font-semibold tracking-wide sm:text-xs"><span class="text-[#c5f277]">01 <span class="ml-1 text-white">Choisir un créneau</span></span><span class="text-white/35">02 <span class="ml-1">Choisir une place</span></span><span class="text-white/35">03 <span class="ml-1">Confirmer</span></span></div>
      </header>
      <div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section class="min-w-0 overflow-hidden rounded-[1.5rem] border border-[#263649] bg-[#172638] p-4 text-white shadow-xl shadow-slate-900/10 sm:p-6" aria-label="Plan de réservation">
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p class="m-0 text-[0.62rem] font-bold tracking-[0.18em] text-[#c5f277]">PLAN INTERACTIF <span class="text-white/35">/ NIVEAU 01</span></p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-white">Choisissez votre emplacement</h2><p class="mb-0 mt-1 text-xs text-slate-300" role="status">{{ placesMessage }}</p></div><button class="min-h-9 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50" type="button" [disabled]="placesLoading" (click)="loadPlaces()">{{ placesLoading ? 'Actualisation…' : '↻ Actualiser' }}</button></div>
          @if (placesError) { <div class="rounded-lg border border-rose-300/30 bg-rose-950/40 p-3 text-sm text-rose-100" role="alert">{{ placesError }}</div> }
          @if (places.length === 0 && !placesLoading && !placesError) { <div class="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-slate-300">Aucune place n’est configurée pour le moment.</div> }
          <div class="grid grid-cols-2 gap-2.5 rounded-2xl border border-white/[0.06] bg-[#101d2c] p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 xl:grid-cols-4" role="group" aria-label="Places du parking">
            @for (place of places; track place.id) {
              <button class="group relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-32" [class]="tileClass(place)" [disabled]="place.statut === 'HORS_SERVICE' || availability.get(place.id) === false" type="button" [attr.aria-pressed]="selectedPlaceId === place.id" [attr.aria-label]="'Place ' + place.numero + ' : ' + placeState(place)" (click)="selectPlace(place)">
                <span class="grid size-10 place-items-center rounded-lg border border-current/20 text-[0.58rem] font-black tracking-widest opacity-80">P</span><strong class="text-lg font-bold tracking-tight">{{ place.numero }}</strong><span class="flex items-center gap-1.5 text-[0.67rem] font-semibold"><i class="size-1.5 rounded-full bg-current"></i>{{ placeState(place) }}</span>
              </button>
            }
          </div>
          <ul class="m-0 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-300" aria-label="Légende"><li class="flex items-center gap-2"><i class="size-2.5 rounded-full bg-[#c5f277]"></i>Disponible</li><li class="flex items-center gap-2"><i class="size-2.5 rounded-full bg-[#6bb5ff]"></i>Sélectionnée</li><li class="flex items-center gap-2"><i class="size-2.5 rounded-full bg-[#fb7185]"></i>Indisponible</li><li class="flex items-center gap-2"><i class="size-2.5 rounded-full bg-slate-500"></i>À vérifier</li></ul>
        </section>

        <section class="rounded-[1.5rem] border border-slate-200 bg-[#fcfdff] p-5 shadow-lg shadow-slate-900/[0.04] sm:p-6" aria-labelledby="booking-title">
          <div class="mb-5"><p class="m-0 text-[0.65rem] font-bold tracking-[0.18em] text-[#527097]">02 <span class="ml-1 text-slate-400">/ VOTRE CRÉNEAU</span></p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-[#101d2c]" id="booking-title">Quand souhaitez-vous venir ?</h2></div>
          <form class="grid gap-4" (ngSubmit)="book()">
            <label class="grid gap-1.5 text-sm font-semibold text-[#263649]">Début prévu<input class="h-11 rounded-lg border border-[#d6dee8] bg-white px-3 text-sm font-normal text-[#101d2c] focus:border-[#527097] focus:outline-none focus:ring-4 focus:ring-[#527097]/10" type="datetime-local" name="start" required [(ngModel)]="startLocal" (ngModelChange)="onDatesChanged()"></label>
            <label class="grid gap-1.5 text-sm font-semibold text-[#263649]">Fin prévue<input class="h-11 rounded-lg border border-[#d6dee8] bg-white px-3 text-sm font-normal text-[#101d2c] focus:border-[#527097] focus:outline-none focus:ring-4 focus:ring-[#527097]/10" type="datetime-local" name="end" required [(ngModel)]="endLocal" (ngModelChange)="onDatesChanged()"></label>
            <fieldset class="grid gap-2"><legend class="mb-1 text-xs font-bold tracking-wide text-[#527097]">DURÉE RAPIDE</legend><div class="grid grid-cols-4 gap-2">@for (hours of [1, 2, 3, 4]; track hours) { <button class="min-h-9 rounded-lg border border-[#d6dee8] bg-white text-xs font-semibold text-[#263649] transition hover:border-[#101d2c] hover:bg-[#f1f5f8]" type="button" (click)="setDuration(hours)">{{ hours }} h</button> }</div></fieldset>
            <label class="grid gap-1.5 text-sm font-semibold text-[#263649]">Type de véhicule<input class="h-11 rounded-lg border border-[#d6dee8] bg-white px-3 text-sm font-normal uppercase text-[#101d2c] focus:border-[#527097] focus:outline-none focus:ring-4 focus:ring-[#527097]/10" type="text" name="vehicle" maxlength="32" pattern="[A-Za-z0-9_-]{1,32}" required [(ngModel)]="vehicleType" (ngModelChange)="clearQuote()"><span class="text-xs font-normal text-slate-500">Ex. VOITURE, MOTO ou UTILITAIRE.</span></label>
            <div class="grid gap-2 rounded-xl bg-[#eef4f8] p-4"><div class="flex items-center justify-between gap-3 text-sm"><span class="text-slate-600">Place sélectionnée</span><strong class="text-[#101d2c]">{{ selectedPlace?.numero || '—' }}</strong></div><div class="flex items-center justify-between gap-3 border-t border-[#d6dee8] pt-2 text-sm"><span class="text-slate-600">Montant estimé</span><strong class="text-lg font-bold text-[#101d2c]">{{ quoteAmount || '—' }}</strong></div></div>
            <p class="m-0 min-h-5 text-xs text-slate-600" role="status">{{ quoteMessage }}</p>
            <div class="grid gap-2 sm:grid-cols-2"><button class="min-h-11 rounded-lg border border-[#b9c8d8] bg-white px-4 py-2.5 text-sm font-semibold text-[#263649] transition hover:bg-[#eef4f8] disabled:cursor-not-allowed disabled:opacity-50" type="button" [disabled]="!canEstimate || estimating || booking" (click)="estimate()">{{ estimating ? 'Calcul du devis…' : 'Calculer le prix' }}</button><button class="min-h-11 rounded-lg bg-[#c5f277] px-4 py-2.5 text-sm font-bold text-[#101d2c] transition hover:bg-[#d2fa8d] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500" type="submit" [disabled]="!canBook || booking">{{ booking ? 'Réservation…' : 'Confirmer la réservation' }}</button></div>
            <p class="m-0 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Le créneau est payé à la réservation. L’annulation ne donne pas lieu à un remboursement. Seul le temps supplémentaire est facturé au départ.</p>
          </form>
        </section>
      </div>
    </main>
  `
})
export class DriverReserveComponent implements OnInit, OnDestroy {
  places: Place[] = [];
  availability = new Map<string, boolean>();
  selectedPlaceId = '';
  startLocal = defaultStart();
  endLocal = toLocalIsoString(new Date(new Date(this.startLocal).getTime() + 7_200_000));
  vehicleType = 'VOITURE';
  placesMessage = 'Chargement des places…';
  placesError = '';
  quoteMessage = '';
  quoteAmount = '';
  placesLoading = true;
  estimating = false;
  booking = false;
  private availabilityTimer?: ReturnType<typeof setTimeout>;
  private mapRevision = 0;
  private quoteRevision = 0;
  private quotedFingerprint = '';
  private destroyed = false;

  get selectedPlace(): Place | undefined { return this.places.find(place => place.id === this.selectedPlaceId); }
  get canEstimate(): boolean { return Boolean(this.payloadOrNull() && this.selectedPlaceId && this.availability.get(this.selectedPlaceId) !== false); }
  get canBook(): boolean { return this.canEstimate && Boolean(this.quotedFingerprint && this.quotedFingerprint === this.fingerprint()); }

  ngOnInit(): void { void this.loadPlaces(); }
  ngOnDestroy(): void { this.destroyed = true; clearTimeout(this.availabilityTimer); this.mapRevision++; this.quoteRevision++; }

  tileClass(place: Place): string {
    if (place.statut === 'HORS_SERVICE' || this.availability.get(place.id) === false) return 'border-[#59616b] bg-[repeating-linear-gradient(135deg,#303b47_0px,#303b47_8px,#26313c_8px,#26313c_16px)] text-slate-300';
    if (place.id === this.selectedPlaceId) return 'border-[#6bb5ff] bg-[#6bb5ff] text-[#101d2c] shadow-lg shadow-[#6bb5ff]/20';
    if (this.availability.get(place.id) === true) return 'border-[#647b63] bg-[#263b37] text-[#d2fa8d] hover:border-[#c5f277]';
    return 'border-[#465363] bg-[#202e3d] text-slate-200 hover:border-[#8ea0b2]';
  }
  placeState(place: Place): string {
    if (place.statut === 'HORS_SERVICE') return 'Hors service';
    const available = this.availability.get(place.id);
    if (available === false) return 'Indisponible';
    if (place.id === this.selectedPlaceId) return 'Sélectionnée';
    return available === true ? 'Disponible' : 'À vérifier';
  }
  selectPlace(place: Place): void {
    if (place.statut === 'HORS_SERVICE' || this.availability.get(place.id) === false) return;
    this.selectedPlaceId = place.id;
    this.clearQuote();
  }
  onDatesChanged(): void { this.clearQuote(); this.scheduleAvailability(); }
  setDuration(hours: number): void {
    const start = new Date(this.startLocal);
    if (Number.isNaN(start.getTime())) return;
    this.endLocal = toLocalIsoString(new Date(start.getTime() + hours * 3_600_000));
    this.onDatesChanged();
  }
  clearQuote(): void {
    this.quoteRevision++;
    this.quotedFingerprint = '';
    this.quoteAmount = '';
    this.quoteMessage = '';
  }
  formatMoney = formatMoney;

  private payloadOrNull(): BookingPayload | null {
    const start = new Date(this.startLocal);
    const end = new Date(this.endLocal);
    const now = new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start <= now || end <= start) return null;
    const typeVehicule = this.vehicleType.trim().toUpperCase();
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(typeVehicule)) return null;
    return { placeId: this.selectedPlaceId, typeVehicule, debutPrevu: start.toISOString(), finPrevue: end.toISOString() };
  }
  private fingerprint(): string { const payload = this.payloadOrNull(); return payload ? JSON.stringify(payload) : ''; }

  async loadPlaces(): Promise<void> {
    const revision = sessionRevision();
    this.placesLoading = true;
    this.placesError = '';
    this.placesMessage = 'Chargement des places…';
    try {
      const list = await api('/api/places');
      assertCurrentSession(revision);
      if (this.destroyed) return;
      if (!Array.isArray(list)) throw new Error('Format de places invalide.');
      this.places = list.map((place: Place) => ({ ...place, id: String(place.id) }));
      if (!this.places.some(place => place.id === this.selectedPlaceId)) this.selectedPlaceId = '';
      this.scheduleAvailability();
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.placesError = error instanceof Error ? error.message : 'Impossible de charger les places.';
      this.placesMessage = 'Impossible de charger les places.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.placesLoading = false; }
  }

  private scheduleAvailability(): void {
    clearTimeout(this.availabilityTimer);
    const mapRevision = ++this.mapRevision;
    const session = sessionRevision();
    const dates = this.payloadOrNull();
    this.availability = new Map();
    if (!this.places.length) { this.placesMessage = 'Aucune place à afficher.'; return; }
    if (!dates) { this.placesMessage = 'Choisissez un créneau futur pour vérifier les places.'; return; }
    this.placesMessage = 'Vérification des disponibilités pour ce créneau…';
    this.availabilityTimer = setTimeout(async () => {
      const candidates = this.places.filter(place => place.statut !== 'HORS_SERVICE');
      for (let offset = 0; offset < candidates.length && mapRevision === this.mapRevision && isCurrentSession(session); offset += 6) {
        await Promise.all(candidates.slice(offset, offset + 6).map(async place => {
          try {
            const query = new URLSearchParams({ placeId: place.id, start: dates.debutPrevu, end: dates.finPrevue });
            const result = await api('/api/reservations/availability?' + query);
            if (mapRevision === this.mapRevision && isCurrentSession(session) && typeof result.available === 'boolean') this.availability.set(place.id, result.available);
          } catch { /* La vérification au moment du devis reste la référence. */ }
        }));
        if (mapRevision !== this.mapRevision || !isCurrentSession(session)) return;
      }
      if (mapRevision !== this.mapRevision || this.destroyed) return;
      const availableCount = [...this.availability.values()].filter(Boolean).length;
      this.placesMessage = this.availability.size === candidates.length
        ? `${availableCount} place${availableCount === 1 ? '' : 's'} disponible${availableCount === 1 ? '' : 's'} pour ce créneau.`
        : 'Disponibilité partielle. Les places non vérifiées seront validées au devis.';
    }, 200);
  }

  async estimate(): Promise<void> {
    const payload = this.payloadOrNull();
    if (!payload) { showErrorToast('Vérifiez les dates et le type de véhicule. Le début doit être dans le futur.'); return; }
    if (!payload.placeId) { showErrorToast('Veuillez sélectionner une place disponible sur le plan.'); return; }
    const session = sessionRevision();
    this.estimating = true;
    this.clearQuote();
    const quoteRevision = this.quoteRevision;
    try {
      const availabilityQuery = new URLSearchParams({ placeId: payload.placeId, start: payload.debutPrevu, end: payload.finPrevue });
      const check = await api('/api/reservations/availability?' + availabilityQuery);
      assertCurrentSession(session);
      if (quoteRevision !== this.quoteRevision) return;
      if (!check.available) throw new Error('Cette place est indisponible sur ce créneau.');
      const quote = await api('/api/reservations/quote', { method: 'POST', body: payload });
      assertCurrentSession(session);
      if (quoteRevision !== this.quoteRevision) return;
      this.quotedFingerprint = JSON.stringify(payload);
      this.quoteAmount = `${formatMoney(quote.amount, quote.currency)}`;
      this.quoteMessage = 'Tarif calculé. La place et le prix seront verrouillés lors de la confirmation.';
    } catch (error) {
      if (isCurrentSession(session)) { this.quoteMessage = error instanceof Error ? error.message : 'Impossible de calculer le devis.'; showErrorToast(this.quoteMessage); }
    } finally { if (!this.destroyed && quoteRevision === this.quoteRevision) this.estimating = false; }
  }

  async book(): Promise<void> {
    const payload = this.payloadOrNull();
    if (!payload || !this.canBook) { showErrorToast('Veuillez obtenir un devis actualisé pour cette sélection avant de confirmer.'); return; }
    const fingerprint = JSON.stringify(payload);
    if (!bookingAttempt || bookingAttempt.fingerprint !== fingerprint) bookingAttempt = { fingerprint, key: crypto.randomUUID() };
    const session = sessionRevision();
    this.booking = true;
    try {
      const reservation = await api('/api/reservations', { method: 'POST', body: payload, headers: { 'Idempotency-Key': bookingAttempt.key } });
      assertCurrentSession(session);
      bookingAttempt = null;
      this.clearQuote();
      showToast(`Réservation n°${reservation.id} confirmée avec succès. Paiement simulé enregistré.`, 'success');
      navigate(ROUTES.HISTORY);
    } catch (error) {
      if (isCurrentSession(session)) showErrorToast(error instanceof Error ? error.message : 'La réservation a échoué.');
    } finally { this.booking = false; }
  }
}
