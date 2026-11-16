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
