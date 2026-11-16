// frontend/js/router.js
// Routeur par hachage d'URL (#route) avec contrôles de rôles.

import { getCurrentUser, isDriver, isAgent, isAdmin, hasAnyRole } from './session.js';

export const ROUTES = {
  LOGIN: '#login',
  RESERVE: '#reserve',
  HISTORY: '#history',
  SUBSCRIPTIONS: '#subscriptions',
  OPERATIONS: '#operations',
  ADMIN_PLACES: '#admin-places',
  ADMIN_TARIFFS: '#admin-tariffs',
  NO_ROLE: '#no-role'
};

let currentRoute = null;
let routeChangeHandler = null;

export function getDefaultRouteForUser() {
  const user = getCurrentUser();
  if (!user) return ROUTES.LOGIN;
  if (isDriver()) return ROUTES.RESERVE;
  if (isAgent()) return ROUTES.OPERATIONS;
  if (isAdmin()) return ROUTES.ADMIN_PLACES;
  return ROUTES.NO_ROLE;
}

export function isRouteAllowed(route) {
  const user = getCurrentUser();
  if (!user) return route === ROUTES.LOGIN;
  if (route === ROUTES.LOGIN) return false;
  if (route === ROUTES.NO_ROLE) return !hasAnyRole();

  if ([ROUTES.RESERVE, ROUTES.HISTORY, ROUTES.SUBSCRIPTIONS].includes(route)) {
    return isDriver();
  }
  if (route === ROUTES.OPERATIONS) {
    return isAgent();
  }
  if ([ROUTES.ADMIN_PLACES, ROUTES.ADMIN_TARIFFS].includes(route)) {
    return isAdmin();
  }
  return false;
}

export function navigate(route) {
  if (window.location.hash !== route) {
    window.location.hash = route;
  } else {
    handleHashChange();
  }
}

function handleHashChange() {
  let hash = window.location.hash || '';
  if (!hash || hash === '#') {
    hash = getDefaultRouteForUser();
    window.location.replace(hash);
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    if (hash !== ROUTES.LOGIN) {
      window.location.replace(ROUTES.LOGIN);
      return;
    }
  } else {
    if (hash === ROUTES.LOGIN) {
      window.location.replace(getDefaultRouteForUser());
      return;
    }
    if (!isRouteAllowed(hash)) {
      window.location.replace(getDefaultRouteForUser());
      return;
    }
  }

  currentRoute = hash;
  if (typeof routeChangeHandler === 'function') {
    routeChangeHandler(currentRoute);
  }
}

export function initRouter(handler) {
  routeChangeHandler = handler;
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

export function getCurrentRoute() {
  return currentRoute;
}
