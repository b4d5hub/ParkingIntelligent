// frontend/js/pages/agent-operations.js
import { createDomNode } from '../ui/formatters.js';

export function renderAgentOperationsPage() {
  const container = createDomNode('section', '', '', { 'aria-label': 'Arrivées et départs' });
  container.appendChild(createDomNode('h1', 'Arrivées et départs'));
  return container;
}
