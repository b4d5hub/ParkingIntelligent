# Module Réservations

## Correction du changement de compte

Le frontend ignore les réponses des requêtes commencées avant une déconnexion ou une nouvelle connexion. Une ancienne liste, une erreur 401 ou un ancien jeton CSRF ne peut plus modifier le nouvel espace utilisateur. La déconnexion efface les listes, le devis, le formulaire de réservation et la pagination. Les boutons sont réinitialisés pour permettre une nouvelle connexion même si une ancienne requête attend encore sa réponse.

Vérification de cette correction : dix tests JavaScript réussis, dont cinq régressions sur les réponses devenues obsolètes ; trois parcours Edge réussis avec une réponse ancienne 200, une réponse ancienne 401 et une panne réseau après une nouvelle connexion. L'image Docker frontend inclut le module session.js. Aucun changement dans les règles métier Java ou les données PostgreSQL.

## État au 7 novembre 2026

Le backend contient la réservation, la consultation personnelle, l'annulation avant le début, l'arrivée et le départ saisis par un agent. Le conducteur vient de la session, jamais du formulaire. Les prix et les statuts sont fixés côté serveur.

Decision de Badr : paiement simule du creneau a la reservation, sans remboursement pour annulation ou depart anticipe. Au depart, facturer uniquement le temps apres la fin prevue, sans penalite. bookingPaid est le montant initial, extraPaid le complement, montantFinal leur somme. Les deux paiements ont des references distinctes. Les montants et la devise viennent de Tarifs. Aucun argent reel n'est preleve.

Aucune expiration pour absence. Le creneau paye reste reserve jusqu'a sa fin prevue ; le retard ne prolonge pas cette fin. Une arrivee pendant le creneau est possible si la place est libre ; a sa fin ou apres, elle est refusee. NO_SHOW_GRACE n'a plus d'effet.

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

## Contrats partenaires

Les routes Places existent désormais dans le service de Zakariya (port interne 8082). Le frontend charge sa liste authentifiée et le sélecteur conserve les places occupées actuellement pour permettre les réservations futures ; il exclut les places hors service. L'overlay `compose.places.yml` configure l'URL et la synchronisation. Voir `PLACES_INTEGRATION.md` pour les deux comptes machine. Les routes Tarifs restent une proposition en attente d'implémentation. Sans partenaire configuré, l'appel échoue avec `503`, sans tarif ou place fictifs.

Vérification du 8 novembre : treize contrôles navigateur réussis avec les vrais services Réservations et Places, l'authentification commune, Nginx et une base PostgreSQL temporaire. Les arrêts/redémarrages de Places confirment la reprise des commandes et de la liste. Tarifs reste simulé pour cette campagne ; aucun tarif fictif n'est présent dans le code applicatif. Les résultats et limites sont détaillés dans `PLACES_INTEGRATION.md`.

Configurer `PLACES_API_URL`, `PLACES_API_USER`, `PLACES_API_PASSWORD`, `TARIFFS_API_URL`, `TARIFFS_API_USER`, `TARIFFS_API_PASSWORD` hors Git. Comptes machine distincts des comptes utilisateur ; HTTP Basic sur TLS, ou uniquement des secrets de démonstration sur réseau local privé. Délais : connexion 2 s, lecture 3 s. Aucun endpoint `/internal` ne doit être publié par le frontend.

Places : `GET /internal/places/{id}` retourne `{"id":"20","enService":true,"occupee":false}`. `POST /internal/places/{id}/occupy` et `/release` acceptent `{"reservationId":"1"}` et un `Idempotency-Key` stable. Places doit mémoriser cette clé et vérifier le propriétaire de l'occupation : une libération ancienne ne doit pas libérer la place d'une autre réservation.

Tarifs : `POST /internal/tarifs/estimate` et `/final` retournent `{"amount":15.00,"currency":"MAD","reference":"devis-123"}`. MAD est seulement un exemple ; aucune devise n'est imposée. Montant positif ou nul, deux décimales maximum, devise ISO valide, référence de 1 à 100 caractères.

La demande contient `conducteurId`, `placeId` (chaînes), `typeVehicule`, `debutPrevu`, `finPrevue`, `arriveeReelle`, `departReel`, `quoteReference`, `overstayPenalty:false`. Les dates réelles sont nulles pour l'estimation. Tarifs doit préciser les valeurs de type véhicule, la date de validité de la réduction et la règle de conservation du tarif/devis. Tarifs contacte Abonnements si nécessaire ; Réservations ne calcule pas une réduction elle-même.

