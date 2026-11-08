# Service Places

Ce service gère les places du parking : leur liste, leur état, leur mise en service ou hors service, et leur occupation. Il fait partie de l'application distribuée « Parking intelligent » (module de Ait Ballouk Zakariya).

Technologies : Java 17, Spring Boot 4.1, PostgreSQL (base commune), Flyway (migrations), springdoc (Swagger).

## Règles de gestion

- Une place a un numéro unique et un statut : `LIBRE`, `OCCUPEE`, `RESERVEE` ou `HORS_SERVICE`.
- Une place est occupée par une seule réservation à la fois.
- Une place hors service ne peut pas être occupée.
- Seul l'administrateur ajoute des places ou change leur statut.

Le statut `RESERVEE` existe dans la base, mais les API ne l'utilisent pas encore. La vérification des chevauchements de créneaux reste la responsabilité du service Réservations.

## Lancer le service

Depuis la racine du dépôt, avec Docker Compose :

```bash
docker compose -f compose.reservations.yml -f compose.places.yml up --build -d db reservations places
```

Variables à définir dans le fichier `.env` (jamais dans Git) :

- `DB_PASSWORD` : mot de passe de la base commune.
- `PLACES_API_USER` et `PLACES_API_PASSWORD` : identifiants que Réservations utilise pour appeler Places.
- `AUTH_API_URL` : adresse du service d'authentification (par défaut `http://reservations:8081`).
- `AUTH_PLACES_USER` et `AUTH_PLACES_PASSWORD` : identifiants de Places pour interroger l'authentification. Réservations en garde l'empreinte Argon2 (`AUTH_PLACES_PASSWORD_HASH`).

Le service écoute sur le port 8082. Les tables sont créées automatiquement par Flyway au démarrage (`src/main/resources/db/migration`). Flyway utilise sa propre table `flyway_places_history` pour ne pas gêner les autres services.

## Documentation de l'API

- Swagger : http://localhost:8082/swagger-ui.html
- Contrat OpenAPI : `docs/api/places-openapi.json`

## API d'administration (`/api/places`)

Il faut une session ouverte (cookie `PARKING_SESSION`). Les modifications demandent aussi l'en-tête `X-CSRF-TOKEN`. La lecture est permise à tout utilisateur connecté. L'ajout et le changement de statut demandent le rôle `ADMIN`.

- `POST /api/places` : ajoute une place. Corps : `{"numero":"A1"}`. Réponse `201` : `{"id":"1","numero":"A1","statut":"LIBRE"}`. Erreurs : `400` (numéro vide ou trop long), `409` (numéro déjà utilisé).
- `GET /api/places` : liste les places. Filtre facultatif : `?statut=LIBRE`.
- `GET /api/places/{id}` : une place. `404` si elle n'existe pas.
- `PATCH /api/places/{id}/statut` : met la place `LIBRE` ou `HORS_SERVICE`. Corps : `{"statut":"HORS_SERVICE"}`. Erreurs : `400` (autre statut), `409` (place occupée : il faut d'abord enregistrer le départ).

Exemple :

```bash
curl -X POST http://localhost:8082/api/places \
  -H "Content-Type: application/json" \
  -H "Cookie: PARKING_SESSION=<session>" \
  -H "X-CSRF-TOKEN: <jeton>" \
  -d '{"numero":"A1"}'
```

## API interne (`/internal/places`)

Réservée au service Réservations, avec HTTP Basic (`PLACES_API_USER` / `PLACES_API_PASSWORD`).

- `GET /internal/places/{id}` : état de la place. Réponse : `{"id":"1","enService":true,"occupee":false}`. `404` si inconnue.
- `POST /internal/places/{id}/occupy` : occupe la place à l'arrivée. `204` si réussi, `409` si la place est hors service ou déjà occupée.
- `POST /internal/places/{id}/release` : libère la place au départ. `204` si réussi, `409` si elle est occupée par une autre réservation.

Pour `occupy` et `release`, l'en-tête `Idempotency-Key` est obligatoire et le corps est `{"reservationId":"10"}`. Une commande répétée avec la même clé renvoie `204` sans rien changer, ce qui permet à Réservations de réessayer sans risque. Libérer une place qui n'est pas occupée renvoie aussi `204`.

Exemple :

```bash
curl -X POST http://localhost:8082/internal/places/1/occupy \
  -u reservations:<mot-de-passe> \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: reservation/10/OCCUPY" \
  -d '{"reservationId":"10"}'
```

## Erreurs d'authentification

- `401 AUTHENTICATION_REQUIRED` : session absente, expirée ou inconnue.
- `403 CSRF_INVALID` : jeton CSRF absent ou invalide.
- `403 FORBIDDEN` : droits insuffisants (modification sans le rôle `ADMIN`).
- `401 SERVICE_AUTHENTICATION_FAILED` : identifiants du service Réservations invalides (routes internes).
- `503 AUTHENTICATION_UNAVAILABLE` ou `SERVICE_NOT_CONFIGURED` : authentification injoignable ou non configurée. Le service refuse alors d'agir.

## Échanges avec les autres services

- Réservations appelle Places (`/internal/places/...`).
- Places appelle Réservations (`POST /internal/auth/validate-user-request`) pour vérifier la session et le rôle d'un utilisateur, avec un compte de service.

## Développement local

`PLACES_AUTH_ENABLED=false` désactive la vérification de session des routes `/api`. À utiliser seulement en développement, jamais dans le `docker-compose` livré.

## Limites connues

- Les tests réalisés jusqu'ici sont manuels (curl) : occupation, libération répétée, conflits, droits administrateur et conducteur. Il n'y a pas encore de tests automatiques.
- Mettre une place hors service ne vérifie pas les réservations futures : cette règle n'est pas encore décidée avec l'équipe.
- Le statut `RESERVEE` n'est pas encore utilisé.