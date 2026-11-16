// frontend/js/pages/subscriptions.js
import { createDomNode } from '../ui/formatters.js';

export function renderSubscriptionsPage() {
  const container = createDomNode('section', '', '', { 'aria-label': 'Abonnements' });
  container.appendChild(createDomNode('h1', 'Abonnements'));
  return container;
}
