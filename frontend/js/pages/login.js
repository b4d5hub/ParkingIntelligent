// frontend/js/pages/login.js
// Page de connexion au parking intelligent.

import { api, renewCsrf } from '../api.js';
import { setCurrentUser } from '../session.js';
import { createDomNode } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showErrorToast, showToast } from '../ui/toast.js';

export function renderLoginPage({ onLoginSuccess }) {
  const container = createDomNode('section', '', 'login-layout', {
    'aria-label': 'Espace de connexion'
  });

  // Colonne présentation
  const introCol = createDomNode('div');
  const h1 = createDomNode('h1', 'Votre place,\nau bon moment.');
  const introP = createDomNode(
    'p',
    'Réservez votre créneau ou gérez les arrivées et les départs depuis votre espace.',
    'intro'
  );
  introCol.appendChild(h1);
  introCol.appendChild(introP);

  // Colonne formulaire
  const form = createDomNode('form', '', 'card login-card', {
    novalidate: false
  });
  const h2 = createDomNode('h2', 'Se connecter');

  const emailLabel = createDomNode('label', 'Adresse e-mail');
  const emailInput = createDomNode('input', '', '', {
    type: 'email',
    name: 'email',
    autocomplete: 'username',
    maxlength: 254,
    required: true,
    placeholder: 'nom@exemple.fr'
  });
  emailLabel.appendChild(emailInput);

  const passwordLabel = createDomNode('label', 'Mot de passe');
  const passwordInput = createDomNode('input', '', '', {
    type: 'password',
    name: 'password',
    autocomplete: 'current-password',
    maxlength: 1024,
    required: true
  });
  passwordLabel.appendChild(passwordInput);

  const submitBtn = createDomNode('button', 'Connexion', '', {
    type: 'submit'
  });

  form.appendChild(h2);
  form.appendChild(emailLabel);
  form.appendChild(passwordLabel);
  form.appendChild(submitBtn);

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    executeButtonAction(submitBtn, async checkSession => {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      const payload = new URLSearchParams({ email, password });
      const user = await api('/api/auth/login', {
        method: 'POST',
        body: payload
      });

      checkSession();
      passwordInput.value = '';
      await renewCsrf();
      checkSession();

      setCurrentUser(user);
      showToast(`Bienvenue, ${user.displayName || user.email} !`, 'success');
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(user);
      }
    }, {
      onError: error => {
        passwordInput.value = '';
        if (error.status === 429) {
          showErrorToast('Trop de tentatives de connexion échouées. Compte temporairement verrouillé.');
        }
      }
    });
  });

  container.appendChild(introCol);
  container.appendChild(form);

  return container;
}
