// frontend/js/ui/formatters.js
// Formateurs de données (dates, montants, DOM sécurisé).

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function formatMoney(amount, currency = 'MAD') {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '—';
  }
  const num = Number(amount);
  if (!currency) {
    return `${num.toFixed(2)} (devise à vérifier)`;
  }
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}

export function toLocalIsoString(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || isNaN(Number(minutes))) {
    return '—';
  }
  const mins = Number(minutes);
  if (mins < 1) {
    return '< 1 min';
  }
  if (mins < 60) {
    return `${Math.round(mins)} min`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = Math.round(mins % 60);
  return remMins > 0 ? `${hrs} h ${remMins} min` : `${hrs} h`;
}

export function ratioToPctClass(ratio) {
  if (ratio === null || ratio === undefined || isNaN(Number(ratio))) {
    return 'pct-0';
  }
  const num = Number(ratio);
  const pct = num <= 1 && num >= 0 ? num * 100 : num;
  const clamped = Math.min(100, Math.max(0, Math.round(pct / 5) * 5));
  return `pct-${clamped}`;
}

export function buildQueryString(params = {}) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim());
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 12;
}

export function validateRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  const allowed = ['CONDUCTEUR', 'AGENT', 'ADMIN'];
  return roles.every(r => allowed.includes(r));
}

export function validateDateRange(from, to) {
  if (!from && !to) return { valid: true };
  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return { valid: false, message: 'Format de date invalide.' };
    }
    if (fromDate > toDate) {
      return { valid: false, message: "La date 'Du' doit être antérieure ou égale à la date 'Au'." };
    }
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
      return { valid: false, message: "L'intervalle de dates ne peut pas dépasser 366 jours." };
    }
  }
  return { valid: true };
}

export function createDomNode(tag, text = '', className = '', attributes = {}) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null && text !== '') {
    element.textContent = text;
  }
  if (className) {
    element.className = className;
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) {
      if (key.startsWith('aria-') || key.startsWith('data-') || ['id', 'type', 'name', 'value', 'tabindex', 'role', 'href', 'title', 'placeholder', 'min', 'max', 'step', 'maxlength', 'autocomplete', 'pattern'].includes(key)) {
        element.setAttribute(key, String(value));
      } else if (key === 'required' || key === 'disabled' || key === 'hidden') {
        if (value) element.setAttribute(key, '');
      }
    }
  }
  return element;
}
