// frontend/test/labels.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getReservationStatusInfo,
  getPaymentStatusInfo,
  getPlaceStatusInfo,
  getSubscriptionStatusInfo,
  getSubscriptionPeriodLabel,
  getVehicleTypeLabel
} from '../js/ui/labels.js';

test('labels: statut de réservation', () => {
  assert.equal(getReservationStatusInfo('CONFIRMED').label, 'Confirmée');
  assert.equal(getReservationStatusInfo('CONFIRMED').badgeClass, 'badge badge-confirmed');

  assert.equal(getReservationStatusInfo('IN_PROGRESS').label, 'En cours');
  assert.equal(getReservationStatusInfo('COMPLETED').label, 'Terminée');
  assert.equal(getReservationStatusInfo('CANCELLED').label, 'Annulée');
  assert.equal(getReservationStatusInfo('EXPIRED').label, 'Expirée');

  // Valeur inconnue / fallback neutre
  const unknown = getReservationStatusInfo('STRANGE_STATUS');
  assert.equal(unknown.label, 'STRANGE_STATUS');
  assert.equal(unknown.badgeClass, 'badge neutral');

  const empty = getReservationStatusInfo(null);
  assert.equal(empty.label, '—');
  assert.equal(empty.badgeClass, 'badge neutral');
});

test('labels: statut de place', () => {
  assert.equal(getPlaceStatusInfo('LIBRE').label, 'Libre');
  assert.equal(getPlaceStatusInfo('LIBRE').badgeClass, 'badge badge-libre');
  assert.equal(getPlaceStatusInfo('LIBRE').bayState, 'available');

  assert.equal(getPlaceStatusInfo('OCCUPEE').label, 'Occupée');
  assert.equal(getPlaceStatusInfo('RESERVEE').label, 'Réservée');
  assert.equal(getPlaceStatusInfo('HORS_SERVICE').label, 'Hors service');

  // Fallback
  const unknown = getPlaceStatusInfo('SPECIAL');
  assert.equal(unknown.label, 'SPECIAL');
  assert.equal(unknown.badgeClass, 'badge neutral');
});

test('labels: statut d’abonnement', () => {
  assert.equal(getSubscriptionStatusInfo('ACTIVE').label, 'Active');
  assert.equal(getSubscriptionStatusInfo('ACTIVE').badgeClass, 'badge badge-active');

  assert.equal(getSubscriptionStatusInfo('PENDING_PAYMENT').label, 'En attente de paiement');
  assert.equal(getSubscriptionStatusInfo('EXPIRED').label, 'Expirée');
  assert.equal(getSubscriptionStatusInfo('CANCELLED').label, 'Annulée');

  // Fallback
  const unknown = getSubscriptionStatusInfo('CUSTOM_SUB');
  assert.equal(unknown.label, 'CUSTOM_SUB');
  assert.equal(unknown.badgeClass, 'badge neutral');
});

test('labels: formules d’abonnement', () => {
  assert.equal(getSubscriptionPeriodLabel('DAILY'), 'Journalier');
  assert.equal(getSubscriptionPeriodLabel('WEEKLY'), 'Hebdomadaire');
  assert.equal(getSubscriptionPeriodLabel('MONTHLY'), 'Mensuel');
  assert.equal(getSubscriptionPeriodLabel('ANNUAL'), 'Annuel');
  assert.equal(getSubscriptionPeriodLabel('BIENNIAL'), 'BIENNIAL');
});

test('labels: statut de paiement', () => {
  assert.equal(getPaymentStatusInfo('NOT_DUE').label, 'Aucun paiement dû');
  assert.equal(getPaymentStatusInfo('PAID').label, 'Payée');
  assert.equal(getPaymentStatusInfo('OTHER').label, 'OTHER');
});

test('labels: type de véhicule', () => {
  assert.equal(getVehicleTypeLabel('VOITURE'), 'Voiture');
  assert.equal(getVehicleTypeLabel('MOTO'), 'Deux-roues');
  assert.equal(getVehicleTypeLabel('CAMION'), 'CAMION');
});
