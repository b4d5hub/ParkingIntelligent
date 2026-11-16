// frontend/js/ui/modal.js
// Boîte de dialogue modale accessible avec piège de focus et support clavier (Échap / Tab).

import { createDomNode } from './formatters.js';

export function createCustomModal({
  title = 'Confirmation',
  content = null,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isDanger = false,
  onConfirm = null
} = {}) {
  return new Promise(resolve => {
    const backdrop = createDomNode('div', '', 'modal-backdrop');
    const dialog = createDomNode('div', '', 'modal-dialog', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title'
    });

    const titleEl = createDomNode('h2', title, '', { id: 'modal-title' });
    const actions = createDomNode('div', '', 'modal-actions');
    const cancelBtn = createDomNode('button', cancelText, 'secondary', { type: 'button' });
    const confirmBtn = createDomNode('button', confirmText, isDanger ? 'danger' : '', { type: 'button' });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    dialog.appendChild(titleEl);
    if (content) {
      dialog.appendChild(content);
    }
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

    const getFocusable = () => {
      const selectors = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
      return Array.from(dialog.querySelectorAll(selectors));
    };

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cleanup(false);
      } else if (event.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    cancelBtn.addEventListener('click', () => cleanup(false));

    confirmBtn.addEventListener('click', async () => {
      if (typeof onConfirm === 'function') {
        confirmBtn.disabled = true;
        try {
          const result = await onConfirm(dialog, () => cleanup(true));
          if (result !== false) {
            cleanup(true);
          }
        } catch {
          // L'erreur est gérée dans onConfirm (ex: affichage de toast)
        } finally {
          confirmBtn.disabled = false;
        }
      } else {
        cleanup(true);
      }
    });

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        cleanup(false);
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.body.appendChild(backdrop);

    // Mettre le focus sur le premier champ ou sur le bouton de confirmation
    const focusable = getFocusable();
    const firstInput = focusable.find(el => el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
    if (firstInput) {
      firstInput.focus();
    } else {
      confirmBtn.focus();
    }
  });
}

export function confirmModal({
  title = 'Confirmation',
  message = 'Êtes-vous sûr de vouloir continuer ?',
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isDanger = false
} = {}) {
  const messageEl = createDomNode('p', message, 'muted');
  return createCustomModal({
    title,
    content: messageEl,
    confirmText,
    cancelText,
    isDanger
  });
}
