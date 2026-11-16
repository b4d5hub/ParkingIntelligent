// frontend/js/pages/driver-history.js
import { createDomNode } from '../ui/formatters.js';

export function renderDriverHistoryPage() {
  const container = createDomNode('section', '', 'history', { 'aria-label': 'Mes réservations' });
  container.appendChild(createDomNode('h1', 'Mes réservations'));
  return container;
}
