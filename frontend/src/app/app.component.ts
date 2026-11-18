import { AfterViewInit, Component, HostListener } from '@angular/core';
import { LoginComponent } from './auth/login.component';
import { AdminDashboardComponent } from './admin/admin-dashboard.component';
import { AdminPlacesComponent } from './admin/admin-places.component';
import { AdminTariffsComponent } from './admin/admin-tariffs.component';
import { AdminSubscriptionsComponent } from './admin/admin-subscriptions.component';
import { AdminReservationsComponent } from './admin/admin-reservations.component';
import { AdminUsersComponent } from './admin/admin-users.component';
import { DriverReserveComponent } from './driver/driver-reserve.component';
import { DriverHistoryComponent } from './driver/driver-history.component';
import { DriverSubscriptionsComponent } from './driver/driver-subscriptions.component';
import { AgentOperationsComponent } from './agent/agent-operations.component';

@Component({
  selector: 'parking-root',
  standalone: true,
  host: { class: 'block' },
  imports: [LoginComponent, AdminDashboardComponent, AdminPlacesComponent, AdminTariffsComponent, AdminSubscriptionsComponent, AdminReservationsComponent, AdminUsersComponent, DriverReserveComponent, DriverHistoryComponent, DriverSubscriptionsComponent, AgentOperationsComponent],
  template: `
    <header class="sticky top-0 z-40 border-b border-white/10 bg-[#101d2c] text-white shadow-lg shadow-slate-950/10">
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="#login" class="group flex min-w-0 items-center gap-3 rounded-lg text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c5f277]" id="brand-link">
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-[#c5f277] text-base font-black text-[#101d2c] shadow-sm" aria-hidden="true">P</span>
          <span class="min-w-0"><strong class="block truncate text-sm font-bold tracking-tight sm:text-base">Parking intelligent</strong><small class="hidden text-[0.62rem] font-semibold tracking-[0.15em] text-slate-400 sm:block">MOBILITÉ URBAINE</small></span>
        </a>
        <div id="identity" class="flex min-w-0 items-center gap-3" hidden>
          <span class="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-xs font-bold text-[#c5f277]" aria-hidden="true">PI</span>
          <span class="hidden min-w-0 text-right sm:block"><small class="block text-[0.6rem] font-bold uppercase tracking-[0.14em] text-slate-400">Connecté en tant que</small><strong class="block max-w-48 truncate text-xs font-semibold text-white" id="display-name"></strong></span>
          <button id="logout-btn" type="button" class="min-h-9 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#c5f277]/50 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5f277]">Déconnexion</button>
        </div>
      </div>
      <nav id="role-navigation" class="mx-auto mb-0 flex w-full max-w-7xl gap-2 overflow-x-auto border-t border-b-0 border-white/10 px-4 py-2 sm:px-6 lg:px-8" aria-label="Espaces du parking" hidden></nav>
    </header>
    @if (isReady && isLogin) {
      <parking-login (loginSuccess)="openUserSpace()"></parking-login>
    }
    @if (isReady && adminRoute === '#admin-dashboard') {
      <parking-admin-dashboard></parking-admin-dashboard>
    }
    @if (isReady && adminRoute === '#admin-places') { <parking-admin-places></parking-admin-places> }
    @if (isReady && adminRoute === '#admin-tariffs') { <parking-admin-tariffs></parking-admin-tariffs> }
    @if (isReady && adminRoute === '#admin-subscriptions') { <parking-admin-subscriptions></parking-admin-subscriptions> }
    @if (isReady && adminRoute === '#admin-reservations') { <parking-admin-reservations></parking-admin-reservations> }
    @if (isReady && adminRoute === '#admin-users') { <parking-admin-users></parking-admin-users> }
    @if (isReady && driverRoute === '#reserve') { <parking-driver-reserve></parking-driver-reserve> }
    @if (isReady && driverRoute === '#history') { <parking-driver-history></parking-driver-history> }
    @if (isReady && driverRoute === '#subscriptions') { <parking-driver-subscriptions></parking-driver-subscriptions> }
    @if (isReady && isAgentRoute) { <parking-agent-operations></parking-agent-operations> }
    <main id="app" [hidden]="!isReady || isLogin || isAdminRoute || isDriverRoute || isAgentRoute">
      <div id="page-content" role="region" aria-live="polite"></div>
    </main>
    <div id="toast-container" class="toast-container" role="region" aria-label="Notifications"></div>
    <footer>Parking intelligent · Prototype universitaire · Paiement simulé</footer>
  `
})
export class AppComponent implements AfterViewInit {
  isReady = false;
  isLogin = !window.location.hash || window.location.hash === '#login';
  adminRoute = window.location.hash.startsWith('#admin-') ? window.location.hash : '';
  isAdminRoute = Boolean(this.adminRoute);
  driverRoute = this.getDriverRoute();
  isDriverRoute = Boolean(this.driverRoute);
  isAgentRoute = window.location.hash === '#operations';

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.isLogin = !window.location.hash || window.location.hash === '#login';
    this.adminRoute = window.location.hash.startsWith('#admin-') ? window.location.hash : '';
    this.isAdminRoute = Boolean(this.adminRoute);
    this.driverRoute = this.getDriverRoute();
    this.isDriverRoute = Boolean(this.driverRoute);
    this.isAgentRoute = window.location.hash === '#operations';
  }

  openUserSpace(): void {
    this.isLogin = false;
  }

  private getDriverRoute(): string {
    return ['#reserve', '#history', '#subscriptions'].includes(window.location.hash) ? window.location.hash : '';
  }

  async ngAfterViewInit(): Promise<void> {
    // Le shell JS conserve la session et la navigation ; Angular rend les écrans.
    const legacyApplication = await import('../../js/main.js');
    await legacyApplication.appReady;
    this.isLogin = !window.location.hash || window.location.hash === '#login';
    this.adminRoute = window.location.hash.startsWith('#admin-') ? window.location.hash : '';
    this.isAdminRoute = Boolean(this.adminRoute);
    this.driverRoute = this.getDriverRoute();
    this.isDriverRoute = Boolean(this.driverRoute);
    this.isAgentRoute = window.location.hash === '#operations';
    this.isReady = true;
  }
}
