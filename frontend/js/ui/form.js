// frontend/js/ui/form.js
// Gestion des soumissions de formulaires et désactivation des boutons d'action.

import { sessionRevision, isCurrentSession, assertCurrentSession, StaleSessionError } from '../session.js';
import { showErrorToast, showToast } from './toast.js';

const activeOperations = new WeakMap();

export async function executeButtonAction(button, task, { successMessage = '', onError = null } = {}) {
  const revision = sessionRevision();
  const operation = Symbol();
  activeOperations.set(button, operation);
  const originalDisabled = button.disabled;
  button.disabled = true;

  try {
    await task(() => assertCurrentSession(revision));
    if (successMessage && isCurrentSession(revision)) {
      showToast(successMessage, 'success');
    }
  } catch (error) {
    if (error instanceof StaleSessionError || !isCurrentSession(revision)) {
      return;
    }
    const message = error.message || 'Une erreur est survenue lors de l’opération.';
    showErrorToast(message);
    if (typeof onError === 'function') {
      onError(error);
    }
  } finally {
    if (activeOperations.get(button) === operation) {
      activeOperations.delete(button);
      button.disabled = originalDisabled;
    }
  }
}
