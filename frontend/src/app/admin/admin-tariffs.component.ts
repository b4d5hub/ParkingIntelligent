import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { formatDate, formatMoney } from '../../../js/ui/formatters.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';

type TariffHistoryEntry = { id?: string | number; prixDh: number; valableAPartir?: string; creePar?: string; creeLe?: string };

@Component({
  selector: 'parking-admin-tariffs',
  standalone: true,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="m-0 text-[0.67rem] font-bold tracking-[0.14em] text-emerald-800">ESPACE ADMINISTRATEUR</p><h1 class="mb-1 mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tarif horaire</h1><p class="m-0 text-sm text-slate-500">Consultez et ajustez le tarif de base appliqué aux réservations.</p></div>
        <button class="min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" type="button" [disabled]="rateLoading || historyLoading" (click)="refresh()">{{ rateLoading || historyLoading ? 'Actualisation…' : 'Actualiser' }}</button>
      </header>

      <section class="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div class="mb-5 flex items-center gap-3"><span class="grid size-10 place-items-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-800">MAD</span><div><p class="m-0 text-[0.65rem] font-bold tracking-widest text-slate-500">TARIF EN VIGUEUR</p><h2 class="mb-0 mt-1 text-base font-bold text-slate-900">Prix par heure</h2></div></div>
          @if (rateError) { <div class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900" role="alert">{{ rateError }}</div> }
          <div class="mb-5 rounded-xl bg-emerald-50 px-4 py-5"><p class="m-0 text-xs font-medium text-emerald-900/70">Tarif actuel</p><p class="mb-0 mt-1 text-3xl font-bold tracking-tight text-emerald-950" aria-live="polite">{{ rateLoading ? 'Chargement…' : (currentRate === null ? 'Indisponible' : formatMoney(currentRate, currency) + ' / h') }}</p></div>
          <form class="grid gap-3" (ngSubmit)="saveRate()" #tariffForm="ngForm">
            <label class="grid gap-1.5 text-sm font-semibold text-slate-700" for="new-hourly-rate">Nouveau tarif horaire (MAD)
              <input class="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal focus:border-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-700/10" id="new-hourly-rate" name="prixDh" type="number" step="0.01" min="0.01" max="10000" placeholder="Ex. 12.50" required [(ngModel)]="newRate">
            </label>
            <button class="mt-1 min-h-11 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60" type="submit" [disabled]="saving || tariffForm.invalid">{{ saving ? 'Enregistrement…' : 'Enregistrer le tarif' }}</button>
          </form>
        </article>

        <section class="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Historique des tarifs">
          <div class="mb-4 flex items-start justify-between gap-3"><div><h2 class="m-0 text-lg font-bold text-slate-900">Historique des tarifs</h2><p class="mb-0 mt-1 text-sm text-slate-500">Évolutions antérieures du tarif horaire.</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{{ totalEntries }} entrées</span></div>
          @if (historyLoading) {
            <div class="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500" role="status">Chargement de l’historique…</div>
          } @else if (historyError) {
            <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{{ historyError }}</div>
          } @else if (history.length === 0) {
            <div class="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucun historique de tarif disponible.</div>
          } @else {
            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="min-w-[620px] w-full divide-y divide-slate-200 text-left text-sm">
                <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th class="px-4 py-3">Tarif</th><th class="px-4 py-3">Valable à partir du</th><th class="px-4 py-3">Auteur</th><th class="px-4 py-3">Enregistré le</th></tr></thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  @for (entry of history; track entry.id ?? $index) {
                    <tr class="hover:bg-slate-50"><td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{{ formatMoney(entry.prixDh) }} / h</td><td class="whitespace-nowrap px-4 py-3 text-slate-600">{{ formatDate(entry.valableAPartir) }}</td><td class="px-4 py-3 text-slate-600">{{ entry.creePar || '—' }}</td><td class="whitespace-nowrap px-4 py-3 text-slate-600">{{ formatDate(entry.creeLe) }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p class="m-0 text-xs text-slate-500">Page {{ currentPage + 1 }} sur {{ totalPages }}</p>
              <div class="flex gap-2"><button class="min-h-9 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40" type="button" [disabled]="currentPage === 0 || historyLoading" (click)="loadHistory(currentPage - 1)">← Précédent</button><button class="min-h-9 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40" type="button" [disabled]="currentPage >= totalPages - 1 || historyLoading" (click)="loadHistory(currentPage + 1)">Suivant →</button></div>
            </div>
          }
        </section>
      </section>
    </main>
  `
})
export class AdminTariffsComponent implements OnInit, OnDestroy {
  currentRate: number | null = null;
  currency = 'MAD';
  newRate: number | null = null;
  history: TariffHistoryEntry[] = [];
  currentPage = 0;
  totalPages = 1;
  totalEntries = 0;
  rateLoading = true;
  historyLoading = true;
  saving = false;
  rateError = '';
  historyError = '';
  private destroyed = false;

  ngOnInit(): void { void Promise.all([this.loadRate(), this.loadHistory(0)]); }
  ngOnDestroy(): void { this.destroyed = true; }
  formatMoney = formatMoney;
  formatDate = formatDate;

  async refresh(): Promise<void> { await Promise.all([this.loadRate(), this.loadHistory(this.currentPage)]); }

  async loadRate(): Promise<void> {
    const revision = sessionRevision();
    this.rateLoading = true;
    this.rateError = '';
    try {
      const data = await api('/api/tarifs/hourly');
      assertCurrentSession(revision);
      if (this.destroyed) return;
      if (!data || typeof data.prixDh !== 'number') throw new Error('Réponse invalide du service tarifs.');
      this.currentRate = data.prixDh;
      this.currency = data.currency || 'MAD';
      if (this.newRate === null) this.newRate = data.prixDh;
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.currentRate = null;
      this.rateError = error instanceof Error ? error.message : 'Impossible de charger le tarif.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.rateLoading = false; }
  }

  async loadHistory(page = 0): Promise<void> {
    const revision = sessionRevision();
    this.currentPage = page;
    this.historyLoading = true;
    this.historyError = '';
    try {
      const data = await api(`/api/tarifs/hourly/history?page=${page}&size=10`);
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.history = Array.isArray(data?.content) ? data.content : [];
      this.totalPages = data.totalPages || 1;
      this.totalEntries = data.totalElements || this.history.length;
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.history = [];
      this.historyError = error instanceof Error ? error.message : 'Impossible de charger l’historique des tarifs.';
      showErrorToast(this.historyError);
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.historyLoading = false; }
  }

  async saveRate(): Promise<void> {
    const value = Number(this.newRate);
    if (!Number.isFinite(value) || value <= 0) { showErrorToast('Le tarif horaire doit être un nombre strictement positif.'); return; }
    const revision = sessionRevision();
    this.saving = true;
    try {
      const updated = await api('/api/tarifs/hourly', { method: 'PUT', body: { prixDh: value } });
      assertCurrentSession(revision);
      this.currentRate = updated.prixDh;
      this.currency = updated.currency || 'MAD';
      const formatted = `${formatMoney(updated.prixDh, this.currency)} / h`;
      showToast(`Tarif horaire mis à jour avec succès : ${formatted}`, 'success');
      await this.loadHistory(0);
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible de modifier le tarif.');
    } finally { this.saving = false; }
  }
}
