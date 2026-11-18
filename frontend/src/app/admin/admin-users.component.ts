import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { api } from '../../../js/api.js';
import { assertCurrentSession, getCurrentUser, isCurrentSession, sessionRevision } from '../../../js/session.js';
import { buildQueryString, formatDate, validateEmail, validatePassword, validateRoles } from '../../../js/ui/formatters.js';
import { getUserRoleInfo, getUserStatusInfo } from '../../../js/ui/labels.js';
import { showErrorToast, showToast } from '../../../js/ui/toast.js';

type User = { id: string | number; email: string; displayName?: string; roles?: string[]; enabled: boolean; createdAt?: string };
type DialogMode = 'create' | 'roles' | 'password' | 'toggle';
type UserDialog = { mode: DialogMode; user?: User };
const ROLES = ['CONDUCTEUR', 'AGENT', 'ADMIN'];

@Component({
  selector: 'parking-admin-users',
  standalone: true,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <main class="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="m-0 text-[0.67rem] font-bold tracking-[0.14em] text-emerald-800">ESPACE ADMINISTRATEUR</p><h1 class="mb-1 mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Utilisateurs</h1><p class="m-0 text-sm text-slate-500">Créez les comptes et gérez leurs rôles et leur accès.</p></div>
        <div class="flex flex-wrap gap-2"><button class="min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" type="button" [disabled]="loading" (click)="loadUsers(currentPage)">Actualiser</button><button class="min-h-10 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-950" type="button" (click)="openDialog('create')">+ Nouvel utilisateur</button></div>
      </header>

      <form class="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row" (ngSubmit)="search()" aria-label="Rechercher des utilisateurs">
        <label class="sr-only" for="user-search">Adresse e-mail ou nom</label><input id="user-search" class="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-700/10" type="search" name="q" placeholder="Rechercher par e-mail ou nom…" [(ngModel)]="searchDraft">
        <div class="flex gap-2"><button class="min-h-11 flex-1 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-950 sm:flex-none" type="submit">Rechercher</button><button class="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none" type="button" (click)="resetSearch()">Effacer</button></div>
      </form>

      <section class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Comptes utilisateurs">
        <div class="mb-4 flex items-center justify-between gap-3"><div><h2 class="m-0 text-base font-bold text-slate-900">Comptes du système</h2><p class="mb-0 mt-1 text-xs text-slate-500" role="status">{{ statusMessage }}</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{{ totalElements }} compte{{ totalElements > 1 ? 's' : '' }}</span></div>
        @if (loading) { <div class="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500" role="status">Chargement des utilisateurs…</div> }
        @else if (errorMessage) { <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{{ errorMessage }}</div> }
        @else if (users.length === 0) { <div class="rounded-xl border border-dashed border-slate-300 p-8 text-center"><p class="m-0 font-semibold text-slate-800">Aucun utilisateur trouvé</p><p class="mb-0 mt-1 text-sm text-slate-500">Essayez une autre recherche ou créez un compte.</p></div> }
        @else {
          <div class="overflow-x-auto rounded-xl border border-slate-200"><table class="min-w-[900px] w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th class="px-4 py-3">Utilisateur</th><th class="px-4 py-3">Rôles</th><th class="px-4 py-3">Statut</th><th class="px-4 py-3">Créé le</th><th class="px-4 py-3">Actions</th></tr></thead>
            <tbody class="divide-y divide-slate-100 bg-white">@for (user of users; track user.id) {
              <tr class="align-top hover:bg-slate-50"><td class="px-4 py-3"><p class="m-0 font-semibold text-slate-900">{{ user.displayName || user.email }}</p><p class="mb-0 mt-1 text-xs text-slate-500">{{ user.email }}</p></td><td class="px-4 py-3"><div class="flex flex-wrap gap-1.5">@for (role of user.roles || []; track role) { <span class="rounded-full px-2.5 py-1 text-xs font-medium" [class]="roleClass(role)">{{ roleLabel(role) }}</span> }</div></td><td class="px-4 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="user.enabled ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'">{{ user.enabled ? 'Actif' : 'Désactivé' }}</span>@if (isSelf(user)) { <span class="ml-1 text-xs text-slate-400">Vous</span> }</td><td class="whitespace-nowrap px-4 py-3 text-slate-600">{{ formatDate(user.createdAt) }}</td><td class="px-4 py-3"><div class="flex flex-wrap gap-1.5"><button class="min-h-8 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" type="button" [disabled]="isSelf(user)" [title]="isSelf(user) ? 'Vous ne pouvez pas modifier vos propres rôles' : ''" (click)="openDialog('roles', user)">Rôles</button><button class="min-h-8 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100" type="button" (click)="openDialog('password', user)">Mot de passe</button><button class="min-h-8 rounded-md px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40" [class]="user.enabled ? 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100' : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'" type="button" [disabled]="isSelf(user)" [title]="isSelf(user) ? 'Vous ne pouvez pas modifier le statut de votre propre compte' : ''" (click)="openDialog('toggle', user)">{{ user.enabled ? 'Désactiver' : 'Activer' }}</button></div></td></tr>
            }</tbody>
          </table></div>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><p class="m-0 text-xs text-slate-500">Page {{ currentPage + 1 }} sur {{ totalPages }}</p><div class="flex gap-2"><button class="min-h-9 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40" type="button" [disabled]="currentPage === 0 || loading" (click)="loadUsers(currentPage - 1)">← Précédent</button><button class="min-h-9 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40" type="button" [disabled]="currentPage >= totalPages - 1 || loading" (click)="loadUsers(currentPage + 1)">Suivant →</button></div></div>
        }
      </section>
    </main>

    @if (dialog) {
      <div class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4" (click)="closeDialog()">
        <section class="my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" [attr.aria-labelledby]="'user-dialog-title'" (click)="$event.stopPropagation()">
          <div class="mb-5 flex items-start justify-between gap-4"><div><p class="m-0 text-[0.65rem] font-bold tracking-widest text-emerald-800">GESTION DES COMPTES</p><h2 class="mb-0 mt-1 text-xl font-bold text-slate-900" id="user-dialog-title">{{ dialogTitle() }}</h2><p class="mb-0 mt-1 text-sm text-slate-500">{{ dialogDescription() }}</p></div><button class="grid size-9 shrink-0 place-items-center rounded-lg text-xl text-slate-500 hover:bg-slate-100" type="button" aria-label="Fermer" (click)="closeDialog()">×</button></div>
          @if (dialog.mode === 'create') {
            <form class="grid gap-4" (ngSubmit)="submitCreate()">
              <label class="grid gap-1.5 text-sm font-semibold text-slate-700">Adresse e-mail<input class="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal" type="email" name="email" autocomplete="email" required [(ngModel)]="draft.email"></label>
              <label class="grid gap-1.5 text-sm font-semibold text-slate-700">Nom d’affichage<input class="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal" type="text" name="displayName" autocomplete="name" required [(ngModel)]="draft.displayName"></label>
              <label class="grid gap-1.5 text-sm font-semibold text-slate-700">Mot de passe <span class="font-normal text-slate-500">12 caractères minimum</span><input class="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal" type="password" name="password" autocomplete="new-password" minlength="12" required [(ngModel)]="draft.password"></label>
              <fieldset class="grid gap-2"><legend class="mb-2 text-sm font-semibold text-slate-700">Rôles attribués</legend>@for (role of roles; track role) { <label class="flex items-center gap-2 text-sm text-slate-700"><input class="size-4 accent-emerald-800" type="checkbox" [checked]="draft.roles.includes(role)" (change)="toggleRole(role, $any($event.target).checked)">{{ roleLabel(role) }}</label> }</fieldset>
              <div class="flex justify-end gap-2 border-t border-slate-100 pt-4"><button class="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700" type="button" (click)="closeDialog()">Annuler</button><button class="min-h-10 rounded-lg bg-emerald-900 px-4 text-sm font-semibold text-white disabled:opacity-50" type="submit" [disabled]="saving">{{ saving ? 'Création…' : 'Créer le compte' }}</button></div>
            </form>
          } @else if (dialog.mode === 'roles') {
            <div class="grid gap-4"><fieldset class="grid gap-3"><legend class="mb-2 text-sm font-semibold text-slate-700">Rôles attribués</legend>@for (role of roles; track role) { <label class="flex items-center gap-2 text-sm text-slate-700"><input class="size-4 accent-emerald-800" type="checkbox" [checked]="draft.roles.includes(role)" (change)="toggleRole(role, $any($event.target).checked)">{{ roleLabel(role) }}</label> }</fieldset><div class="flex justify-end gap-2 border-t border-slate-100 pt-4"><button class="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700" type="button" (click)="closeDialog()">Annuler</button><button class="min-h-10 rounded-lg bg-emerald-900 px-4 text-sm font-semibold text-white disabled:opacity-50" type="button" [disabled]="saving" (click)="submitRoles()">{{ saving ? 'Enregistrement…' : 'Enregistrer les rôles' }}</button></div></div>
          } @else if (dialog.mode === 'password') {
            <form class="grid gap-4" (ngSubmit)="submitPassword()"><label class="grid gap-1.5 text-sm font-semibold text-slate-700">Nouveau mot de passe <span class="font-normal text-slate-500">12 caractères minimum</span><input class="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-normal" type="password" name="newPassword" autocomplete="new-password" minlength="12" required [(ngModel)]="draft.password"></label><div class="flex justify-end gap-2 border-t border-slate-100 pt-4"><button class="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700" type="button" (click)="closeDialog()">Annuler</button><button class="min-h-10 rounded-lg bg-emerald-900 px-4 text-sm font-semibold text-white disabled:opacity-50" type="submit" [disabled]="saving">{{ saving ? 'Mise à jour…' : 'Réinitialiser' }}</button></div></form>
          } @else {
            <div class="grid gap-5"><p class="m-0 rounded-xl px-4 py-3 text-sm" [class]="dialog.user?.enabled ? 'bg-rose-50 text-rose-900' : 'bg-emerald-50 text-emerald-900'">{{ dialog.user?.enabled ? 'Ce compte perdra l’accès à l’application.' : 'Ce compte pourra de nouveau se connecter.' }}</p><div class="flex justify-end gap-2 border-t border-slate-100 pt-4"><button class="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700" type="button" (click)="closeDialog()">Annuler</button><button class="min-h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50" [class]="dialog.user?.enabled ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-900 hover:bg-emerald-950'" type="button" [disabled]="saving" (click)="submitToggle()">{{ saving ? 'Mise à jour…' : (dialog.user?.enabled ? 'Désactiver le compte' : 'Activer le compte') }}</button></div></div>
          }
        </section>
      </div>
    }
  `
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  readonly roles = ROLES;
  users: User[] = [];
  currentPage = 0;
  totalPages = 1;
  totalElements = 0;
  searchDraft = '';
  private currentSearch = '';
  loading = true;
  saving = false;
  errorMessage = '';
  statusMessage = 'Chargement des utilisateurs…';
  dialog: UserDialog | null = null;
  draft = this.emptyDraft();
  private destroyed = false;

  ngOnInit(): void { void this.loadUsers(); }
  ngOnDestroy(): void { this.destroyed = true; }
  formatDate = formatDate;
  roleLabel(role: string): string { return getUserRoleInfo(role).label; }
  roleClass(role: string): string {
    switch (role) {
      case 'ADMIN': return 'bg-emerald-50 text-emerald-800';
      case 'AGENT': return 'bg-amber-50 text-amber-900';
      case 'CONDUCTEUR': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }
  isSelf(user: User): boolean {
    const me = getCurrentUser();
    return Boolean(me && ((me.id && String(user.id) === String(me.id)) || (me.email && user.email?.toLowerCase() === me.email.toLowerCase())));
  }
  search(): void { this.currentSearch = this.searchDraft.trim(); void this.loadUsers(0); }
  resetSearch(): void { this.searchDraft = ''; this.currentSearch = ''; void this.loadUsers(0); }
  openDialog(mode: DialogMode, user?: User): void {
    this.dialog = { mode, user };
    this.draft = { email: '', displayName: '', password: '', roles: mode === 'create' ? ['CONDUCTEUR'] : [...(user?.roles || [])] };
  }
  closeDialog(): void { if (!this.saving) this.dialog = null; }
  toggleRole(role: string, checked: boolean): void {
    this.draft.roles = checked ? [...new Set([...this.draft.roles, role])] : this.draft.roles.filter(value => value !== role);
  }
  dialogTitle(): string {
    switch (this.dialog?.mode) {
      case 'create': return 'Créer un utilisateur';
      case 'roles': return 'Modifier les rôles';
      case 'password': return 'Réinitialiser le mot de passe';
      default: return this.dialog?.user?.enabled ? 'Désactiver le compte' : 'Activer le compte';
    }
  }
  dialogDescription(): string {
    const user = this.dialog?.user;
    return user ? `${user.displayName || user.email} · ${user.email}` : 'Renseignez les informations du nouveau compte.';
  }

  private emptyDraft(): { email: string; displayName: string; password: string; roles: string[] } {
    return { email: '', displayName: '', password: '', roles: [] };
  }

  async loadUsers(page = 0): Promise<void> {
    const revision = sessionRevision();
    this.currentPage = page;
    this.loading = true;
    this.errorMessage = '';
    this.statusMessage = 'Chargement…';
    try {
      const data = await api(`/api/auth/admin/users${buildQueryString({ page, size: 10, q: this.currentSearch })}`);
      assertCurrentSession(revision);
      if (this.destroyed) return;
      this.users = Array.isArray(data?.content) ? data.content : [];
      this.totalElements = Number(data?.totalElements || this.users.length);
      this.totalPages = Number(data?.totalPages || 1);
      this.statusMessage = this.users.length ? `${this.totalElements} utilisateur(s) trouvé(s).` : 'Aucun utilisateur trouvé.';
    } catch (error) {
      if (this.destroyed || !isCurrentSession(revision)) return;
      this.users = [];
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les utilisateurs.';
      this.statusMessage = 'Erreur de chargement.';
    } finally { if (!this.destroyed && isCurrentSession(revision)) this.loading = false; }
  }

  async submitCreate(): Promise<void> {
    const email = this.draft.email.trim();
    const displayName = this.draft.displayName.trim();
    if (!validateEmail(email)) { showErrorToast('Veuillez saisir une adresse e-mail valide.'); return; }
    if (!displayName) { showErrorToast('Le nom d’affichage est requis.'); return; }
    if (!validatePassword(this.draft.password)) { showErrorToast('Le mot de passe doit comporter au moins 12 caractères.'); return; }
    if (!validateRoles(this.draft.roles)) { showErrorToast('Veuillez sélectionner au moins un rôle valide.'); return; }
    await this.mutate('/api/auth/admin/users', { method: 'POST', body: { email, displayName, password: this.draft.password, roles: this.draft.roles } }, `Utilisateur ${displayName} créé avec succès.`, 0);
  }
  async submitRoles(): Promise<void> {
    const user = this.dialog?.user;
    if (!user || this.isSelf(user)) return;
    if (!validateRoles(this.draft.roles)) { showErrorToast('Veuillez sélectionner au moins un rôle valide.'); return; }
    await this.mutate(`/api/auth/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: { roles: this.draft.roles } }, 'Rôles mis à jour avec succès.');
  }
  async submitPassword(): Promise<void> {
    const user = this.dialog?.user;
    if (!user) return;
    if (!validatePassword(this.draft.password)) { showErrorToast('Le mot de passe doit comporter au moins 12 caractères.'); return; }
    await this.mutate(`/api/auth/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: { newPassword: this.draft.password } }, 'Mot de passe réinitialisé avec succès.', undefined, false);
  }
  async submitToggle(): Promise<void> {
    const user = this.dialog?.user;
    if (!user || this.isSelf(user)) return;
    await this.mutate(`/api/auth/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', body: { enabled: !user.enabled } }, `Compte ${user.enabled ? 'désactivé' : 'activé'} avec succès.`);
  }
  private async mutate(url: string, options: { method: string; body: Record<string, unknown> }, message: string, page = this.currentPage, reload = true): Promise<void> {
    const revision = sessionRevision();
    this.saving = true;
    try {
      await api(url, options);
      assertCurrentSession(revision);
      this.dialog = null;
      showToast(message, 'success');
      if (reload) await this.loadUsers(page);
    } catch (error) {
      if (isCurrentSession(revision)) showErrorToast(error instanceof Error ? error.message : 'La modification a échoué.');
    } finally { this.saving = false; }
  }
}
