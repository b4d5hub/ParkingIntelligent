// frontend/js/ui/empty-state.js
// Affichage des états vides avec message explicite.

import { createDomNode } from './formatters.js';

export function createEmptyState(message = 'Aucune donnée disponible pour le moment.') {
  const container = createDomNode('div', '', 'empty-state', {
    role: 'status'
  });
  const text = createDomNode('p', message, 'muted');
  container.appendChild(text);
  return container;
}
