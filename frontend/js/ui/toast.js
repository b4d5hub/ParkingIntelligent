// frontend/js/ui/toast.js
// Système de notifications temporaires accessibles (Toasts avec aria-live).

import { createDomNode } from './formatters.js';

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = createDomNode('div', '', 'toast-container', {
        id: 'toast-container',
        role: 'region',
        'aria-label': 'Notifications'
      });
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export function showToast(message, type = 'success', duration = 5000) {
  if (!message) return;
  const container = getToastContainer();

  const isError = type === 'error';
  const toast = createDomNode('div', '', `toast ${type}`, {
    role: isError ? 'alert' : 'status',
    'aria-live': isError ? 'assertive' : 'polite'
  });

  const textSpan = createDomNode('span', message);
  const closeBtn = createDomNode('button', '×', 'toast-close', {
    type: 'button',
    'aria-label': 'Fermer la notification'
  });

  let timeoutId = null;
  const removeToast = () => {
    if (timeoutId) clearTimeout(timeoutId);
    toast.remove();
  };

  closeBtn.addEventListener('click', removeToast);

  toast.appendChild(textSpan);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  if (duration > 0) {
    timeoutId = setTimeout(removeToast, duration);
  }

  return removeToast;
}

export function showErrorToast(message, duration = 7000) {
  return showToast(message, 'error', duration);
}
