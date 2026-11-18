import { AfterViewInit, Component, HostListener } from '@angular/core';
import { LoginComponent } from './auth/login.component';
import { AdminDashboardComponent } from './admin/admin-dashboard.component';
import { AdminPlacesComponent } from './admin/admin-places.component';
import { AdminTariffsComponent } from './admin/admin-tariffs.component';
import { AdminSubscriptionsComponent } from './admin/admin-subscriptions.component';
import { AdminReservationsComponent } from './admin/admin-reservations.component';
import { AdminUsersComponent } from './admin/admin-users.component';

@Component({
  selector: 'parking-root',
  standalone: true,
  host: { class: 'block' },
  imports: [LoginComponent, AdminDashboardComponent, AdminPlacesComponent, AdminTariffsComponent, AdminSubscriptionsComponent, AdminReservationsComponent, AdminUsersComponent],
  template: `
    <header class="topbar">
      <a href="#login" class="brand" id="brand-link">
        <span class="logo" aria-hidden="true">P</span>
        <span>Parking intelligent</span>
      </a>
      <div id="identity" hidden>
        <span id="display-name"></span>
        <button id="logout-btn" type="button" class="quiet">Déconnexion</button>
      </div>
    </header>
    @if (isReady && isLogin) {
      <parking-login (loginSuccess)="openUserSpace()"></parking-login>
    }
    <nav id="role-navigation" class="mx-auto w-full max-w-7xl px-6 max-[480px]:px-3.5" aria-label="Espaces du parking" hidden></nav>
    @if (isReady && adminRoute === '#admin-dashboard') {
      <parking-admin-dashboard></parking-admin-dashboard>
    }
    @if (isReady && adminRoute === '#admin-places') { <parking-admin-places></parking-admin-places> }
    @if (isReady && adminRoute === '#admin-tariffs') { <parking-admin-tariffs></parking-admin-tariffs> }
    @if (isReady && adminRoute === '#admin-subscriptions') { <parking-admin-subscriptions></parking-admin-subscriptions> }
    @if (isReady && adminRoute === '#admin-reservations') { <parking-admin-reservations></parking-admin-reservations> }
    @if (isReady && adminRoute === '#admin-users') { <parking-admin-users></parking-admin-users> }
    <main id="app" [hidden]="!isReady || isLogin || isAdminRoute">
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

  @HostListener('window:hashchange')
  onHashChange(): void {
    this.isLogin = !window.location.hash || window.location.hash === '#login';
    this.adminRoute = window.location.hash.startsWith('#admin-') ? window.location.hash : '';
    this.isAdminRoute = Boolean(this.adminRoute);
  }

  openUserSpace(): void {
    this.isLogin = false;
  }

  async ngAfterViewInit(): Promise<void> {
    // Le shell JS conserve la session et les écrans conducteur/agent ; Angular
    // rend maintenant les écrans de connexion et d’administration.
    const legacyApplication = await import('../../js/main.js');
    await legacyApplication.appReady;
    this.isLogin = !window.location.hash || window.location.hash === '#login';
    this.adminRoute = window.location.hash.startsWith('#admin-') ? window.location.hash : '';
    this.isAdminRoute = Boolean(this.adminRoute);
    this.isReady = true;
  }
}
