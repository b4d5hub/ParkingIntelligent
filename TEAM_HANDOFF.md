# Regles actualisees au 7 novembre 2026

Le creneau est paye a la reservation, sans remboursement. Le retard ne prolonge pas le creneau et ne provoque pas d'expiration automatique. Seul le temps apres la fin prevue est facture en plus au depart, sans penalite.

Amine : valider le contrat du complement decrit dans RESERVATIONS.md (intervalle fin prevue -> depart reel, quoteReference=null), fournir les endpoints et leur configuration. Les endpoints Places existent maintenant ; leur assemblage avec Reservations est decrit dans PLACES_INTEGRATION.md. Les anciennes reservations non prepayees gardent leur regle historique.

# Passage à l'équipe

## Partie de Badr Eddine

Reservations fournit le paiement simule du creneau a la reservation, sans remboursement, et du temps apres la fin prevue au depart. La consultation, les verrous et les commandes Places persistantes restent en place.

Le dépôt fournit aussi la connexion commune, les sessions PostgreSQL, CSRF, la validation interne, les écrans Réservations et une installation Compose locale. Les tests avec PostgreSQL utilisent un conteneur temporaire, pas la base de travail.

Les API Places sont implémentées. Leur intégration avec Réservations, l'authentification commune et le vrai frontend Nginx a passé treize contrôles navigateur sur une base temporaire le 8 novembre 2026. Tarifs était simulé dans cette campagne ; son intégration réelle et celle d'Abonnements restent à terminer. Voir `PLACES_INTEGRATION.md` et `docs/tests/Contribution_Reservations.md`. Les types de véhicules et la devise ne sont pas imposés aux autres modules.

## Zakariya — Places

Les routes et la liste réelle sont disponibles. La configuration du frontend et de Réservations utilise maintenant ce contrat. Vérifier encore les commandes réutilisant une même clé avec un contenu différent : le service Places doit refuser cette réutilisation plutôt que l'accepter sans vérifier le contenu. Maintenir le contrôle du propriétaire de l'occupation.

La disponibilité future est calculée sur les créneaux Réservations. Ne pas confondre ce résultat avec le champ d'occupation actuelle. Ne pas écrire directement dans les tables Réservations.

## Amine — Tarifs

Confirmer estimation du creneau et complement fin prevue -> depart reel, montants decimaux, devise, types de vehicules et date de reduction. Voir le contrat propose dans RESERVATIONS.md.

Contacter Abonnements pour les réductions. Aucune réduction imposée par le navigateur ne doit être acceptée. Aucun abonnement valide signifie zéro réduction.

## Kamal — Abonnements

Confirmer la correspondance de l'identifiant utilisateur commun et du conducteur. Protéger chaque conducteur pour ses propres abonnements. Fournir à Tarifs le contrat de validation/réduction et ses dates. Les écrans de souscription, renouvellement manuel et annulation restent dans ce module, ainsi que sa simulation de paiement.

## Travail commun restant

- Aucune expiration pour absence ; le retard ne prolonge pas le creneau.
- Accepter les contrats Places/Tarifs/authentification, choisir les identifiants et secrets machines hors Git, puis tester les échanges entre les vrais services. Configurer `PLACES_SYNC_ENABLED=true` après validation du contrat Places.
- Ajouter les trois services et leurs routes au Compose/frontend commun, avec leurs technologies et ports réels. Réutiliser l'unique base PostgreSQL, sans base séparée par module.
- Intégrer les écrans Places, Tarifs et Abonnements au frontend. Les écrans Réservations sont portables ; adopter le framework commun seulement après choix d'équipe.
- Sauvegarder et migrer chaque installation existante après revue des données, créer les comptes utiles et tester les droits dans chacun des quatre backends.
- Tester les parcours reels : concurrence, annulation sans remboursement, arrivee tardive, depart anticipe sans remboursement, depassement avec complement, reprises reseau et Places, comptes revoques.
- Actualiser les diagrammes : paiement initial, aucun remboursement, paiement du temps apres la fin prevue, sans penalite.

Pour un hébergement en ligne : origine HTTPS et cookie Secure, proxy de confiance, secrets distincts, sauvegardes et droits DB restreints. La limitation applicative par adresse voit l'adresse du proxy ; Nginx limite aussi les tentatives par vraie adresse cliente. Un déploiement à plusieurs instances demande un limiteur partagé. Inscription publique, récupération de compte et MFA ne font pas partie du prototype livré ici et doivent être définis avant usage réel.
