// frontend/js/main.js
// Point d'entrée de l'application : initialisation de la session, navigation par rôles et routage.

import { api, renewCsrf, onUnauthorized } from './api.js';
import { getCurrentUser, setCurrentUser, clearSession, isDriver, isAgent, isAdmin, hasAnyRole } from './session.js';
import { ROUTES, navigate, initRouter, getCurrentRoute, getDefaultRouteForUser } from './router.js';
import { createDomNode } from './ui/formatters.js';
import { showToast } from './ui/toast.js';

import { renderLoginPage } from './pages/login.js';

const identityContainer = document.getElementById('identity');
const displayNameEl = document.getElementById('display-name');
const logoutBtn = document.getElementById('logout-btn');
const navEl = document.getElementById('role-navigation');
const pageContentEl = document.getElementById('page-content');
const brandLink = document.getElementById('brand-link');

function getNavigationTabs() {
  const tabs = [];
  if (isDriver()) {
    tabs.push({ route: ROUTES.RESERVE, label: 'Réserver une place' });
    tabs.push({ route: ROUTES.HISTORY, label: 'Mes réservations' });
    tabs.push({ route: ROUTES.SUBSCRIPTIONS, label: 'Abonnements' });
  }
  if (isAgent()) {
    tabs.push({ route: ROUTES.OPERATIONS, label: 'Arrivées et départs' });
  }
  if (isAdmin()) {
    tabs.push({ route: ROUTES.ADMIN_DASHBOARD, label: 'Tableau de bord' });
    tabs.push({ route: ROUTES.ADMIN_PLACES, label: 'Places' });
    tabs.push({ route: ROUTES.ADMIN_TARIFFS, label: 'Tarifs' });
    tabs.push({ route: ROUTES.ADMIN_SUBSCRIPTIONS, label: 'Abonnements' });
    tabs.push({ route: ROUTES.ADMIN_RESERVATIONS, label: 'Réservations' });
    tabs.push({ route: ROUTES.ADMIN_USERS, label: 'Utilisateurs' });
  }
  return tabs;
}

function updateNavigation() {
  const user = getCurrentUser();
  if (!user) {
    identityContainer.hidden = true;
    navEl.hidden = true;
    navEl.replaceChildren();
    brandLink.href = ROUTES.LOGIN;
    return;
  }

  identityContainer.hidden = false;
  displayNameEl.textContent = user.displayName || user.email;
  brandLink.href = getDefaultRouteForUser();

  const tabs = getNavigationTabs();
  navEl.replaceChildren();

  if (tabs.length === 0) {
    navEl.hidden = true;
    return;
  }

  navEl.hidden = false;
  const currentRoute = getCurrentRoute();

  for (const tab of tabs) {
    const tabLink = createDomNode('a', tab.label, 'group relative inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5f277] sm:text-sm', {
      href: tab.route
    });
    if (tab.route === currentRoute) {
      tabLink.classList.add('bg-[#c5f277]', 'text-[#101d2c]', 'hover:bg-[#d2fa8d]', 'hover:text-[#101d2c]');
      tabLink.setAttribute('aria-current', 'page');
    } else {
      tabLink.classList.add('text-slate-300', 'hover:bg-white/[0.06]', 'hover:text-white');
    }
    navEl.appendChild(tabLink);
  }
}

function renderNoRoleView() {
  const container = createDomNode('section', '', 'history', { 'aria-label': 'Accès non configuré' });
  container.appendChild(createDomNode('h1', 'Votre espace'));
  const notice = createDomNode('div', '', 'notice error', { role: 'alert' });
  notice.appendChild(createDomNode('p', "Ce compte ne possède aucun rôle d'accès (conducteur, agent ou administrateur)."));
  container.appendChild(notice);
  return container;
}

function renderRoute(route) {
  updateNavigation();
  pageContentEl.replaceChildren();

  switch (route) {
    case ROUTES.LOGIN:
      pageContentEl.appendChild(renderLoginPage({
        onLoginSuccess: () => {
          navigate(getDefaultRouteForUser());
        }
      }));
      break;

    case ROUTES.RESERVE:
      // Écran rendu par Angular.
      break;

    case ROUTES.HISTORY:
      // Écran rendu par Angular.
      break;

    case ROUTES.SUBSCRIPTIONS:
      // Écran rendu par Angular.
      break;

    case ROUTES.OPERATIONS:
      // Écran rendu par Angular.
      break;

    case ROUTES.ADMIN_DASHBOARD:
      // Cette page est maintenant rendue par AdminDashboardComponent (Angular).
      break;

    case ROUTES.ADMIN_PLACES:
      // Écran rendu par Angular.
      break;

    case ROUTES.ADMIN_TARIFFS:
      // Écran rendu par Angular.
      break;

    case ROUTES.ADMIN_SUBSCRIPTIONS:
      // Écran rendu par Angular.
      break;

    case ROUTES.ADMIN_RESERVATIONS:
      // Écran rendu par Angular.
      break;

    case ROUTES.ADMIN_USERS:
      // Écran rendu par Angular.
      break;

    case ROUTES.NO_ROLE:
      pageContentEl.appendChild(renderNoRoleView());
      break;

    default:
      navigate(getDefaultRouteForUser());
      break;
  }
}

logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // Échec silencieux si réseau coupé
  }
  clearSession();
  await renewCsrf().catch(() => {});
  showToast('Vous avez été déconnecté.', 'success');
  navigate(ROUTES.LOGIN);
});

onUnauthorized(() => {
  showToast('Session expirée. Veuillez vous reconnecter.', 'error');
  navigate(ROUTES.LOGIN);
});

async function bootstrap() {
  try {
    await renewCsrf();
    const currentUser = await api('/api/auth/me');
    setCurrentUser(currentUser);
  } catch {
    clearSession();
  }
  initRouter(renderRoute);
}

export const appReady = bootstrap();