## Base et vérification

Une seule base PostgreSQL reste commune aux quatre modules. Pour une base neuve : appliquer `reservations-service/src/main/resources/db/reservations.sql`, puis `003_reservation_workflow.sql`, puis `004_booking_payment.sql`, puis les scripts `db/auth/001_accounts.sql` et `002_sessions.sql`. Pour la base existante où `reservations` existe déjà, ne pas rejouer le script de création. Sauvegarder puis relire la migration avant de l'appliquer. Aucun de ces changements n'a été appliqué à `parking-db` par cette étape.

Hibernate reste en `ddl-auto=validate`. Les nouvelles colonnes tolèrent les anciennes lignes ; les réservations historiques sans type véhicule/devise nécessitent une revue avant de reprendre leur départ. Ne pas inventer ces valeurs pour des données existantes.

Tests Java sans base : depuis `reservations-service`, avec JDK 21, `./mvnw.cmd -ntp test`. Les tests PostgreSQL sont désactivés par défaut. Pour les exécuter : `./scripts/Test-Reservations.ps1` (Docker nécessaire). Le script crée une base temporaire avec un port loopback aléatoire, applique les SQL et arrête uniquement son conteneur. Il ne touche pas à `parking-db` ni à ses volumes. `-Offline` permet d'utiliser les dépendances déjà en cache.

Verification historique avant cette modification : Vérification finale : 82 tests Java exécutés avec succès, dont six tests PostgreSQL Réservations, huit tests HTTP avec comptes/sessions PostgreSQL et six tests HTTP de l'adaptateur partenaire. Cinq tests JavaScript réussis. Le navigateur Edge a vérifié connexion, déconnexion, consultation, erreur partenaire, devis, réservation sans paiement, annulation, arrivée, départ avec paiement simulé et reprise Places ; captures desktop/mobile relues, sans erreur JavaScript. Les partenaires utilisés sont des fixtures de test : leur intégration réelle reste à valider avec l'équipe. Les deux images Docker ont été construites et l'installation temporaire a démarré avec les quatre scripts SQL. La base existante parking-db est restée intacte.


## Mise a jour du paiement du 7 novembre 2026

Appliquer explicitement db/004_booking_payment.sql apres sauvegarde et revue sur une base existante. Ne pas rejouer les anciens scripts. Compose et le script de test appliquent cette migration sur leurs bases neuves. La base personnelle existante reste intacte. Les anciennes reservations avec bookingPaid=null gardent leur regle initiale : paiement de la duree reelle au depart. La migration ne cree pas de faux paiements historiques.

Contrat Tarifs a valider avec Amine : estimate chiffre le creneau reserve. Pour un depassement, /internal/tarifs/final recoit uniquement fin prevue -> depart reel : dates prevues et reelles egales aux bornes de cet intervalle, quoteReference=null, overstayPenalty=false. La reponse doit chiffrer uniquement cet intervalle, jamais le total deja paye. Le tarif reste fourni par Tarifs ; aucun taux local n'est invente. Ce contrat reste propose car aucune API Tarifs reelle n'existe dans ce checkout. Les anciennes reservations sans paiement initial utilisent encore leur contrat historique.

Les preuves de verification plus haut decrivent la version precedente ; les nouveaux resultats sont notes ci-dessous apres execution.

Verification de cette mise a jour : 103 tests Java reussis, aucun echec ni test ignore, avec les cinq scripts SQL sur PostgreSQL 17 temporaire. Les tests couvrent notamment le paiement initial, l'annulation sans remboursement, le depart anticipe, le depart a la fin exacte, le complement, ses references persistantes, la reprise du depart sans double paiement et le retour arriere en cas de panne Tarifs. Dix tests JavaScript reussis ; syntaxe du frontend verifiee.

Verification navigateur du paiement : huit controles Edge reussis avec le vrai JAR Reservations et PostgreSQL 17 temporaire. Devis et paiement du creneau, annulation sans remboursement, arrivee avec 45 minutes de retard, depart anticipe sans reduction du paiement, panne Tarifs sans cloture ni liberation, complement au depart, reprise sans double paiement et synchronisation des commandes Places ont ete verifies. Les captures desktop/mobile ont ete relues, sans debordement horizontal ni erreur JavaScript. Places et Tarifs restent des partenaires simules. Le JAR a ete reconstruit avec succes ; les processus de test et le conteneur temporaire ont ete arretes. La base personnelle n'a pas ete modifiee. Les preuves locales sont dans target/browser-check/payment-results.json et payment-browser.log.
