# Passage à l'équipe

## Partie de Badr Eddine

Réservations fournit la création avec estimation partenaire, la consultation personnelle, l'annulation avant début, les arrivées/départs saisis par un agent, le montant final et le paiement simulé au départ. Aucun supplément de dépassement. La concurrence est protégée par un verrou par place ; les mises à jour Places sont conservées en base et réessayées après une panne.

Le dépôt fournit aussi la connexion commune, les sessions PostgreSQL, CSRF, la validation interne, les écrans Réservations et une installation Compose locale. Les tests avec PostgreSQL utilisent un conteneur temporaire, pas la base de travail.

Les API partenaires sont des propositions d'adaptation, pas des intégrations réalisées avec les trois autres backends. Les types de véhicules et la devise ne sont pas imposés aux autres modules.

## Zakariya — Places

Confirmer les routes et formats de [RESERVATIONS.md](RESERVATIONS.md). Fournir la liste des places au frontend, leur état de service et leur occupation réelle. Protéger les appels d'occupation/libération par un compte machine Réservations. Mémoriser les clés d'idempotence et le propriétaire de l'occupation : une ancienne libération ne doit pas vider une place réaffectée.

La disponibilité future est calculée sur les créneaux Réservations. Ne pas confondre ce résultat avec le champ d'occupation actuelle. Ne pas écrire directement dans les tables Réservations.

## Amine — Tarifs

Confirmer estimation et calcul final, montants décimaux, devise ISO, référence de devis et types de véhicules. Utiliser l'arrivée et le départ réels pour le montant final, sans pénalité supplémentaire. Définir quelle date contrôle la réduction et comment le tarif/devis est conservé si un administrateur modifie les prix.


## Kamal — Abonnements

Confirmer la correspondance de l'identifiant utilisateur commun et du conducteur. Protéger chaque conducteur pour ses propres abonnements. 

Règles retenues pour le premier périmètre : chaque abonnement a un identifiant unique, des dates de début et de fin, un prix et un statut ; les formules sont journalière, hebdomadaire, mensuelle ou annuelle ; un abonnement ne devient actif qu'après confirmation du paiement et n'est plus valide à partir de sa date de fin. Le prix vient d'une configuration serveur par période, jamais du navigateur. Tarifs de départ proposés pour le prototype : 40 MAD/jour, 180 MAD/semaine, 450 MAD/mois et 4 800 MAD/an. Générer une notification sept jours avant l'expiration. Le premier service Nest.js, son accès PostgreSQL, ses migrations et son conteneur Compose sont en place. Le raccordement de l'authentification conducteur et du paiement restent à faire ; le job journalise les notifications, l'envoi par courriel viendra quand un service de messagerie sera configuré.

Tests unitaires à livrer en priorité : calcul des dates pour chaque formule, état en attente avant paiement, activation après paiement, confirmation de paiement répétée sans double activation, accès refusé avant paiement et à/après la date de fin, et notification due au seuil des sept jours. Le job réserve la notification par une mise à jour atomique en base. Les tests de dates utilisent une horloge contrôlable et couvrent la limite exacte de la date de fin.

## Travail commun restant

- Fixer la tolérance d'absence ; `NO_SHOW_GRACE` reste vide en attendant. Les tests utilisant 15 minutes ne fixent aucune règle réelle.
- Accepter les contrats Places/Tarifs/authentification, choisir les identifiants et secrets machines hors Git, puis tester les échanges entre les vrais services. Configurer `PLACES_SYNC_ENABLED=true` après validation du contrat Places.
- Ajouter Places et Tarifs au Compose/frontend commun, avec leurs technologies et ports réels. Abonnements est déjà dans Compose ; raccorder son authentification commune. Réutiliser l'unique base PostgreSQL, sans base séparée par module.
- Intégrer les écrans Places, Tarifs et Abonnements au frontend. Les écrans Réservations sont portables ; adopter le framework commun seulement après choix d'équipe.
- Sauvegarder et migrer chaque installation existante après revue des données, créer les comptes utiles et tester les droits dans chacun des quatre backends.
- Vérifier les parcours de bout en bout : réservation concurrente, annulation, arrivée, dépassement sans supplément, départ/paiement simulé, panne puis reprise Places, compte révoqué et session expirée.
- Préparer la démonstration et les documents finaux. La décision de paiement au départ sans pénalité doit remplacer les anciens diagrammes qui demandent un paiement à la réservation ou un supplément.

Pour un hébergement en ligne : origine HTTPS et cookie Secure, proxy de confiance, secrets distincts, sauvegardes et droits DB restreints. La limitation applicative par adresse voit l'adresse du proxy ; Nginx limite aussi les tentatives par vraie adresse cliente. Un déploiement à plusieurs instances demande un limiteur partagé. Inscription publique, récupération de compte et MFA ne font pas partie du prototype livré ici et doivent être définis avant usage réel.
