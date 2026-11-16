// frontend/js/session.js
// Gestion de la session utilisateur et de la révision d'état pour éviter les états périmés.

let revision = 0;
let currentUser = null;

export class StaleSessionError extends Error {
  constructor() {
    super('La session a changé pendant le traitement de la requête.');
    this.name = 'StaleSessionError';
  }
}

export const sessionRevision = () => revision;
export const isCurrentSession = value => value === revision;

export function advanceSession() {
  revision++;
}

export function assertCurrentSession(value) {
  if (!isCurrentSession(value)) {
    throw new StaleSessionError();
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user ? {
    id: user.id,
    email: user.email,
    displayName: user.displayName || user.email,
    roles: Array.isArray(user.roles) ? [...user.roles] : []
  } : null;
}

export function clearSession() {
  advanceSession();
  currentUser = null;
}

export function hasRole(role) {
  return !!currentUser?.roles?.includes(role);
}

export function isDriver() {
  return hasRole('CONDUCTEUR');
}

export function isAgent() {
  return hasRole('AGENT');
}

export function isAdmin() {
  return hasRole('ADMIN');
}

export function hasAnyRole() {
  return isDriver() || isAgent() || isAdmin();
}
