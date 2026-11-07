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

Contacter Abonnements pour les réductions. Aucune réduction imposée par le navigateur ne doit être acceptée. Aucun abonnement valide signifie zéro réduction.

## Kamal — Abonnements

Confirmer la correspondance de l'identifiant utilisateur commun et du conducteur. Protéger chaque conducteur pour ses propres abonnements. Fournir à Tarifs le contrat de validation/réduction et ses dates. Les écrans de souscription, renouvellement manuel et annulation restent dans ce module, ainsi que sa simulation de paiement.

## Travail commun restant

- Fixer la tolérance d'absence ; `NO_SHOW_GRACE` reste vide en attendant. Les tests utilisant 15 minutes ne fixent aucune règle réelle.
- Accepter les contrats Places/Tarifs/authentification, choisir les identifiants et secrets machines hors Git, puis tester les échanges entre les vrais services. Configurer `PLACES_SYNC_ENABLED=true` après validation du contrat Places.
- Ajouter les trois services et leurs routes au Compose/frontend commun, avec leurs technologies et ports réels. Réutiliser l'unique base PostgreSQL, sans base séparée par module.
- Intégrer les écrans Places, Tarifs et Abonnements au frontend. Les écrans Réservations sont portables ; adopter le framework commun seulement après choix d'équipe.
- Sauvegarder et migrer chaque installation existante après revue des données, créer les comptes utiles et tester les droits dans chacun des quatre backends.
- Vérifier les parcours de bout en bout : réservation concurrente, annulation, arrivée, dépassement sans supplément, départ/paiement simulé, panne puis reprise Places, compte révoqué et session expirée.
- Préparer la démonstration et les documents finaux. La décision de paiement au départ sans pénalité doit remplacer les anciens diagrammes qui demandent un paiement à la réservation ou un supplément.

Pour un hébergement en ligne : origine HTTPS et cookie Secure, proxy de confiance, secrets distincts, sauvegardes et droits DB restreints. La limitation applicative par adresse voit l'adresse du proxy ; Nginx limite aussi les tentatives par vraie adresse cliente. Un déploiement à plusieurs instances demande un limiteur partagé. Inscription publique, récupération de compte et MFA ne font pas partie du prototype livré ici et doivent être définis avant usage réel.
