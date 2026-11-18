// frontend/js/ui/loading.js
// Indicateurs de chargement accessibles.

import { createDomNode } from './formatters.js';

export function createSpinner() {
  return createDomNode('span', '', 'spinner', { 'aria-hidden': 'true' });
}

export function createLoadingIndicator(message = 'Chargement en cours…') {
  const container = createDomNode('div', '', 'loading-indicator', {
    role: 'status',
    'aria-live': 'polite'
  });
  container.appendChild(createSpinner());
  container.appendChild(createDomNode('span', message));
  return container;
}
