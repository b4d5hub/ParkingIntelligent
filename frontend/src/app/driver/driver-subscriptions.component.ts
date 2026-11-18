import { Component, OnDestroy, OnInit } from '@angular/core';
import { api } from '../../../js/api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession } from '../../../js/session.js';
import { formatDate, formatMoney } from '../../../js/ui/formatters.js';
import { getSubscriptionStatusInfo, getSubscriptionPeriodLabel } from '../../../js/ui/labels.js';
import { fetchSubscriptionPlans } from '../../../js/data/plans.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';

type Plan = { period: string; title: string; price: number; currency: string; description: string; featured: boolean };
type Subscription = { id: string | number; period: string; status: string; startsAt?: string; endsAt?: string; price: number; currency?: string };
type ConfirmAction = { kind: 'subscribe'; plan: Plan } | { kind: 'cancel'; subscription: Subscription };

@Component({
  selector: 'parking-driver-subscriptions',
  standalone: true,
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header class="relative isolate overflow-hidden rounded-[1.75rem] bg-[#101d2c] px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-9 sm:py-9"><span class="absolute -right-20 -top-32 -z-10 size-80 rounded-full border-[42px] border-white/[0.04]" aria-hidden="true"></span><div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p class="mb-3 flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.18em] text-[#c5f277]"><span class="size-2 rounded-full bg-[#c5f277]"></span> PARKING INTELLIGENT <span class="text-white/35">/</span> ESPACE CONDUCTEUR</p><h1 class="mb-2 mt-0 text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">Le parking<br><span class="text-[#c5f277]">à votre rythme.</span></h1><p class="m-0 max-w-lg text-sm leading-6 text-slate-300">Choisissez la durée qui correspond à vos habitudes. Gérez ensuite votre formule depuis un seul espace.</p></div><button class="min-h-10 self-start rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50 sm:self-auto" type="button" [disabled]="subscriptionsLoading" (click)="refresh()">↻ {{ subscriptionsLoading ? 'Actualisation…' : 'Actualiser' }}</button></div><div class="mt-7 flex flex-wrap gap-2 text-xs font-semibold"><span class="rounded-full bg-[#c5f277] px-3 py-1.5 text-[#101d2c]">4 durées disponibles</span><span class="rounded-full border border-white/15 px-3 py-1.5 text-slate-200">Souscription simulée</span></div></header>

      <section class="space-y-4" aria-label="Formules d’abonnement"><div><p class="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-[#527097]">FORMULES FLEXIBLES</p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-[#101d2c]">Un pass pour chaque rythme</h2><p class="mb-0 mt-1 text-sm text-slate-500">Choisissez la durée qui vous convient.</p></div>
        @if (plansLoading) { <div class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500" role="status">Chargement des formules…</div> }
        @else if (plansError) { <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{{ plansError }}</div> }
        @else { <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">@for (plan of plans; track plan.period) {
          <article class="relative flex flex-col overflow-hidden rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg" [class]="plan.featured ? 'border-[#101d2c] bg-[#101d2c] text-white shadow-[#101d2c]/15' : 'border-[#d6dee8] bg-[#fcfdff] text-[#101d2c]'">
            @if (plan.featured) { <span class="absolute right-4 top-4 rounded-full bg-[#c5f277] px-2.5 py-1 text-[0.62rem] font-black tracking-wide text-[#101d2c]">MEILLEUR CHOIX</span> }
            <p class="m-0 text-[0.65rem] font-bold tracking-[0.16em]" [class]="plan.featured ? 'text-[#c5f277]' : 'text-[#718399]'">PASS {{ plan.period }}</p><h3 class="mb-0 mt-3 text-lg font-bold tracking-tight" [class]="plan.featured ? 'text-white' : 'text-[#101d2c]'">{{ plan.title || periodLabel(plan.period) }}</h3><p class="mb-0 mt-1 min-h-10 text-sm" [class]="plan.featured ? 'text-slate-300' : 'text-slate-500'">{{ plan.description }}</p><div class="my-5 border-t" [class]="plan.featured ? 'border-white/10' : 'border-[#e5eaf0]'"></div><p class="mb-0 text-3xl font-bold tracking-tight tabular-nums" [class]="plan.featured ? 'text-[#c5f277]' : 'text-[#101d2c]'">{{ formatMoney(plan.price, plan.currency) }}</p><p class="mb-5 mt-1 text-xs" [class]="plan.featured ? 'text-slate-300' : 'text-slate-500'">{{ periodHint(plan.period) }}</p><button class="mt-auto min-h-11 rounded-lg px-4 py-2.5 text-sm font-bold transition" [class]="plan.featured ? 'bg-[#c5f277] text-[#101d2c] hover:bg-[#d2fa8d] disabled:opacity-50' : 'border border-[#b9c8d8] bg-white text-[#263649] hover:bg-[#eef4f8] disabled:opacity-50'" type="button" [disabled]="pendingPeriod === plan.period" (click)="askSubscribe(plan)">{{ pendingPeriod === plan.period ? 'Traitement…' : 'Choisir cette formule →' }}</button>
          </article>
        }</div> }
      </section>

      <section class="space-y-4 rounded-2xl border border-[#d6dee8] bg-[#fcfdff] p-4 shadow-sm sm:p-5" aria-label="Mes abonnements"><div><p class="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-[#527097]">VOTRE COMPTE</p><h2 class="mb-0 mt-1 text-xl font-bold tracking-tight text-[#101d2c]">Mes abonnements</h2><p class="mb-0 mt-1 text-sm text-slate-500">Retrouvez vos abonnements actifs et passés.</p></div>
        @if (subscriptionsLoading) { <div class="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500" role="status">Chargement de vos abonnements…</div> }
        @else if (subscriptionsError) { <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{{ subscriptionsError }}</div> }
        @else if (!subscriptions.length) { <div class="rounded-xl border border-dashed border-slate-300 p-8 text-center"><p class="m-0 font-semibold text-slate-800">Aucun abonnement pour le moment</p><p class="mb-0 mt-1 text-sm text-slate-500">Vos souscriptions apparaîtront dans cette section.</p></div> }
        @else { <div class="grid gap-3 lg:grid-cols-2">@for (subscription of subscriptions; track subscription.id) {
          <article class="rounded-xl border border-[#d6dee8] border-l-4 border-l-[#c5f277] bg-white p-4 sm:p-5"><div class="flex items-start justify-between gap-3"><div><p class="m-0 text-[0.65rem] font-bold tracking-widest text-[#718399]">SOUSCRIPTION N°{{ subscription.id }}</p><h3 class="mb-0 mt-1 text-base font-bold text-[#101d2c]">Formule {{ periodLabel(subscription.period) }}</h3></div><span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="statusClass(subscription.status)">{{ statusLabel(subscription.status) }}</span></div>
            <div class="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3"><div><p class="m-0 text-xs text-slate-500">Montant</p><p class="mb-0 mt-1 text-sm font-semibold text-slate-900">{{ formatMoney(subscription.price, subscription.currency) }}</p></div><div><p class="m-0 text-xs text-slate-500">Période</p><p class="mb-0 mt-1 text-sm text-slate-700">{{ formatDate(subscription.startsAt) }} – {{ formatDate(subscription.endsAt) }}</p></div></div>
            @if (subscription.status === 'PENDING_PAYMENT') { <p class="mb-0 mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">En attente de paiement : le module de paiement en ligne pour les abonnements sera bientôt disponible. L’abonnement s’activera après validation.</p> }
            @if (subscription.status === 'ACTIVE') { <div class="mt-4 border-t border-slate-100 pt-3"><button class="min-h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50" type="button" [disabled]="pendingSubscriptionId === subscription.id" (click)="askCancel(subscription)">{{ pendingSubscriptionId === subscription.id ? 'Annulation…' : 'Annuler l’abonnement' }}</button></div> }
          </article>
        }</div> }
      </section>
    </main>

    @if (confirmAction) { <div class="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" (click)="confirmAction = null"><section class="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="subscription-confirm-title" (click)="$event.stopPropagation()"><p class="m-0 text-[0.65rem] font-bold tracking-widest" [class]="confirmAction.kind === 'cancel' ? 'text-rose-700' : 'text-emerald-800'">CONFIRMATION</p><h2 class="mb-2 mt-1 text-xl font-bold text-slate-900" id="subscription-confirm-title">{{ confirmTitle() }}</h2><p class="m-0 text-sm leading-6 text-slate-600">{{ confirmMessage() }}</p><div class="mt-5 flex justify-end gap-2"><button class="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700" type="button" (click)="confirmAction = null">Retour</button><button class="min-h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50" [class]="confirmAction.kind === 'cancel' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-900 hover:bg-emerald-950'" type="button" [disabled]="confirming" (click)="confirm()">{{ confirming ? 'Traitement…' : (confirmAction.kind === 'cancel' ? 'Confirmer l’annulation' : 'Confirmer la souscription') }}</button></div></section></div> }
  `
})
export class DriverSubscriptionsComponent implements OnInit, OnDestroy {
  plans: Plan[] = [];
  subscriptions: Subscription[] = [];
  plansLoading = true;
  subscriptionsLoading = true;
  plansError = '';
  subscriptionsError = '';
  confirming = false;
  pendingPeriod = '';
  pendingSubscriptionId: string | number | null = null;
  confirmAction: ConfirmAction | null = null;
  private destroyed = false;

  ngOnInit(): void { void Promise.all([this.loadPlans(), this.loadSubscriptions()]); }
  ngOnDestroy(): void { this.destroyed = true; }
  formatDate = formatDate;
  formatMoney = formatMoney;
  periodLabel(period: string): string { return getSubscriptionPeriodLabel(period); }
  statusLabel(status: string): string { return getSubscriptionStatusInfo(status).label; }
  statusClass(status: string): string {
    switch (status) { case 'ACTIVE': return 'bg-emerald-50 text-emerald-800'; case 'PENDING_PAYMENT': return 'bg-amber-50 text-amber-900'; case 'EXPIRED': return 'bg-slate-100 text-slate-700'; case 'CANCELLED': return 'bg-rose-50 text-rose-800'; default: return 'bg-slate-100 text-slate-700'; }
  }
  periodHint(period: string): string {
    switch (period) { case 'DAILY': return 'Pour 24 heures'; case 'WEEKLY': return 'Pour 7 jours'; case 'MONTHLY': return 'Pour 1 mois'; case 'ANNUAL': return 'Pour 1 an'; default: return 'Selon la période choisie'; }
  }
  async refresh(): Promise<void> { await this.loadSubscriptions(); }
  askSubscribe(plan: Plan): void { this.confirmAction = { kind: 'subscribe', plan }; }
  askCancel(subscription: Subscription): void { this.confirmAction = { kind: 'cancel', subscription }; }
  confirmTitle(): string {
    if (this.confirmAction?.kind === 'subscribe') return `Souscrire à la formule ${this.confirmAction.plan.title}`;
    return 'Annuler cet abonnement ?';
  }
  confirmMessage(): string {
    if (this.confirmAction?.kind === 'subscribe') {
      const plan = this.confirmAction.plan;
      return `Confirmez-vous la souscription à la formule ${plan.title} au montant de ${formatMoney(plan.price, plan.currency)} ? Aucun paiement réel n’est effectué et l’abonnement est activé immédiatement.`;
    }
    if (this.confirmAction?.kind === 'cancel') return `Confirmez-vous l’annulation de votre abonnement ${this.periodLabel(this.confirmAction.subscription.period)} ? Cette action prend effet immédiatement.`;
    return '';
  }

  private async loadPlans(): Promise<void> {
    const revision = sessionRevision();
    this.plansLoading = true;
    this.plansError = '';
    try {
      this.plans = await fetchSubscriptionPlans();
      assertCurrentSession(revision);
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.plansError = error instanceof Error ? error.message : 'Impossible de charger les formules.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.plansLoading = false; }
  }

  private async loadSubscriptions(): Promise<void> {
    const revision = sessionRevision();
    this.subscriptionsLoading = true;
    this.subscriptionsError = '';
    try {
      const list = await api('/api/subscriptions/me');
      assertCurrentSession(revision);
      if (!this.destroyed) this.subscriptions = Array.isArray(list) ? list : [];
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.subscriptionsError = error instanceof Error ? error.message : 'Impossible de charger vos abonnements.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.subscriptionsLoading = false; }
  }

  async confirm(): Promise<void> {
    const action = this.confirmAction;
    if (!action) return;
    const revision = sessionRevision();
    this.confirming = true;
    if (action.kind === 'subscribe') this.pendingPeriod = action.plan.period;
    else this.pendingSubscriptionId = action.subscription.id;
    try {
      if (action.kind === 'subscribe') {
        await api('/api/subscriptions', { method: 'POST', body: { period: action.plan.period } });
        assertCurrentSession(revision);
        this.confirmAction = null;
        showToast(`Abonnement ${action.plan.title} souscrit avec succès (simulation).`, 'success');
      } else {
        await api(`/api/subscriptions/${encodeURIComponent(action.subscription.id)}/cancel`, { method: 'POST' });
        assertCurrentSession(revision);
        this.confirmAction = null;
        showToast('Abonnement annulé avec succès.', 'success');
      }
      await this.loadSubscriptions();
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'Impossible de traiter cette demande.');
    } finally { this.confirming = false; this.pendingPeriod = ''; this.pendingSubscriptionId = null; }
  }
}
