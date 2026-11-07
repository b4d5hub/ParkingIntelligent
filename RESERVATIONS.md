# Module Réservations

## État au 7 novembre 2026

Le backend contient la réservation, la consultation personnelle, l'annulation avant le début, l'arrivée et le départ saisis par un agent. Le conducteur vient de la session, jamais du formulaire. Les prix et les statuts sont fixés côté serveur.

Décision de Badr : aucun paiement à la réservation. Au départ, Tarifs calcule le montant sur la durée réelle, sans pénalité supplémentaire. Le paiement est une simulation réussie, identifiée par une référence `SIM-...` ; aucun argent réel n'est prélevé. La devise et les réductions viennent de Tarifs, sans taux inventé dans Réservations.

La tolérance d'absence reste à choisir. `NO_SHOW_GRACE` est vide par défaut : aucune expiration automatique pour absence. Une durée ISO comme `PT15M` serait un exemple de configuration, pas une décision du projet. Une expiration ne libère jamais une place occupée.

## API navigateur

Activer le profil `auth` seulement après création des tables nécessaires. Utiliser une seule origine pour le frontend et les API. Toutes les modifications exigent la session et CSRF ; voir [AUTHENTICATION.md](AUTHENTICATION.md).

- Conducteur : `GET /api/reservations/me?page=0&size=20`, `GET /api/reservations/{id}`.
- Conducteur : `GET /api/reservations/availability?placeId=20&start=...&end=...`.
- Conducteur : `POST /api/reservations/quote`, `POST /api/reservations`.
- Conducteur : `POST /api/reservations/{id}/cancel` avant le début prévu.
- Agent : `GET /api/reservations/operations?start=...&end=...`, puis `POST /api/reservations/{id}/arrival` ou `/departure`.

Le corps de devis/création accepte seulement `placeId`, `debutPrevu`, `finPrevue`, `typeVehicule`. Dates ISO avec décalage horaire. Les identifiants de réponse sont des chaînes décimales pour préserver les BIGINT dans JavaScript. Taille de page : 1 à 100 ; consultation agent limitée à 31 jours, avec les arrivées encore actives même si le créneau est passé.

La création exige un en-tête `Idempotency-Key` UUID. Garder la même clé et le même corps pour une reprise après coupure réseau. Une autre demande avec la même clé est refusée. Répéter une annulation, arrivée ou un départ déjà effectué ne répète pas les effets.

Réponses : `400` paramètres invalides, `401` session absente, `403` rôle/CSRF, `404` réservation absente ou appartenant à un autre conducteur, `409` conflit de réservation/état, `502` réponse partenaire invalide, `503` partenaire ou stockage indisponible. Format : `{"code":"...","message":"..."}`.

## Disponibilité et concurrence

Une transaction verrouille une ligne par place dans `reservation_place_guards`, puis vérifie les créneaux avant l'insertion. Les intervalles sont semi-ouverts : une réservation peut commencer exactement à la fin d'une autre. Deux créations simultanées qui se chevauchent ne réussissent pas toutes les deux. Tous les créateurs de réservations doivent passer par ce service ; les autres modules ne doivent pas écrire directement dans cette table.

Une occupation actuelle ne bloque pas à elle seule une réservation future. En revanche, une arrivée exige une place libre maintenant, aucune arrivée locale active et aucune commande Places encore en attente. Une fin prévue ne signifie jamais un départ réel.

L'arrivée et le départ écrivent leur commande Places dans la même transaction que l'état local. `reservation_place_commands` conserve ces commandes après un redémarrage. Le traitement réessaie après une panne, dans l'ordre occupation puis libération. `placesSyncPending` indique une synchronisation en attente. Activer `PLACES_SYNC_ENABLED=true` seulement après validation du contrat Places. Un agent ne doit pas interpréter une réponse locale comme un accusé de réception du service Places.

## Contrats partenaires proposés — à confirmer

Ces chemins sont des adaptateurs proposés et testés côté Réservations. Ils ne prouvent pas l'existence des API des autres membres. Les URL, technologies et ports des partenaires ne sont pas connus. Sans URL et identifiants configurés, l'appel échoue avec `503`, sans tarif ou place fictifs.

Configurer `PLACES_API_URL`, `PLACES_API_USER`, `PLACES_API_PASSWORD`, `TARIFFS_API_URL`, `TARIFFS_API_USER`, `TARIFFS_API_PASSWORD` hors Git. Comptes machine distincts des comptes utilisateur ; HTTP Basic sur TLS, ou uniquement des secrets de démonstration sur réseau local privé. Délais : connexion 2 s, lecture 3 s. Aucun endpoint `/internal` ne doit être publié par le frontend.

Places : `GET /internal/places/{id}` retourne `{"id":"20","enService":true,"occupee":false}`. `POST /internal/places/{id}/occupy` et `/release` acceptent `{"reservationId":"1"}` et un `Idempotency-Key` stable. Places doit mémoriser cette clé et vérifier le propriétaire de l'occupation : une libération ancienne ne doit pas libérer la place d'une autre réservation.

Tarifs : `POST /internal/tarifs/estimate` et `/final` retournent `{"amount":15.00,"currency":"MAD","reference":"devis-123"}`. MAD est seulement un exemple ; aucune devise n'est imposée. Montant positif ou nul, deux décimales maximum, devise ISO valide, référence de 1 à 100 caractères.

La demande contient `conducteurId`, `placeId` (chaînes), `typeVehicule`, `debutPrevu`, `finPrevue`, `arriveeReelle`, `departReel`, `quoteReference`, `overstayPenalty:false`. Les dates réelles sont nulles pour l'estimation. Tarifs doit préciser les valeurs de type véhicule, la date de validité de la réduction et la règle de conservation du tarif/devis. Tarifs contacte Abonnements si nécessaire ; Réservations ne calcule pas une réduction elle-même.

## Base et vérification

Une seule base PostgreSQL reste commune aux quatre modules. Pour une base neuve : appliquer `reservations-service/src/main/resources/db/reservations.sql`, puis `003_reservation_workflow.sql`, puis les scripts `db/auth/001_accounts.sql` et `002_sessions.sql`. Pour la base existante où `reservations` existe déjà, ne pas rejouer le script de création. Sauvegarder puis relire la migration avant de l'appliquer. Aucun de ces changements n'a été appliqué à `parking-db` par cette étape.

Hibernate reste en `ddl-auto=validate`. Les nouvelles colonnes tolèrent les anciennes lignes ; les réservations historiques sans type véhicule/devise nécessitent une revue avant de reprendre leur départ. Ne pas inventer ces valeurs pour des données existantes.

Tests Java sans base : depuis `reservations-service`, avec JDK 21, `./mvnw.cmd -ntp test`. Les tests PostgreSQL sont désactivés par défaut. Pour les exécuter : `./scripts/Test-Reservations.ps1` (Docker nécessaire). Le script crée une base temporaire avec un port loopback aléatoire, applique les SQL et arrête uniquement son conteneur. Il ne touche pas à `parking-db` ni à ses volumes. `-Offline` permet d'utiliser les dépendances déjà en cache.

Vérification actuelle : 65 tests exécutés avec succès, dont cinq tests PostgreSQL réels pour la concurrence, l'idempotence, la persistance des annulations, les reprises Places et l'annulation transactionnelle d'un départ en panne. Places et Tarifs sont simulés dans ces tests : leur intégration réelle reste à valider avec l'équipe.
