import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPageBannerComponent } from './admin-page-banner.component';
import { api } from '../../../js/api.js';
import { assertCurrentSession, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { buildQueryString, formatDate, formatMoney } from '../../../js/ui/formatters.js';
import { getSubscriptionPeriodLabel, getSubscriptionStatusInfo } from '../../../js/ui/labels.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';

type Plan = { period: string; price: number; currency?: string; active: boolean };
type Subscription = { id: string | number; userId?: string | number; period: string; status: string; startsAt?: string; endsAt?: string; price: number; currency?: string };

@Component({
  selector: 'parking-admin-subscriptions',
  standalone: true,
  imports: [FormsModule, AdminPageBannerComponent],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <parking-admin-banner title="Abonnements" description="Configurez les formules et consultez les souscriptions." code="03">
        <button banner-action class="min-h-10 rounded-lg border border-white/15 bg-[#fcfdff]/[0.06] px-4 py-2 text-sm font-semibold text-white hover:bg-[#fcfdff]/10 disabled:opacity-60" type="button" [disabled]="plansLoading || subscriptionsLoading" (click)="refresh()">↻ {{ plansLoading || subscriptionsLoading ? 'Actualisation…' : 'Actualiser' }}</button>
      </parking-admin-banner>

      <section class="space-y-4" aria-label="Tarifs des formules">
        <div><h2 class="m-0 text-lg font-bold text-slate-900">Formules tarifaires</h2><p class="mb-0 mt-1 text-sm text-slate-500">Modifiez le prix et l’accès aux souscriptions pour chaque formule.</p></div>
        @if (plansLoading && plans.length === 0) {
          <div class="rounded-xl border border-[#d6dee8] bg-[#fcfdff] p-7 text-center text-sm text-slate-500" role="status">Chargement des formules…</div>
        } @else if (plansError) {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{{ plansError }}</div>
        } @else if (plans.length === 0) {
          <div class="rounded-xl border border-dashed border-[#cbd5df] bg-[#fcfdff] p-7 text-center text-sm text-slate-500">Aucune formule trouvée.</div>
        } @else {
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            @for (plan of plans; track plan.period) {
              <article class="rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-5 shadow-sm">
                <div class="mb-4 flex items-start justify-between gap-2"><div><h3 class="m-0 text-base font-bold text-slate-900">{{ periodLabel(plan.period) }}</h3><p class="mb-0 mt-1 text-xs text-slate-500">Code : {{ plan.period }}</p></div><span class="rounded-full px-2.5 py-1 text-[0.68rem] font-semibold" [class]="plan.active ? 'bg-[#eff9d9] text-[#405624]' : 'bg-slate-100 text-slate-600'">{{ plan.active ? 'Active' : 'Inactive' }}</span></div>
                <form class="grid gap-3 border-t border-slate-100 pt-4" (ngSubmit)="savePlan(plan)">
                  <label class="grid gap-1 text-xs font-semibold text-slate-600">Tarif ({{ plan.currency || 'MAD' }})<input class="h-10 rounded-lg border border-[#cbd5df] bg-[#eef4f8] px-2.5 text-sm font-normal text-slate-900" type="number" min="0" step="0.01" [name]="'price-' + plan.period" required [(ngModel)]="plan.price"></label>
                  <label class="flex items-center gap-2 text-sm text-slate-700"><input class="size-4 accent-[#101d2c]" type="checkbox" [name]="'active-' + plan.period" [(ngModel)]="plan.active">Formule active</label>
                  <button class="mt-1 min-h-10 rounded-lg bg-[#101d2c] px-3 py-2 text-sm font-semibold text-white hover:bg-[#263649] disabled:opacity-60" type="submit" [disabled]="savingPeriod === plan.period">{{ savingPeriod === plan.period ? 'Enregistrement…' : 'Enregistrer' }}</button>
                </form>
              </article>
            }
          </div>
        }
      </section>

      <section class="min-w-0 space-y-4 rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5" aria-label="Liste des souscriptions">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 class="m-0 text-lg font-bold text-slate-900">Toutes les souscriptions</h2><p class="mb-0 mt-1 text-sm text-slate-500">Historique global avec filtre par statut.</p></div><label class="grid gap-1 text-xs font-semibold text-slate-600">Filtrer par statut<select class="h-10 min-w-52 rounded-lg border border-[#cbd5df] bg-[#eef4f8] px-2.5 text-sm font-normal text-slate-800" name="status" [(ngModel)]="statusFilter" (ngModelChange)="changeStatus()"><option value="">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="PENDING_PAYMENT">En attente de paiement</option><option value="EXPIRED">Expirés</option><option value="CANCELLED">Annulés</option></select></label></div>
        <p class="m-0 text-xs text-slate-500" role="status">{{ subscriptionMessage }}</p>
        @if (subscriptionsLoading) {
          <div class="rounded-xl bg-[#eef4f8] p-8 text-center text-sm text-slate-500">Chargement des abonnements…</div>
        } @else if (subscriptionsError) {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{{ subscriptionsError }}</div>
        } @else if (subscriptions.length === 0) {
          <div class="rounded-xl border border-dashed border-[#cbd5df] p-7 text-center text-sm text-slate-500">Aucun abonnement ne correspond aux critères sélectionnés.</div>
        } @else {
          <div class="overflow-x-auto rounded-xl border border-[#d6dee8]">
            <table class="min-w-[850px] w-full divide-y divide-slate-200 text-left text-sm">
              <thead class="bg-[#eef4f8] text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th class="px-3 py-3">ID / Référence</th><th class="px-3 py-3">Utilisateur</th><th class="px-3 py-3">Formule</th><th class="px-3 py-3">Statut</th><th class="px-3 py-3">Début</th><th class="px-3 py-3">Fin</th><th class="px-3 py-3 text-right">Montant</th></tr></thead>
              <tbody class="divide-y divide-slate-100 bg-[#fcfdff]">
                @for (subscription of subscriptions; track subscription.id) {
                  <tr class="hover:bg-[#eef4f8]"><td class="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{{ shortId(subscription.id) }}</td><td class="px-3 py-3 text-slate-600">{{ subscription.userId || '—' }}</td><td class="px-3 py-3 text-slate-700">{{ periodLabel(subscription.period) }}</td><td class="px-3 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="statusClass(subscription.status)">{{ subscriptionStatus(subscription.status) }}</span></td><td class="whitespace-nowrap px-3 py-3 text-slate-600">{{ formatDate(subscription.startsAt) }}</td><td class="whitespace-nowrap px-3 py-3 text-slate-600">{{ formatDate(subscription.endsAt) }}</td><td class="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">{{ formatMoney(subscription.price, subscription.currency || 'MAD') }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3"><p class="m-0 text-xs text-slate-500">Page {{ currentPage + 1 }} sur {{ totalPages }}</p><div class="flex gap-2"><button class="min-h-9 rounded-lg border border-[#cbd5df] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#eef4f8] disabled:opacity-40" type="button" [disabled]="currentPage === 0 || subscriptionsLoading" (click)="loadSubscriptions(currentPage - 1)">← Précédent</button><button class="min-h-9 rounded-lg border border-[#cbd5df] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#eef4f8] disabled:opacity-40" type="button" [disabled]="currentPage >= totalPages - 1 || subscriptionsLoading" (click)="loadSubscriptions(currentPage + 1)">Suivant →</button></div></div>
        }
      </section>
    </main>
  `
})
export class AdminSubscriptionsComponent implements OnInit, OnDestroy {
  plans: Plan[] = [];
  subscriptions: Subscription[] = [];
  statusFilter = '';
  currentPage = 0;
  totalPages = 1;
  totalElements = 0;
  plansLoading = true;
  subscriptionsLoading = true;
  savingPeriod = '';
  plansError = '';
  subscriptionsError = '';
  subscriptionMessage = 'Chargement des abonnements…';
  private destroyed = false;

  ngOnInit(): void { void Promise.all([this.loadPlans(), this.loadSubscriptions(0)]); }
  ngOnDestroy(): void { this.destroyed = true; }
  formatDate = formatDate;
  formatMoney = formatMoney;
  periodLabel(period: string): string { return getSubscriptionPeriodLabel(period); }
  subscriptionStatus(status: string): string { return getSubscriptionStatusInfo(status).label; }
  shortId(id: string | number): string { return String(id).slice(0, 8); }
  statusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'bg-[#eff9d9] text-[#405624]';
      case 'PENDING_PAYMENT': return 'bg-amber-50 text-amber-900';
      case 'EXPIRED': return 'bg-slate-100 text-slate-700';
      case 'CANCELLED': return 'bg-rose-50 text-rose-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  async refresh(): Promise<void> { await Promise.all([this.loadPlans(), this.loadSubscriptions(this.currentPage)]); }
  changeStatus(): void { void this.loadSubscriptions(0); }

  async loadPlans(): Promise<void> {
    const revision = sessionRevision();
    this.plansLoading = true;
    this.plansError = '';
    try {
      const response = await api('/api/subscriptions/plans/all');
      assertCurrentSession(revision);
      if (!this.destroyed) this.plans = Array.isArray(response) ? response.map((plan: Plan) => ({ ...plan })) : [];
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.plansError = error instanceof Error ? error.message : 'Impossible de charger les formules.';
      showErrorToast(this.plansError);
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.plansLoading = false; }
  }

  async savePlan(plan: Plan): Promise<void> {
    const price = Number(plan.price);
    if (!Number.isFinite(price) || price < 0) { showErrorToast('Le tarif doit être un nombre positif ou nul.'); return; }
    const revision = sessionRevision();
    this.savingPeriod = plan.period;
    try {
      const updated = await api(`/api/subscriptions/plans/${encodeURIComponent(plan.period)}`, { method: 'PUT', body: { price, active: plan.active } });
      assertCurrentSession(revision);
      plan.price = updated.price;
      showToast(`Formule ${getSubscriptionPeriodLabel(plan.period)} mise à jour (${formatMoney(updated.price)}).`, 'success');
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible de modifier cette formule.');
    } finally { this.savingPeriod = ''; }
  }

  async loadSubscriptions(page = 0): Promise<void> {
    const revision = sessionRevision();
    this.currentPage = page;
    this.subscriptionsLoading = true;
    this.subscriptionsError = '';
    this.subscriptionMessage = 'Chargement…';
    const query = buildQueryString({ page, size: 10, status: this.statusFilter });
    try {
      const data = await api(`/api/subscriptions/admin${query}`);
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.subscriptions = Array.isArray(data?.content) ? data.content : [];
      this.totalElements = Number(data.totalElements || this.subscriptions.length);
      this.totalPages = data.totalPages || 1;
      this.subscriptionMessage = this.subscriptions.length ? `${this.totalElements} abonnement(s) enregistré(s).` : 'Aucun abonnement trouvé.';
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.subscriptions = [];
      this.subscriptionMessage = 'Erreur de chargement.';
      this.subscriptionsError = error instanceof Error ? error.message : 'Impossible de charger les abonnements.';
      showErrorToast(this.subscriptionsError);
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.subscriptionsLoading = false; }
  }
}
