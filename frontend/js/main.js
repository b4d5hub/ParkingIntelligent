// frontend/js/main.js
// Point d'entrée de l'application : initialisation de la session, navigation par rôles et routage.

import { api, renewCsrf, onUnauthorized } from './api.js';
import { getCurrentUser, setCurrentUser, clearSession, isDriver, isAgent, isAdmin, hasAnyRole } from './session.js';
import { ROUTES, navigate, initRouter, getCurrentRoute, getDefaultRouteForUser } from './router.js';
import { createDomNode } from './ui/formatters.js';
import { showToast } from './ui/toast.js';

import { renderLoginPage } from './pages/login.js';
import { renderDriverReservePage } from './pages/driver-reserve.js';
import { renderDriverHistoryPage } from './pages/driver-history.js';
import { renderSubscriptionsPage } from './pages/subscriptions.js';
import { renderAgentOperationsPage } from './pages/agent-operations.js';
import { renderAdminPlacesPage } from './pages/admin-places.js';
import { renderAdminTariffsPage } from './pages/admin-tariffs.js';

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
    tabs.push({ route: ROUTES.ADMIN_PLACES, label: 'Places' });
    tabs.push({ route: ROUTES.ADMIN_TARIFFS, label: 'Tarifs' });
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
    const tabLink = createDomNode('a', tab.label, 'tab', {
      href: tab.route
    });
    if (tab.route === currentRoute) {
      tabLink.classList.add('active');
      tabLink.setAttribute('aria-current', 'page');
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
      pageContentEl.appendChild(renderDriverReservePage());
      break;

    case ROUTES.HISTORY:
      pageContentEl.appendChild(renderDriverHistoryPage());
      break;

    case ROUTES.SUBSCRIPTIONS:
      pageContentEl.appendChild(renderSubscriptionsPage());
      break;

    case ROUTES.OPERATIONS:
      pageContentEl.appendChild(renderAgentOperationsPage());
      break;

    case ROUTES.ADMIN_PLACES:
      pageContentEl.appendChild(renderAdminPlacesPage());
      break;

    case ROUTES.ADMIN_TARIFFS:
      pageContentEl.appendChild(renderAdminTariffsPage());
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

bootstrap();
