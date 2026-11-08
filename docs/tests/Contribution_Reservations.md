# Contribution Réservations au dossier commun de tests

Responsable : Ouajih Badr Eddine. Cette contribution doit être intégrée au dossier unique de l'équipe. Elle ne remplace pas les contributions Places, Tarifs et Abonnements ni leur validation.

## Objectif et périmètre

La classe métier étudiée est `ReservationService`, dans le package `com.parking.reservations_service.service`. Les tests vérifient la consultation personnelle, la disponibilité, le devis, la création, l'annulation, l'arrivée et le départ. Ils couvrent aussi la désactivation de l'expiration pour absence, conformément à la règle du créneau payé.

Les tests unitaires utilisent JUnit et Mockito, une horloge fixe et des partenaires simulés. Ils ne nécessitent pas de serveur ni de vraie base de données. Les vérifications PostgreSQL et navigateur sont présentées séparément ; elles ne sont pas comptées comme tests unitaires métier.

## Règles actuelles

- Le conducteur paie le créneau complet à la réservation ; le paiement est simulé.
- Une annulation autorisée avant le début ou un départ anticipé ne donne aucun remboursement.
- Un retard d'arrivée ne prolonge pas le créneau et ne provoque pas d'expiration automatique.
- Au départ, seul le temps après la fin prévue est facturé en plus, au tarif normal sans pénalité.
- Une reprise réseau ne doit pas créer une deuxième réservation ou répéter un paiement.
- Les réservations historiques non prépayées gardent leur règle initiale de paiement au départ.

## Tests unitaires métier

Les rapports Surefire de la version vérifiée contiennent 41 tests métier réussis, sans échec :

- `ReservationQueriesTests` : 13 tests de consultation, pagination, propriété, disponibilité et estimation.
- `ReservationWorkflowTests` : 28 tests de création, paiement, annulation, arrivée, départ et absence d'expiration anticipée.

Exemples de fiches à intégrer au dossier unique :

1. Création normale : place en service et créneau libre, devis de 15,00. Résultat attendu : réservation confirmée, `bookingPaid=15.00`, statut de paiement `PAID` et référence `SIM-...`.
2. Erreur de chevauchement : un créneau actif existe déjà. Résultat attendu : conflit et aucun enregistrement supplémentaire.
3. Reprise de création : même conducteur, même clé et même demande. Résultat attendu : même réservation, sans nouveau devis ni paiement.
4. Annulation avant début : réservation payée appartenant au conducteur. Résultat attendu : `CANCELLED`, paiement initial et référence conservés, aucun remboursement.
5. Départ anticipé : créneau payé 15,00 et départ avant la fin prévue. Résultat attendu : total 15,00, complément 0,00 et aucun appel de calcul supplémentaire à Tarifs.
6. Limite à la fin exacte : départ exactement à la fin du créneau. Résultat attendu : aucun complément.
7. Dépassement : départ dix minutes après la fin prévue ; réponse Tarifs de 12,50 pour cet intervalle. Résultat attendu : total 27,50, paiement initial conservé et référence distincte pour le complément.
8. Reprise du départ : départ déjà enregistré. Résultat attendu : mêmes montants et références, aucun deuxième appel Tarifs ni deuxième commande de libération.
9. Erreur de devise : complément renvoyé dans une autre devise. Résultat attendu : refus et réservation toujours en cours, sans paiement complémentaire enregistré.
10. Retard : arrivée pendant le créneau payé après l'ancien délai de quinze minutes. Résultat attendu : arrivée acceptée si la place est libre. À la fin prévue ou après, elle est refusée.

Les noms exacts des méthodes et les assertions sont dans les deux classes de test. Les rapports de référence sont `reservations-service/target/surefire-reports/TEST-com.parking.reservations_service.service.ReservationQueriesTests.xml` et `TEST-com.parking.reservations_service.service.ReservationWorkflowTests.xml`.

## Vérifications complémentaires

La campagne Java précédente compte 103 tests réussis, dont les 41 tests métier ci-dessus, des tests HTTP/authentification et des tests PostgreSQL sur une base temporaire. Le code Java Réservations n'a pas changé pendant l'intégration Places du 8 novembre 2026. Les résultats ne prouvent pas une intégration avec les API réelles de Tarifs ou d'Abonnements.

Dix tests JavaScript vérifient notamment CSRF, les reprises réseau et les réponses devenues obsolètes après un changement de compte. La vérification Places du 8 novembre a passé treize contrôles avec les vrais services Réservations et Places, le vrai frontend Nginx et une base PostgreSQL 17 temporaire ; Tarifs reste simulé. Quatre régressions navigateur de changement de compte ont aussi réussi, dont une réponse Places ancienne. Les résultats complets et les limites sont dans `PLACES_INTEGRATION.md`. Ces contrôles complémentaires ne sont pas ajoutés au nombre de tests unitaires JUnit.

## Anomalies et limites

L'ancien scénario « aucun paiement à la réservation » doit être remplacé par le paiement initial. Le calcul sur toute la durée réelle ne reste valable que pour les réservations historiques non prépayées. Les anciennes fiches décrivant l'expiration après quinze minutes ne représentent plus la règle retenue.

L'intégration Tarifs réelle, ses réductions Abonnements et le parcours complet entre les quatre services restent à vérifier. L'application des migrations sur une base de travail n'est pas une étape automatique des tests. Les signatures et l'approbation finale restent à remplir par les personnes concernées.
