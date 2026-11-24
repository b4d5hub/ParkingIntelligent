// frontend/js/ui/labels.js
// Référentiel unique des libellés en français et classes de badges CSS.

export const RESERVATION_STATUS = {
  CONFIRMED: { label: 'Confirmée', badgeClass: 'badge badge-confirmed' },
  IN_PROGRESS: { label: 'En cours', badgeClass: 'badge badge-in_progress' },
  COMPLETED: { label: 'Terminée', badgeClass: 'badge badge-completed' },
  CANCELLED: { label: 'Annulée', badgeClass: 'badge badge-cancelled' },
  EXPIRED: { label: 'Expirée', badgeClass: 'badge badge-expired' }
};

export const PAYMENT_STATUS = {
  NOT_DUE: { label: 'Aucun paiement dû', badgeClass: 'badge neutral' },
  PAID: { label: 'Payée', badgeClass: 'badge green' }
};

export const PLACE_STATUS = {
  LIBRE: { label: 'Libre', badgeClass: 'badge badge-libre', bayState: 'available' },
  OCCUPEE: { label: 'Occupée', badgeClass: 'badge badge-occupee', bayState: 'occupied' },
  RESERVEE: { label: 'Réservée', badgeClass: 'badge badge-reservee', bayState: 'awaiting' },
  HORS_SERVICE: { label: 'Hors service', badgeClass: 'badge badge-hors_service', bayState: 'unavailable' }
};

export const SUBSCRIPTION_STATUS = {
  PENDING_PAYMENT: { label: 'En attente de paiement', badgeClass: 'badge badge-pending_payment' },
  ACTIVE: { label: 'Active', badgeClass: 'badge badge-active' },
  EXPIRED: { label: 'Expirée', badgeClass: 'badge badge-expired' },
  CANCELLED: { label: 'Annulée', badgeClass: 'badge badge-cancelled' }
};

export const SUBSCRIPTION_PERIOD = {
  DAILY: { label: 'Journalier', shortLabel: '24 h' },
  WEEKLY: { label: 'Hebdomadaire', shortLabel: '7 j' },
  MONTHLY: { label: 'Mensuel', shortLabel: '1 mois' },
  ANNUAL: { label: 'Annuel', shortLabel: '1 an' }
};

export const VEHICLE_TYPE = {
  VOITURE: 'Voiture',
  MOTO: 'Deux-roues',
  UTILITAIRE: 'Utilitaire'
};

export const USER_ROLE = {
  CONDUCTEUR: { label: 'Conducteur', badgeClass: 'badge neutral' },
  AGENT: { label: 'Agent', badgeClass: 'badge amber' },
  ADMIN: { label: 'Administrateur', badgeClass: 'badge green' }
};

export const USER_STATUS = {
  ACTIVE: { label: 'Actif', badgeClass: 'badge green' },
  DISABLED: { label: 'Désactivé', badgeClass: 'badge neutral' }
};

export function getUserRoleInfo(role) {
  if (role && USER_ROLE[role]) {
    return USER_ROLE[role];
  }
  return { label: role ? String(role) : '—', badgeClass: 'badge neutral' };
}

export function getUserStatusInfo(enabled) {
  if (enabled === true) {
    return USER_STATUS.ACTIVE;
  }
  return USER_STATUS.DISABLED;
}

export function getReservationStatusInfo(status) {
  if (status && RESERVATION_STATUS[status]) {
    return RESERVATION_STATUS[status];
  }
  return { label: status ? String(status) : '—', badgeClass: 'badge neutral' };
}

export function getPaymentStatusInfo(status) {
  if (status && PAYMENT_STATUS[status]) {
    return PAYMENT_STATUS[status];
  }
  return { label: status ? String(status) : '—', badgeClass: 'badge neutral' };
}

export function getPlaceStatusInfo(status) {
  if (status && PLACE_STATUS[status]) {
    return PLACE_STATUS[status];
  }
  return { label: status ? String(status) : '—', badgeClass: 'badge neutral', bayState: 'unchecked' };
}

export function getSubscriptionStatusInfo(status) {
  if (status && SUBSCRIPTION_STATUS[status]) {
    return SUBSCRIPTION_STATUS[status];
  }
  return { label: status ? String(status) : '—', badgeClass: 'badge neutral' };
}

export function getSubscriptionPeriodLabel(period) {
  if (period && SUBSCRIPTION_PERIOD[period]) {
    return SUBSCRIPTION_PERIOD[period].label;
  }
  return period ? String(period) : '—';
}

export function getVehicleTypeLabel(type) {
  if (type && VEHICLE_TYPE[type]) {
    return VEHICLE_TYPE[type];
  }
  return type ? String(type) : '—';
}
