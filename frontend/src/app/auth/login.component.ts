import { AfterViewInit, Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { api, renewCsrf } from '../../../js/api.js';
import { setCurrentUser } from '../../../js/session.js';
import { navigate, getDefaultRouteForUser } from '../../../js/router.js';
import { showToast } from '../../../js/ui/toast.js';

@Component({
  selector: 'parking-login',
  standalone: true,
  host: { class: 'block' },
  imports: [FormsModule],
  template: `
    <section class="mx-auto grid min-h-[calc(100dvh-150px)] w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:px-8" aria-label="Connexion">

      <!-- Brand panel: desktop only, so the form is always the first thing on mobile -->
      <aside class="relative isolate hidden overflow-hidden rounded-3xl bg-emerald-950 px-10 py-12 text-white lg:flex lg:min-h-[560px] lg:flex-col lg:justify-between" aria-hidden="true">
        <div class="flex items-center gap-2.5 text-sm font-semibold">
          <span class="grid size-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/25">P</span>
          Parking intelligent
        </div>

        <div>
          <p class="max-w-sm text-[clamp(2.25rem,3.6vw,3.25rem)] font-bold leading-[1.08] tracking-tight">Stationnez sans y penser.</p>
          <p class="mt-4 max-w-sm text-base leading-7 text-emerald-50/75">Réservez un créneau, retrouvez vos réservations et gérez votre espace au même endroit.</p>
        </div>

        <!-- The one memorable element: a parking row with a car arriving at its space -->
        <div class="relative h-24 overflow-hidden rounded-2xl bg-emerald-900/60 ring-1 ring-white/10">
          <div class="absolute inset-x-4 top-1/2 border-t border-dashed border-white/20"></div>
          <div class="absolute inset-y-3 inset-x-6 flex justify-between">
            <span class="w-9 border-x border-white/25"></span>
            <span class="w-9 border-x border-white/25"></span>
            <span class="w-9 border-x border-emerald-300/70 bg-emerald-300/10"></span>
            <span class="w-9 border-x border-white/25"></span>
            <span class="w-9 border-x border-white/25"></span>
          </div>
          <div class="car absolute left-[44%] top-1/2 h-6 w-11 -translate-y-1/2 rounded-[14px] bg-gradient-to-br from-emerald-200 to-emerald-400 shadow-lg">
            <span class="absolute inset-x-2.5 top-1 h-2 rounded-t-md bg-emerald-900/50"></span>
          </div>
        </div>
      </aside>

      <div class="mx-auto w-full max-w-md">
        <!-- Compact brand for small screens -->
        <div class="mb-6 flex items-center gap-2.5 text-sm font-semibold text-emerald-900 lg:hidden">
          <span class="grid size-8 place-items-center rounded-lg bg-emerald-900 text-white" aria-hidden="true">P</span>
          Parking intelligent
        </div>

        <form class="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9"
              novalidate
              (ngSubmit)="submit(loginForm)"
              #loginForm="ngForm"
              [attr.aria-busy]="submitting">
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Connexion</h1>
          <p class="mb-7 mt-1.5 text-sm text-slate-600">Accédez à vos réservations et à votre espace.</p>

          @if (errorMessage) {
            <div #errorBox tabindex="-1" class="mb-5 flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900 focus:outline-none" role="alert">
              <svg class="mt-0.5 size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 6h2v5H9V6zm0 6h2v2H9v-2z" clip-rule="evenodd"/></svg>
              <span>{{ errorMessage }}</span>
            </div>
          }

          <div class="grid gap-5">
            <div class="grid gap-1.5">
              <label class="text-sm font-semibold text-slate-800" for="login-email">Adresse e-mail</label>
              <input #emailInput
                class="h-12 w-full rounded-lg border bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 sm:text-sm"
                [class]="emailInvalid
                  ? 'border-red-500 focus:border-red-600 focus:ring-red-600/15'
                  : 'border-slate-300 focus:border-emerald-700 focus:ring-emerald-700/15'"
                id="login-email" name="email" type="email" inputmode="email"
                autocomplete="username" autocapitalize="none" spellcheck="false" enterkeyhint="next"
                maxlength="254" placeholder="nom@exemple.fr" required email
                [attr.aria-invalid]="emailInvalid"
                [attr.aria-describedby]="emailInvalid ? 'login-email-error' : null"
                [(ngModel)]="email" #emailCtrl="ngModel">
              @if (emailInvalid) {
                <p class="text-sm text-red-700" id="login-email-error">
                  {{ emailCtrl.errors?.['required'] ? 'Saisissez votre adresse e-mail.' : 'Saisissez une adresse valide, par exemple nom@exemple.fr.' }}
                </p>
              }
            </div>

            <div class="grid gap-1.5">
              <label class="text-sm font-semibold text-slate-800" for="login-password">Mot de passe</label>
              <div class="relative">
                <input #passwordInput
                  class="h-12 w-full rounded-lg border bg-white pl-3.5 pr-12 text-base text-slate-900 focus:outline-none focus:ring-4 sm:text-sm"
                  [class]="passwordInvalid
                    ? 'border-red-500 focus:border-red-600 focus:ring-red-600/15'
                    : 'border-slate-300 focus:border-emerald-700 focus:ring-emerald-700/15'"
                  id="login-password" name="password"
                  [type]="showPassword ? 'text' : 'password'"
                  autocomplete="current-password" enterkeyhint="go"
                  maxlength="1024" required
                  [attr.aria-invalid]="passwordInvalid"
                  [attr.aria-describedby]="describedByPassword()"
                  (keyup)="updateCapsLock($event)" (keydown)="updateCapsLock($event)" (blur)="capsLock = false"
                  [(ngModel)]="password" #passwordCtrl="ngModel">
                <button type="button"
                  class="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700"
                  [attr.aria-label]="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                  [attr.aria-pressed]="showPassword"
                  (click)="showPassword = !showPassword">
                  @if (showPassword) {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.7 10.7 0 0112 5c5 0 8.5 4 9.5 7a13 13 0 01-2.6 4M6.6 6.6A13 13 0 002.5 12c1 3 4.5 7 9.5 7a10 10 0 004.4-1"/></svg>
                  } @else {
                    <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12C3.5 9 7 5 12 5s8.5 4 9.5 7c-1 3-4.5 7-9.5 7s-8.5-4-9.5-7z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              @if (passwordInvalid) {
                <p class="text-sm text-red-700" id="login-password-error">Saisissez votre mot de passe.</p>
              }
              @if (capsLock) {
                <p class="text-sm text-amber-800" id="login-caps-hint">Le verrouillage des majuscules est activé.</p>
              }
            </div>
          </div>

          <button class="mt-7 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-950/10 transition-colors hover:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit" [disabled]="submitting">
            @if (submitting) { <span class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true"></span> }
            <span>{{ submitting ? 'Connexion en cours…' : 'Se connecter' }}</span>
          </button>
        </form>

        <p class="mt-5 text-center text-sm text-slate-600">Mot de passe oublié ? Contactez votre administrateur.</p>
      </div>
    </section>
  `,
  styles: [`
    @keyframes park { from { transform: translate(-90px, -50%); } to { transform: translate(0, -50%); } }
    .car { animation: park 1.1s cubic-bezier(.2,.8,.2,1) both; }
    @media (prefers-reduced-motion: reduce) { .car { animation: none; } }
  `]
})
export class LoginComponent implements AfterViewInit {
  @Output() readonly loginSuccess = new EventEmitter<void>();

  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') private passwordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('errorBox') private errorBox?: ElementRef<HTMLElement>;

  email = '';
  password = '';
  errorMessage = '';
  submitting = false;
  showPassword = false;
  capsLock = false;
  private attempted = false;

  @ViewChild('loginForm') private form?: NgForm;

  // Field errors appear after the user leaves a field or tries to submit, never while typing.
  get emailInvalid(): boolean {
    const c = this.form?.controls['email'];
    return !!c && c.invalid && (c.touched || this.attempted);
  }

  get passwordInvalid(): boolean {
    const c = this.form?.controls['password'];
    return !!c && c.invalid && (c.touched || this.attempted);
  }

  ngAfterViewInit(): void {
    // Autofocus on devices with a pointer only, so phones don't pop the keyboard open.
    if (window.matchMedia?.('(hover: hover)').matches) {
      queueMicrotask(() => this.emailInput?.nativeElement.focus());
    }
  }

  describedByPassword(): string | null {
    const ids = [
      this.passwordInvalid ? 'login-password-error' : '',
      this.capsLock ? 'login-caps-hint' : ''
    ].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  }

  updateCapsLock(event: KeyboardEvent): void {
    if (typeof event.getModifierState === 'function') {
      this.capsLock = event.getModifierState('CapsLock');
    }
  }

  async submit(form: NgForm): Promise<void> {
    if (this.submitting) return;

    this.attempted = true;
    if (form.invalid) {
      // Send the user to the first field that needs attention.
      const target = form.controls['email']?.invalid ? this.emailInput : this.passwordInput;
      target?.nativeElement.focus();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    try {
      const user = await api('/api/auth/login', {
        method: 'POST',
        body: new URLSearchParams({ email: this.email.trim(), password: this.password })
      });
      this.password = '';
      await renewCsrf();
      setCurrentUser(user);
      showToast(`Bienvenue, ${user.displayName || user.email} !`, 'success');
      navigate(getDefaultRouteForUser());
      this.loginSuccess.emit();
    } catch (error) {
      this.password = '';
      this.showPassword = false;
      this.attempted = false;
      form.controls['password']?.markAsUntouched();
      this.errorMessage = this.toMessage(error);
      // Let the alert render, then put focus where the user can fix things.
      setTimeout(() => {
        this.passwordInput?.nativeElement.focus();
      });
    } finally {
      this.submitting = false;
    }
  }

  private toMessage(error: unknown): string {
    if (error instanceof TypeError) {
      return 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.';
    }
    if (error instanceof Error && error.message) return error.message;
    return 'La connexion a échoué. Réessayez.';
  }
}