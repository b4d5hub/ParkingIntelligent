// frontend/js/pages/admin-tariffs.js
import { createDomNode } from '../ui/formatters.js';

export function renderAdminTariffsPage() {
  const container = createDomNode('section', '', 'history', { 'aria-label': 'Tarifs du parking' });
  container.appendChild(createDomNode('h1', 'Tarifs du parking'));
  return container;
}
