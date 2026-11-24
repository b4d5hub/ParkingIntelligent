import { defineConfig } from 'cypress';

export default defineConfig({
  trashAssetsBeforeRuns: false,
  expose: {
    driverEmail: process.env.CYPRESS_DRIVER_EMAIL || 'driver@parking.local',
    agentEmail: process.env.CYPRESS_AGENT_EMAIL || 'agent@parking.local',
    adminEmail: process.env.CYPRESS_ADMIN_EMAIL || 'admin@parking.local',
    multiRoleEmail: process.env.CYPRESS_MULTIROLE_EMAIL || 'super@parking.local'
  },
  env: {
    testPassword: process.env.CYPRESS_TEST_PASSWORD || ''
  },
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://127.0.0.1:8080',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    video: false
  }
});
