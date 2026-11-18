// frontend/js/pages/admin-users.js
// Page de gestion des comptes utilisateurs pour les administrateurs.

import { api } from '../api.js';
import { sessionRevision, isCurrentSession, assertCurrentSession, getCurrentUser } from '../session.js';
import { createDomNode, formatDate, buildQueryString, validateEmail, validatePassword, validateRoles } from '../ui/formatters.js';
import { executeButtonAction } from '../ui/form.js';
import { showToast, showErrorToast } from '../ui/toast.js';
import { createEmptyState } from '../ui/empty-state.js';
import { createLoadingIndicator } from '../ui/loading.js';
import { confirmModal, createCustomModal } from '../ui/modal.js';
import { getUserRoleInfo, getUserStatusInfo } from '../ui/labels.js';

export function renderAdminUsersPage() {
  const container = createDomNode('section', '', 'history', {
    'aria-label': 'Gestion des utilisateurs'
  });

  let currentPage = 0;
  let currentSearch = '';

  // En-tête
  const header = createDomNode('div', '', 'section-heading');
  const introDiv = createDomNode('div');
  introDiv.appendChild(createDomNode('h1', 'Utilisateurs'));
  introDiv.appendChild(createDomNode('p', 'Consultez, créez et gérez les rôles et statuts des utilisateurs du système.', 'muted'));

  const headerActions = createDomNode('div', '', 'row');
  const refreshBtn = createDomNode('button', 'Actualiser', 'quiet', { type: 'button' });
  const createUserBtn = createDomNode('button', '+ Nouvel utilisateur', '', { type: 'button' });
  headerActions.appendChild(refreshBtn);
  headerActions.appendChild(createUserBtn);

  header.appendChild(introDiv);
  header.appendChild(headerActions);

  // Barre de recherche
  const searchForm = createDomNode('form', '', 'search-bar');
  const searchInput = createDomNode('input', '', '', {
    type: 'search',
    name: 'q',
    placeholder: 'Rechercher par adresse e-mail ou nom…'
  });
  const searchSubmitBtn = createDomNode('button', 'Rechercher', 'secondary', { type: 'submit' });
  const searchResetBtn = createDomNode('button', 'Réinitialiser', 'quiet', { type: 'button' });

  searchForm.appendChild(searchInput);
  searchForm.appendChild(searchSubmitBtn);
  searchForm.appendChild(searchResetBtn);

  // Carte du tableau
  const card = createDomNode('div', '', 'card admin-controls');
  const usersStatusEl = createDomNode('p', 'Chargement des utilisateurs…', 'muted', { role: 'status' });
  const usersTableContainer = createDomNode('div', '', 'users-table-container');
  const pagerContainer = createDomNode('div', '', 'row pager');

  card.appendChild(usersStatusEl);
  card.appendChild(usersTableContainer);
  card.appendChild(pagerContainer);

  container.appendChild(header);
  container.appendChild(searchForm);
  container.appendChild(card);

  async function loadUsers(page = 0, q = currentSearch) {
    const revision = sessionRevision();
    currentPage = page;
    currentSearch = q;
    usersStatusEl.textContent = 'Chargement…';
    usersTableContainer.replaceChildren(createLoadingIndicator('Chargement des utilisateurs…'));
    pagerContainer.replaceChildren();

    const query = buildQueryString({ page, size: 10, q });

    try {
      const data = await api(`/api/auth/admin/users${query}`);
      assertCurrentSession(revision);

      const users = Array.isArray(data?.content) ? data.content : [];
      if (users.length === 0) {
        usersStatusEl.textContent = 'Aucun utilisateur trouvé.';
        usersTableContainer.replaceChildren(createEmptyState('Aucun compte utilisateur ne correspond à votre recherche.'));
        return;
      }

      usersStatusEl.textContent = `${data.totalElements || users.length} utilisateur(s) trouvé(s).`;

      const currentUser = getCurrentUser();
      const currentUserId = currentUser?.id;
      const currentUserEmail = currentUser?.email ? currentUser.email.toLowerCase() : '';

      const tableWrapper = createDomNode('div', '', 'table-responsive');
      const table = createDomNode('table', '', 'data-table');
      const thead = createDomNode('thead');
      const trHead = createDomNode('tr');
      trHead.appendChild(createDomNode('th', 'Utilisateur'));
      trHead.appendChild(createDomNode('th', 'Rôles'));
      trHead.appendChild(createDomNode('th', 'Statut'));
      trHead.appendChild(createDomNode('th', 'Créé le'));
      trHead.appendChild(createDomNode('th', 'Actions'));
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = createDomNode('tbody');

      for (const u of users) {
        const tr = createDomNode('tr');

        // Utilisateur (Nom + Email)
        const userCell = createDomNode('td');
        userCell.appendChild(createDomNode('strong', u.displayName || u.email));
        userCell.appendChild(createDomNode('br'));
        userCell.appendChild(createDomNode('span', u.email, 'muted'));
        tr.appendChild(userCell);

        // Rôles
        const rolesCell = createDomNode('td');
        const rolesList = Array.isArray(u.roles) ? u.roles : [];
        const badgesContainer = createDomNode('div', '', 'row');
        for (const role of rolesList) {
          const info = getUserRoleInfo(role);
          badgesContainer.appendChild(createDomNode('span', info.label, info.badgeClass));
        }
        rolesCell.appendChild(badgesContainer);
        tr.appendChild(rolesCell);

        // Statut
        const statusCell = createDomNode('td');
        const statusInfo = getUserStatusInfo(u.enabled);
        statusCell.appendChild(createDomNode('span', statusInfo.label, statusInfo.badgeClass));
        tr.appendChild(statusCell);

        // Date de création
        tr.appendChild(createDomNode('td', formatDate(u.createdAt)));

        // Actions
        const actionsCell = createDomNode('td', '', 'actions-cell');
        const isSelf = (currentUserId && String(u.id) === String(currentUserId)) ||
                       (currentUserEmail && u.email && u.email.toLowerCase() === currentUserEmail);

        // 1. Bouton Activer / Désactiver
        const toggleBtn = createDomNode(
          'button',
          u.enabled ? 'Désactiver' : 'Activer',
          u.enabled ? 'danger' : 'secondary',
          {
            type: 'button',
            title: isSelf ? 'Vous ne pouvez pas modifier le statut de votre propre compte' : ''
          }
        );
        if (isSelf) {
          toggleBtn.disabled = true;
        }

        toggleBtn.addEventListener('click', () => {
          const actionText = u.enabled ? 'désactiver' : 'activer';
          confirmModal({
            title: u.enabled ? 'Désactiver le compte' : 'Activer le compte',
            message: `Êtes-vous sûr de vouloir ${actionText} l'utilisateur "${u.displayName || u.email}" ?`,
            confirmText: u.enabled ? 'Désactiver' : 'Activer',
            isDanger: u.enabled
          }).then(confirmed => {
            if (!confirmed) return;
            executeButtonAction(toggleBtn, async checkSession => {
              await api(`/api/auth/admin/users/${encodeURIComponent(u.id)}`, {
                method: 'PATCH',
                body: { enabled: !u.enabled }
              });
              checkSession();
              showToast(`Compte ${u.enabled ? 'désactivé' : 'activé'} avec succès.`, 'success');
              await loadUsers(currentPage, currentSearch);
            });
          });
        });
        actionsCell.appendChild(toggleBtn);

        // 2. Bouton Modifier les rôles
        const rolesBtn = createDomNode('button', 'Rôles', 'secondary', {
          type: 'button',
          title: isSelf ? 'Vous ne pouvez pas modifier vos propres rôles' : ''
        });
        if (isSelf) {
          rolesBtn.disabled = true;
        }

        rolesBtn.addEventListener('click', () => {
          openEditRolesModal(u);
        });
        actionsCell.appendChild(rolesBtn);

        // 3. Bouton Réinitialiser mot de passe
        const passwordBtn = createDomNode('button', 'Mot de passe', 'secondary', {
          type: 'button'
        });
        passwordBtn.addEventListener('click', () => {
          openResetPasswordModal(u);
        });
        actionsCell.appendChild(passwordBtn);

        tr.appendChild(actionsCell);
        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      usersTableContainer.replaceChildren(tableWrapper);

      // Pagination
      const totalPages = data.totalPages || 1;
      const prevBtn = createDomNode('button', '← Précédent', 'secondary', {
        type: 'button',
        disabled: page <= 0
      });
      const nextBtn = createDomNode('button', 'Suivant →', 'secondary', {
        type: 'button',
        disabled: page >= totalPages - 1
      });
      const pageInfo = createDomNode('span', `Page ${page + 1} sur ${totalPages}`);

      prevBtn.addEventListener('click', () => {
        if (page > 0) loadUsers(page - 1, currentSearch);
      });
      nextBtn.addEventListener('click', () => {
        if (page < totalPages - 1) loadUsers(page + 1, currentSearch);
      });

      pagerContainer.replaceChildren(prevBtn, pageInfo, nextBtn);
    } catch (error) {
      if (!isCurrentSession(revision)) return;
      usersStatusEl.textContent = 'Erreur de chargement.';
      usersTableContainer.replaceChildren(createEmptyState('Impossible de charger les utilisateurs.'));
      showErrorToast(error.message);
    }
  }

  // Modale Création d'utilisateur
  function openCreateUserModal() {
    const form = createDomNode('div', '', 'modal-form');

    const emailLabel = createDomNode('label', 'Adresse e-mail');
    const emailInput = createDomNode('input', '', '', {
      type: 'email',
      placeholder: 'nom@parking.local',
      required: true
    });
    emailLabel.appendChild(emailInput);

    const nameLabel = createDomNode('label', 'Nom d’affichage');
    const nameInput = createDomNode('input', '', '', {
      type: 'text',
      placeholder: 'Jean Dupont',
      required: true
    });
    nameLabel.appendChild(nameInput);

    const pwdLabel = createDomNode('label', 'Mot de passe (12 caractères minimum)');
    const pwdInput = createDomNode('input', '', '', {
      type: 'password',
      placeholder: 'Minimum 12 caractères',
      required: true
    });
    pwdLabel.appendChild(pwdInput);

    const rolesGroup = createDomNode('fieldset', '', 'checkbox-group');
    rolesGroup.appendChild(createDomNode('legend', 'Rôles attribués'));

    const cbConducteur = createRoleCheckbox('CONDUCTEUR', 'Conducteur', true);
    const cbAgent = createRoleCheckbox('AGENT', 'Agent', false);
    const cbAdmin = createRoleCheckbox('ADMIN', 'Administrateur', false);

    rolesGroup.appendChild(cbConducteur.wrapper);
    rolesGroup.appendChild(cbAgent.wrapper);
    rolesGroup.appendChild(cbAdmin.wrapper);

    form.appendChild(emailLabel);
    form.appendChild(nameLabel);
    form.appendChild(pwdLabel);
    form.appendChild(rolesGroup);

    createCustomModal({
      title: 'Créer un nouvel utilisateur',
      content: form,
      confirmText: 'Créer l’utilisateur',
      onConfirm: async (dialog, close) => {
        const email = emailInput.value.trim();
        const displayName = nameInput.value.trim();
        const password = pwdInput.value;

        if (!validateEmail(email)) {
          showErrorToast('Veuillez saisir une adresse e-mail valide.');
          return false;
        }
        if (!displayName) {
          showErrorToast('Le nom d’affichage est requis.');
          return false;
        }
        if (!validatePassword(password)) {
          showErrorToast('Le mot de passe doit comporter au moins 12 caractères.');
          return false;
        }

        const roles = [];
        if (cbConducteur.input.checked) roles.push('CONDUCTEUR');
        if (cbAgent.input.checked) roles.push('AGENT');
        if (cbAdmin.input.checked) roles.push('ADMIN');

        if (!validateRoles(roles)) {
          showErrorToast('Veuillez sélectionner au moins un rôle valide.');
          return false;
        }

        try {
          await api('/api/auth/admin/users', {
            method: 'POST',
            body: { email, displayName, password, roles }
          });
          showToast(`Utilisateur ${displayName} créé avec succès.`, 'success');
          close();
          await loadUsers(0, currentSearch);
          return true;
        } catch (error) {
          showErrorToast(error.message);
          return false;
        }
      }
    });
  }

  // Modale Modification des rôles
  function openEditRolesModal(user) {
    const form = createDomNode('div', '', 'modal-form');
    form.appendChild(createDomNode('p', `Modifier les rôles attribués à ${user.displayName} (${user.email}) :`, 'muted'));

    const existingRoles = Array.isArray(user.roles) ? user.roles : [];

    const rolesGroup = createDomNode('fieldset', '', 'checkbox-group');
    rolesGroup.appendChild(createDomNode('legend', 'Rôles'));

    const cbConducteur = createRoleCheckbox('CONDUCTEUR', 'Conducteur', existingRoles.includes('CONDUCTEUR'));
    const cbAgent = createRoleCheckbox('AGENT', 'Agent', existingRoles.includes('AGENT'));
    const cbAdmin = createRoleCheckbox('ADMIN', 'Administrateur', existingRoles.includes('ADMIN'));

    rolesGroup.appendChild(cbConducteur.wrapper);
    rolesGroup.appendChild(cbAgent.wrapper);
    rolesGroup.appendChild(cbAdmin.wrapper);

    form.appendChild(rolesGroup);

    createCustomModal({
      title: 'Modifier les rôles',
      content: form,
      confirmText: 'Enregistrer les rôles',
      onConfirm: async (dialog, close) => {
        const roles = [];
        if (cbConducteur.input.checked) roles.push('CONDUCTEUR');
        if (cbAgent.input.checked) roles.push('AGENT');
        if (cbAdmin.input.checked) roles.push('ADMIN');

        if (!validateRoles(roles)) {
          showErrorToast('Veuillez sélectionner au moins un rôle.');
          return false;
        }

        try {
          await api(`/api/auth/admin/users/${encodeURIComponent(user.id)}`, {
            method: 'PATCH',
            body: { roles }
          });
          showToast('Rôles mis à jour avec succès.', 'success');
          close();
          await loadUsers(currentPage, currentSearch);
          return true;
        } catch (error) {
          showErrorToast(error.message);
          return false;
        }
      }
    });
  }

  // Modale Réinitialisation du mot de passe
  function openResetPasswordModal(user) {
    const form = createDomNode('div', '', 'modal-form');
    form.appendChild(createDomNode('p', `Définir un nouveau mot de passe pour ${user.displayName} (${user.email}).`, 'muted'));

    const pwdLabel = createDomNode('label', 'Nouveau mot de passe (12 caractères minimum)');
    const pwdInput = createDomNode('input', '', '', {
      type: 'password',
      placeholder: 'Minimum 12 caractères',
      required: true
    });
    pwdLabel.appendChild(pwdInput);
    form.appendChild(pwdLabel);

    createCustomModal({
      title: 'Réinitialiser le mot de passe',
      content: form,
      confirmText: 'Mettre à jour le mot de passe',
      onConfirm: async (dialog, close) => {
        const newPassword = pwdInput.value;
        if (!validatePassword(newPassword)) {
          showErrorToast('Le nouveau mot de passe doit comporter au moins 12 caractères.');
          return false;
        }

        try {
          await api(`/api/auth/admin/users/${encodeURIComponent(user.id)}`, {
            method: 'PATCH',
            body: { newPassword }
          });
          showToast('Mot de passe réinitialisé avec succès.', 'success');
          close();
          return true;
        } catch (error) {
          showErrorToast(error.message);
          return false;
        }
      }
    });
  }

  function createRoleCheckbox(value, label, checked) {
    const wrapper = createDomNode('label', '', 'checkbox-label');
    const input = createDomNode('input', '', '', {
      type: 'checkbox',
      value,
      name: 'roles'
    });
    if (checked) {
      input.checked = true;
    }
    const textNode = document.createTextNode(` ${label}`);
    wrapper.appendChild(input);
    wrapper.appendChild(textNode);
    return { wrapper, input };
  }

  // Événements
  createUserBtn.addEventListener('click', () => openCreateUserModal());

  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    loadUsers(0, searchInput.value.trim());
  });

  searchResetBtn.addEventListener('click', () => {
    searchInput.value = '';
    loadUsers(0, '');
  });

  refreshBtn.addEventListener('click', () => {
    executeButtonAction(refreshBtn, () => loadUsers(currentPage, currentSearch));
  });

  loadUsers(0, '');

  return container;
}
