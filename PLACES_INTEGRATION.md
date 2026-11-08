# Intégration Réservations et Places

## Configuration locale

Les deux services utilisent la même base PostgreSQL. Le frontend transmet les routes `/api/places` à Places et les routes Réservations/authentification à Réservations. Les routes `/internal` restent bloquées au niveau du frontend.

Dans `.env`, définir deux comptes machine distincts :

- `PLACES_API_USER` et `PLACES_API_PASSWORD` : Réservations appelle Places.
- `AUTH_PLACES_USER` et `AUTH_PLACES_PASSWORD` : Places valide les sessions auprès de Réservations.
- `AUTH_PLACES_PASSWORD_HASH` : empreinte Argon2 du deuxième mot de passe, avec le préfixe `{argon2}`, enregistrée côté Réservations. Ce n'est pas le mot de passe en clair.

Entourer l'empreinte contenant des caractères `$` par des apostrophes dans `.env`. Ne pas utiliser le même secret pour les deux comptes. Les comptes utilisateur sont créés avec la commande locale décrite dans `AUTHENTICATION.md` ; ils ne sont pas remplacés par ces comptes machine.

Avec les variables renseignées, démarrer l'installation :

```powershell
docker compose -f compose.reservations.yml -f compose.places.yml up --build -d
```

L'overlay fixe `PLACES_API_URL=http://places:8082` et `PLACES_SYNC_ENABLED=true` pour Réservations. Il exige la configuration du client d'authentification Places. Le mode Réservations seul reste possible avec `compose.reservations.yml` ; sans Places, l'écran explique que la liste est indisponible et propose de réessayer.

Ne pas supprimer les volumes pour mettre à jour une installation existante. Les scripts d'initialisation Docker s'appliquent seulement à une base neuve. Sur une base existante, sauvegarder puis revoir les migrations Réservations manquantes avant application ; Places utilise ses migrations Flyway. Hibernate reste en validation.

## Choix d'une place

Le conducteur choisit une place par son numéro dans une liste provenant de `GET /api/places`. Une place hors service n'est pas proposée. Une place occupée actuellement reste proposée pour une réservation future : l'occupation actuelle et la disponibilité d'un créneau sont deux informations différentes.

Le bouton de vérification consulte la disponibilité des dates choisies. La création la contrôle à nouveau sous verrou. La liste n'est donc pas une garantie de disponibilité. Si Places est indisponible, le choix est désactivé, les réservations existantes restent consultables et « Actualiser les places » permet de réessayer. Une réponse commencée dans une ancienne session ne peut pas remplir la nouvelle liste.

## Arrivée et départ

Une arrivée nécessite une place réellement libre. L'occupation et la libération sont transmises par les commandes persistantes de Réservations, avec une clé stable. `placesSyncPending=true` signifie que le service Places n'a pas encore confirmé la mise à jour. Une panne conserve la commande ; elle est réessayée après reprise du service.

## Limite Tarifs

Cette intégration ne remplace pas les API Tarifs. En installation normale, devis et réservation restent indisponibles tant que les API sécurisées d'Amine et leur configuration ne sont pas fournies. Aucun tarif fictif n'est ajouté dans l'application. Les tarifs simulés ne servent qu'aux vérifications isolées.

## Vérification du 8 novembre 2026

Treize contrôles Edge ont réussi avec les vrais services Réservations et Places, le frontend Nginx et PostgreSQL 17 temporaire. Les API Tarifs étaient simulées uniquement dans le banc de vérification.

La campagne couvre la liste réelle, l'exclusion des places hors service, les droits conducteur/administrateur, le refus sans session ou sans CSRF, les paiements, l'arrivée tardive, le départ anticipé, les pannes et les reprises. Le service Places a été arrêté puis redémarré : une libération en attente a été conservée et réessayée jusqu'à confirmation réelle. Une panne de sa liste désactive le choix sans masquer les réservations existantes ; le rafraîchissement restaure le choix après reprise.

Dix tests JavaScript et quatre régressions navigateur de changement de compte ont réussi. La quatrième vérifie qu'une ancienne réponse Places ne remplit pas le sélecteur du nouveau compte. Les captures conducteur et agent ont été relues sur desktop/mobile, sans débordement horizontal ni erreur JavaScript. L'image frontend a été construite et la configuration Compose combinée a été validée avec des identifiants synthétiques.

Les résultats locaux sont dans `reservations-service/target/browser-check/places-integration-results.json` et `places-integration.log`. Les processus, conteneurs et réseau temporaires ont été arrêtés. Aucun changement n'a été appliqué à la base de travail. Le code Java des services n'a pas été modifié pour cette intégration. La contribution Réservations au dossier unique est dans `docs/tests/Contribution_Reservations.md`.
