describe('Parcours de connexion conducteur', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/auth/csrf').as('csrf');
    cy.intercept('GET', '/api/auth/me').as('sessionProbe');
    cy.visit('/#login');
    cy.wait('@csrf').its('response.statusCode').should('eq', 200);
    cy.wait('@sessionProbe').its('response.statusCode').should('eq', 401);
    cy.get('parking-login form').should('be.visible');
  });

  it('affiche le formulaire de connexion', () => {
    cy.get('parking-login h1').should('contain.text', 'Connexion');
    cy.get('parking-login #login-email').should('be.visible');
    cy.get('parking-login #login-password').should('be.visible');
    cy.get('parking-login button[type="submit"]').should('contain.text', 'Se connecter');
  });

  it('signale les champs obligatoires sans appeler le serveur', () => {
    cy.get('parking-login button[type="submit"]').click();
    cy.get('#login-email-error').should('contain.text', 'Saisissez votre adresse e-mail.');
    cy.get('#login-password-error').should('contain.text', 'Saisissez votre mot de passe.');
  });

  it('connecte le conducteur et ouvre son espace', () => {
    loginAs(Cypress.expose('driverEmail'), '#reserve', ['#reserve', '#history', '#subscriptions']);
  });
});

describe('Navigation selon le rôle avec session simulée', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/auth/csrf', {
      statusCode: 200,
      body: { headerName: 'X-CSRF-TOKEN', token: 'cypress-test-token' }
    }).as('csrf');
    cy.intercept('GET', '/api/auth/me', {
      statusCode: 401,
      body: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentification requise' }
    }).as('sessionProbe');
    cy.intercept('GET', '/api/places', { statusCode: 503, body: [] });
    cy.intercept('GET', '/api/reservations/**', { statusCode: 503, body: {} });
    cy.intercept('GET', '/api/tarifs/**', { statusCode: 503, body: {} });
    cy.intercept('GET', '/api/subscriptions/**', { statusCode: 503, body: {} });
    cy.visit('/#login');
    cy.wait('@csrf').its('response.statusCode').should('eq', 200);
    cy.wait('@sessionProbe').its('response.statusCode').should('eq', 401);
    cy.get('parking-login form').should('be.visible');
  });

  it('ouvre l’espace Agent avec son seul onglet', () => {
    loginAsRole(Cypress.expose('agentEmail'), ['AGENT'], '#operations', ['#operations']);
    cy.get('#role-navigation a').should('have.length', 1);
    cy.get('parking-agent-operations form[aria-label="Période des opérations"]').should('be.visible');
  });

  it('ouvre le tableau de bord et les six onglets Administrateur', () => {
    const adminTabs = [
      '#admin-dashboard', '#admin-places', '#admin-tariffs',
      '#admin-subscriptions', '#admin-reservations', '#admin-users'
    ];
    loginAsRole(Cypress.expose('adminEmail'), ['ADMIN'], '#admin-dashboard', adminTabs);
    cy.get('#role-navigation a').should('have.length', 6);
    cy.get('parking-admin-dashboard section[aria-label="Tableau de bord administrateur"]').should('be.visible');
  });

  it('affiche les onglets Conducteur, Agent et Administrateur pour le compte multirôles', () => {
    const allRoleTabs = [
      '#reserve', '#history', '#subscriptions', '#operations', '#admin-dashboard',
      '#admin-places', '#admin-tariffs', '#admin-subscriptions', '#admin-reservations', '#admin-users'
    ];
    loginAsRole(Cypress.expose('multiRoleEmail'), ['CONDUCTEUR', 'AGENT', 'ADMIN'], '#reserve', allRoleTabs);
    cy.get('#role-navigation a').should('have.length', 10);
  });
});

afterEach(function () {
  if (this.currentTest?.state === 'passed') {
    const name = this.currentTest.fullTitle().replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    cy.screenshot(name);
  }
});

function loginAsRole(email, roles, expectedRoute, expectedTabs) {
  cy.intercept('POST', '/api/auth/login', {
    statusCode: 200,
    body: { userId: '9001', email, displayName: 'Utilisateur Cypress', roles }
  }).as('login');

  cy.get('parking-login #login-email').clear().type(email);
  cy.get('parking-login #login-password').type('password-cypress', { log: false });
  cy.get('parking-login button[type="submit"]').click();

  cy.wait('@login').its('response.statusCode').should('eq', 200);
  cy.get('#identity').should('be.visible');
  cy.location('hash').should('eq', expectedRoute);
  for (const route of expectedTabs) {
    cy.get(`#role-navigation a[href="${route}"]`).should('be.visible');
  }
}

function loginAs(email, expectedRoute, expectedTabs) {
  cy.env(['testPassword']).then(({ testPassword }) => {
    if (!testPassword) {
      throw new Error('Définis CYPRESS_TEST_PASSWORD avant de lancer les tests de connexion.');
    }

    cy.intercept('POST', '/api/auth/login').as('login');
    cy.get('parking-login #login-email').clear().type(email);
    cy.get('parking-login #login-password').type(testPassword, { log: false });
    cy.get('parking-login button[type="submit"]').click();

    cy.wait('@login').its('response.statusCode').should('eq', 200);
    cy.get('#identity').should('be.visible');
    cy.get('#display-name').should('not.be.empty');
    cy.location('hash').should('eq', expectedRoute);
    for (const route of expectedTabs) {
      cy.get(`#role-navigation a[href="${route}"]`).should('be.visible');
    }
  });
}
