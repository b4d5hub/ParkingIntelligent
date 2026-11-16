// frontend/js/pages/admin-places.js
import { createDomNode } from '../ui/formatters.js';

export function renderAdminPlacesPage() {
  const container = createDomNode('section', '', 'dashboard', { 'aria-label': 'Gestion des places' });
  container.appendChild(createDomNode('h1', 'Gestion des places'));
  return container;
}
