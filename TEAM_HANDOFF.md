# Regles actualisees au 7 novembre 2026

Le creneau est paye a la reservation, sans remboursement. Le retard ne prolonge pas le creneau et ne provoque pas d'expiration automatique. Seul le temps apres la fin prevue est facture en plus au depart, sans penalite.

Amine : valider le contrat du complement decrit dans RESERVATIONS.md (intervalle fin prevue -> depart reel, quoteReference=null), fournir les endpoints et leur configuration. Zakariya : fournir les endpoints Places et leur configuration. Ces integrations reelles restent non verifiees. Les anciennes reservations non prepayees gardent leur regle historique.

# Passage à l'équipe

## Partie de Badr Eddine

Reservations fournit le paiement simule du creneau a la reservation, sans remboursement, et du temps apres la fin prevue au depart. La consultation, les verrous et les commandes Places persistantes restent en place.

Le dépôt fournit aussi la connexion commune, les sessions PostgreSQL, CSRF, la validation interne, les écrans Réservations et une installation Compose locale. Les tests avec PostgreSQL utilisent un conteneur temporaire, pas la base de travail.

Les API partenaires sont des propositions d'adaptation, pas des intégrations réalisées avec les trois autres backends. Les types de véhicules et la devise ne sont pas imposés aux autres modules.

## Zakariya — Places

Confirmer les routes et formats de [RESERVATIONS.md](RESERVATIONS.md). Fournir la liste des places au frontend, leur état de service et leur occupation réelle. Protéger les appels d'occupation/libération par un compte machine Réservations. Mémoriser les clés d'idempotence et le propriétaire de l'occupation : une ancienne libération ne doit pas vider une place réaffectée.

La disponibilité future est calculée sur les créneaux Réservations. Ne pas confondre ce résultat avec le champ d'occupation actuelle. Ne pas écrire directement dans les tables Réservations.

## Amine — Tarifs

Confirmer estimation du creneau et complement fin prevue -> depart reel, montants decimaux, devise, types de vehicules et date de reduction. Voir le contrat propose dans RESERVATIONS.md.


## Kamal — Abonnements

Confirmer la correspondance de l'identifiant utilisateur commun et du conducteur. Protéger chaque conducteur pour ses propres abonnements. 

Règles retenues pour le premier périmètre : chaque abonnement a un identifiant unique, des dates de début et de fin, un prix et un statut ; les formules sont journalière, hebdomadaire, mensuelle ou annuelle ; un abonnement ne devient actif qu'après confirmation du paiement et n'est plus valide à partir de sa date de fin. Le prix vient d'une configuration serveur par période, jamais du navigateur. Tarifs de départ proposés pour le prototype : 40 MAD/jour, 180 MAD/semaine, 450 MAD/mois et 4 800 MAD/an. Générer une notification sept jours avant l'expiration. Le premier service Nest.js, son accès PostgreSQL, ses migrations et son conteneur Compose sont en place. Le raccordement de l'authentification conducteur et du paiement restent à faire ; le job journalise les notifications, l'envoi par courriel viendra quand un service de messagerie sera configuré.

Tests unitaires à livrer en priorité : calcul des dates pour chaque formule, état en attente avant paiement, activation après paiement, confirmation de paiement répétée sans double activation, accès refusé avant paiement et à/après la date de fin, et notification due au seuil des sept jours. Le job réserve la notification par une mise à jour atomique en base. Les tests de dates utilisent une horloge contrôlable et couvrent la limite exacte de la date de fin.

## Travail commun restant

- Aucune expiration pour absence ; le retard ne prolonge pas le creneau.
- Accepter les contrats Places/Tarifs/authentification, choisir les identifiants et secrets machines hors Git, puis tester les échanges entre les vrais services. Configurer `PLACES_SYNC_ENABLED=true` après validation du contrat Places.
- Ajouter Places et Tarifs au Compose/frontend commun, avec leurs technologies et ports réels. Abonnements est déjà dans Compose ; raccorder son authentification commune. Réutiliser l'unique base PostgreSQL, sans base séparée par module.
- Intégrer les écrans Places, Tarifs et Abonnements au frontend. Les écrans Réservations sont portables ; adopter le framework commun seulement après choix d'équipe.
- Sauvegarder et migrer chaque installation existante après revue des données, créer les comptes utiles et tester les droits dans chacun des quatre backends.
- Tester les parcours reels : concurrence, annulation sans remboursement, arrivee tardive, depart anticipe sans remboursement, depassement avec complement, reprises reseau et Places, comptes revoques.
- Actualiser les diagrammes : paiement initial, aucun remboursement, paiement du temps apres la fin prevue, sans penalite.

Pour un hébergement en ligne : origine HTTPS et cookie Secure, proxy de confiance, secrets distincts, sauvegardes et droits DB restreints. La limitation applicative par adresse voit l'adresse du proxy ; Nginx limite aussi les tentatives par vraie adresse cliente. Un déploiement à plusieurs instances demande un limiteur partagé. Inscription publique, récupération de compte et MFA ne font pas partie du prototype livré ici et doivent être définis avant usage réel.
