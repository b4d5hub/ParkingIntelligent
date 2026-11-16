// frontend/js/ui/modal.js
// Boîte de dialogue modale accessible avec piège de focus et support clavier (Échap / Entrée).

import { createDomNode } from './formatters.js';

export function confirmModal({
  title = 'Confirmation',
  message = 'Êtes-vous sûr de vouloir continuer ?',
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isDanger = false
} = {}) {
  return new Promise(resolve => {
    const backdrop = createDomNode('div', '', 'modal-backdrop');
    const dialog = createDomNode('div', '', 'modal-dialog', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title'
    });

    const titleEl = createDomNode('h2', title, '', { id: 'modal-title' });
    const messageEl = createDomNode('p', message, 'muted');

    const actions = createDomNode('div', '', 'modal-actions');
    const cancelBtn = createDomNode('button', cancelText, 'secondary', { type: 'button' });
    const confirmBtn = createDomNode('button', confirmText, isDanger ? 'danger' : '', { type: 'button' });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);

    const previouslyFocused = document.activeElement;

    const cleanup = confirmed => {
      document.removeEventListener('keydown', handleKeyDown);
      backdrop.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
      resolve(confirmed);
    };

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(false);
      } else if (event.key === 'Tab') {
        const focusable = [cancelBtn, confirmBtn];
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable[1].focus();
        } else if (!event.shiftKey && document.activeElement === focusable[1]) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    };

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        cleanup(false);
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.body.appendChild(backdrop);
    confirmBtn.focus();
  });
}
