// frontend/js/pages/driver-reserve.js
import { createDomNode } from '../ui/formatters.js';

export function renderDriverReservePage() {
  const container = createDomNode('section', '', 'dashboard', { 'aria-label': 'Réserver une place' });
  container.appendChild(createDomNode('h1', 'Réserver une place'));
  return container;
}
