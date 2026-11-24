import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPageBannerComponent } from './admin-page-banner.component';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { getPlaceStatusInfo } from '../../../js/ui/labels.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';

type Place = { id: string | number; numero: string; statut: string };

@Component({
  selector: 'parking-admin-places',
  standalone: true,
  imports: [FormsModule, AdminPageBannerComponent],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <parking-admin-banner title="Places du parking" description="Gérez la disponibilité et la mise hors service des places." code="01">
        <button banner-action class="min-h-10 rounded-lg border border-white/15 bg-[#fcfdff]/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-[#fcfdff]/10 disabled:opacity-60" type="button" [disabled]="loading" (click)="loadPlaces()">↻ {{ loading ? 'Actualisation…' : 'Actualiser' }}</button>
      </parking-admin-banner>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section class="space-y-4" aria-label="Places du parking">
          <div class="flex items-center justify-between rounded-xl border border-[#d6dee8] bg-[#fcfdff] px-4 py-3"><div><h2 class="m-0 text-sm font-semibold text-slate-800">Liste des places</h2><p class="mb-0 mt-1 text-xs text-slate-500" aria-live="polite">{{ statusMessage }}</p></div><span class="rounded-full bg-[#eff9d9] px-3 py-1 text-xs font-semibold text-[#405624]">{{ places.length }} au total</span></div>

          @if (loading && places.length === 0) {
            <div class="rounded-xl border border-[#d6dee8] bg-[#fcfdff] p-8 text-center text-sm text-slate-500" role="status">Chargement des places…</div>
          } @else if (errorMessage) {
            <div class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900" role="alert">{{ errorMessage }}</div>
          } @else if (places.length === 0) {
            <div class="rounded-xl border border-dashed border-[#cbd5df] bg-[#fcfdff] p-8 text-center"><p class="mb-1 font-semibold text-slate-800">Aucune place enregistrée</p><p class="m-0 text-sm text-slate-500">Ajoutez votre première place avec le formulaire.</p></div>
          } @else {
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              @for (place of places; track place.id) {
                <article class="flex min-h-32 flex-col justify-between gap-4 rounded-xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm">
                  <div class="flex items-start justify-between gap-2"><div><p class="m-0 text-[0.65rem] font-bold tracking-widest text-slate-400">EMPLACEMENT</p><h3 class="mb-0 mt-1 text-xl font-bold text-slate-900">{{ place.numero }}</h3></div><span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="statusClass(place.statut)">{{ placeStatus(place.statut) }}</span></div>
                  @if (place.statut === 'LIBRE') {
                    <button class="min-h-9 self-start rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60" type="button" [disabled]="updatingId === place.id" (click)="setStatus(place, 'HORS_SERVICE')">{{ updatingId === place.id ? 'Mise à jour…' : 'Mettre hors service' }}</button>
                  } @else if (place.statut === 'HORS_SERVICE') {
                    <button class="min-h-9 self-start rounded-lg border border-[#d0e8a5] bg-[#eff9d9] px-3 py-1.5 text-xs font-semibold text-[#263649] hover:bg-[#e2edcf] disabled:opacity-60" type="button" [disabled]="updatingId === place.id" (click)="setStatus(place, 'LIBRE')">{{ updatingId === place.id ? 'Mise à jour…' : 'Remettre en service' }}</button>
                  } @else {
                    <span class="text-xs text-slate-500">Le statut est géré par le stationnement en cours.</span>
                  }
                </article>
              }
            </div>
          }
        </section>

        <aside class="h-fit rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-5 shadow-sm sm:p-6" aria-label="Ajouter une place">
          <span class="grid size-10 place-items-center rounded-xl bg-[#eff9d9] text-lg font-bold text-[#405624]" aria-hidden="true">+</span>
          <h2 class="mb-1 mt-4 text-lg font-bold text-slate-900">Ajouter une place</h2>
          <p class="mb-5 mt-0 text-sm text-slate-500">Saisissez un numéro identifiable pour la retrouver dans le parking.</p>
          <form class="grid gap-3" (ngSubmit)="addPlace()" #placeForm="ngForm">
            <label class="grid gap-1.5 text-sm font-semibold text-slate-700" for="place-number">Numéro de la place
              <input class="h-11 rounded-lg border border-[#cbd5df] bg-[#eef4f8] px-3 text-sm font-normal focus:border-[#527097] focus:outline-none focus:ring-4 focus:ring-[#527097]/10" id="place-number" name="numero" type="text" maxlength="20" placeholder="Ex. A-101" required [(ngModel)]="newNumber">
            </label>
            <p class="m-0 text-xs text-slate-500">20 caractères maximum.</p>
            <button class="mt-2 min-h-11 rounded-lg bg-[#101d2c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#263649] disabled:cursor-not-allowed disabled:opacity-60" type="submit" [disabled]="saving || placeForm.invalid">{{ saving ? 'Ajout en cours…' : 'Ajouter la place' }}</button>
          </form>
        </aside>
      </div>
    </main>
  `
})
export class AdminPlacesComponent implements OnInit, OnDestroy {
  places: Place[] = [];
  newNumber = '';
  loading = true;
  saving = false;
  updatingId: string | number | null = null;
  errorMessage = '';
  statusMessage = 'Chargement des places…';
  private destroyed = false;

  ngOnInit(): void { void this.loadPlaces(); }
  ngOnDestroy(): void { this.destroyed = true; }

  placeStatus(status: string): string { return getPlaceStatusInfo(status).label; }

  statusClass(status: string): string {
    switch (status) {
      case 'LIBRE': return 'bg-[#eff9d9] text-[#405624]';
      case 'OCCUPEE': return 'bg-amber-50 text-amber-800';
      case 'RESERVEE': return 'bg-sky-50 text-sky-800';
      case 'HORS_SERVICE': return 'bg-rose-50 text-rose-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  async loadPlaces(): Promise<void> {
    const revision = sessionRevision();
    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = 'Chargement des places…';
    try {
      const response = await api('/api/places');
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.places = Array.isArray(response) ? response : [];
      this.statusMessage = this.places.length ? `${this.places.length} place(s) enregistrée(s).` : 'Aucune place configurée.';
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.statusMessage = 'Impossible de charger les places.';
      this.errorMessage = error instanceof Error ? error.message : 'Réessayez plus tard.';
    } finally {
      if (!this.destroyed && isCurrentSession(revision)) this.loading = false;
    }
  }

  async addPlace(): Promise<void> {
    const numero = this.newNumber.trim();
    if (!numero) { showErrorToast('Veuillez saisir un numéro de place.'); return; }
    if (numero.length > 20) { showErrorToast('Le numéro de place ne doit pas dépasser 20 caractères.'); return; }
    const revision = sessionRevision();
    this.saving = true;
    try {
      const created = await api('/api/places', { method: 'POST', body: { numero } });
      assertCurrentSession(revision);
      this.newNumber = '';
      showToast(`Place ${created.numero || numero} ajoutée avec succès.`, 'success');
      await this.loadPlaces();
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible d’ajouter cette place.');
    } finally { this.saving = false; }
  }

  async setStatus(place: Place, statut: 'LIBRE' | 'HORS_SERVICE'): Promise<void> {
    const revision = sessionRevision();
    this.updatingId = place.id;
    try {
      await api(`/api/places/${encodeURIComponent(place.id)}/statut`, { method: 'PATCH', body: { statut } });
      assertCurrentSession(revision);
      showToast(statut === 'LIBRE' ? `Place ${place.numero} remise en service.` : `Place ${place.numero} mise hors service.`, 'success');
      await this.loadPlaces();
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible de modifier cette place.');
    } finally { this.updatingId = null; }
  }
}
