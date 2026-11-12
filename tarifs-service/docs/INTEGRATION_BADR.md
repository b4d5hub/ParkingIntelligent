# Guide d'intégration Tarifs — Module Réservations (Badr)

Ce document récapitule les détails techniques, contrats d'API, configurations et propositions d'intégration entre le service **Réservations** (Badr Eddine) et le service **Tarifs** (Amine Nekhla).

---

## 1. Endpoints exposés par Tarifs

Tarifs écoute en interne sur le port HTTP `8082`.

### 1.1 `POST /internal/tarifs/estimate` (Devis de réservation)
- **Authentification** : HTTP Basic (compte machine Réservations).
- **En-têtes** : `Authorization: Basic base64(INTERNAL_CALLER_USER:INTERNAL_CALLER_SECRET)`, `Content-Type: application/json`.
- **Corps envoyé par Réservations** :
  ```json
  {
    "conducteurId": "42",
    "placeId": "1",
    "typeVehicule": "VOITURE",
    "debutPrevu": "2026-11-20T10:00:00Z",
    "finPrevue": "2026-11-20T12:00:00Z",
    "arriveeReelle": null,
    "departReel": null,
    "quoteReference": null,
    "overstayPenalty": false
  }
  ```
- **Réponse HTTP 200** :
  ```json
  {
    "amount": 20.00,
    "currency": "MAD",
    "reference": "devis-a1b2c3d4"
  }
  ```
- **Codes d'erreur** :
  - `401 SERVICE_AUTHENTICATION_FAILED` : Basic auth absent ou incorrect.
  - `400 INVALID_REQUEST` : Dates manquantes ou `finPrevue` antérieure à `debutPrevu`.
  - `502 PARTNER_RESPONSE_INVALID` : Abonnements a renvoyé un format corrompu ou une réduction hors [0, 100].
  - `503 SERVICE_UNAVAILABLE` : Service Abonnements injoignable ou aucun tarif configuré en base (`TARIF_MANQUANT`).

---

### 1.2 `POST /internal/tarifs/final` (Calcul du montant final ou du complément de dépassement)
- **Authentification** : HTTP Basic (compte machine Réservations).
- **Règle de paiement retenue** :
  - **Dépassement (créneau déjà prépayé)** : Réservations transmet l'intervalle `[finPrevue, departReel]` dans `arriveeReelle` et `departReel` (avec `quoteReference: null`, `overstayPenalty: false`). Tarifs calcule uniquement le montant de cet intervalle supplémentaire sans aucune pénalité.
  - **Réservations historiques non prépayées** : Réservations transmet `[arriveeReelle, departReel]` et l'ancienne référence de devis dans `quoteReference`. Tarifs calcule le montant total de la durée réelle.
- **Réponse HTTP 200** :
  ```json
  {
    "amount": 15.00,
    "currency": "MAD",
    "reference": "final-e5f6a7b8"
  }
  ```

---

### 1.3 `GET /api/tarifs/hourly` (Consultation du tarif horaire courant)
- **Authentification** : Session utilisateur transmise dans le cookie `PARKING_SESSION`.
- **Validation** : Tarifs valide la session auprès de Réservations (`POST /internal/auth/validate-user-request`).
- **Autorisation** : Tout rôle authentifié (`CONDUCTEUR`, `AGENT`, `ADMIN`).
- **Réponse HTTP 200** :
  ```json
  {
    "prixDh": 10.00,
    "currency": "MAD"
  }
  ```

---

### 1.4 `PUT /api/tarifs/hourly` (Modification du tarif horaire)
- **Authentification** : Session utilisateur (`PARKING_SESSION`) + Jeton CSRF (`X-CSRF-TOKEN`).
- **Autorisation** : Rôle `ADMIN` obligatoire.
- **Corps** :
  ```json
  {
    "prixDh": 12.50
  }
  ```
- **Traçabilité** : L'identifiant de l'auteur (`cree_par`) est extrait directement de l'identité retournée par la validation de session, jamais d'un champ fourni dans le corps JSON.

---

## 2. Variables d'environnement pour l'interconnexion

### Côté Réservations (`reservations-service`)
Ajouter dans `.env` / `compose.reservations.yml` :
```dotenv
# Connexion vers Tarifs
TARIFFS_API_URL=http://tarifs:8082
TARIFFS_API_USER=reservations-tarifs-client
TARIFFS_API_PASSWORD=<secret-machine-reservations>

# Autorisation de Tarifs à valider les sessions utilisateur
AUTH_TARIFFS_USER=tarifs-auth-client
AUTH_TARIFFS_PASSWORD_HASH=<empreinte-argon2-du-secret-tarifs>
```

### Côté Tarifs (`tarifs-service`)
```dotenv
PORT=8082
DB_URL=jdbc:postgresql://db:5432/parking
DB_USER=parking
DB_PASSWORD=<secret-db>

# Credentials attendus de Réservations (doivent correspondre à TARIFFS_API_USER/PASSWORD)
INTERNAL_CALLER_USER=reservations-tarifs-client
INTERNAL_CALLER_SECRET=<secret-machine-reservations>

# Credentials de Tarifs vers le service auth de Réservations
AUTH_SERVICE_URL=http://reservations:8081
AUTH_TARIFS_USER=tarifs-auth-client
AUTH_TARIFS_SECRET=<secret-tarifs-en-clair>

# Paramètres métier
TARIFS_CURRENCY=MAD
```

---

## 3. Migration SQL partagée

Le script `tarifs-service/src/main/resources/db/tarifs.sql` crée la table `tarif_horaire` et insère le tarif initial de 10.00 DH/h de manière idempotente :

```sql
CREATE TABLE IF NOT EXISTS tarif_horaire (
    id               BIGSERIAL     PRIMARY KEY,
    prix_dh          NUMERIC(10,2) NOT NULL CHECK (prix_dh > 0),
    valable_a_partir TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cree_par         TEXT          NOT NULL,
    cree_le          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

INSERT INTO tarif_horaire (prix_dh, valable_a_partir, cree_par)
SELECT 10.00, now(), 'init'
WHERE NOT EXISTS (SELECT 1 FROM tarif_horaire);
```

**Proposition d'intégration dans `compose.reservations.yml`** :
Ajouter dans les volumes d'initialisation de `db` :
```yaml
      - ./tarifs-service/src/main/resources/db/tarifs.sql:/docker-entrypoint-initdb.d/006_tarifs.sql:ro
```
*Note pour base existante* : exécuter le script une seule fois via `psql -U parking -d parking -f tarifs.sql`.

---

## 4. Proposition Docker Compose et Nginx

### 4.1 Service Tarifs pour `compose.reservations.yml`
```yaml
  tarifs:
    build: ./tarifs-service
    environment:
      PORT: 8082
      DB_URL: jdbc:postgresql://db:5432/parking
      DB_USER: parking
      DB_PASSWORD: ${DB_PASSWORD:?Definir DB_PASSWORD dans .env}
      INTERNAL_CALLER_USER: ${TARIFFS_API_USER:-}
      INTERNAL_CALLER_SECRET: ${TARIFFS_API_PASSWORD:-}
      AUTH_SERVICE_URL: http://reservations:8081
      AUTH_TARIFS_USER: ${AUTH_TARIFS_USER:-}
      AUTH_TARIFS_SECRET: ${AUTH_TARIFS_SECRET:-}
      ABONNEMENTS_API_URL: ${ABONNEMENTS_API_URL:-}
      TARIFS_CURRENCY: ${TARIFS_CURRENCY:-MAD}
    depends_on:
      db: {condition: service_healthy}
    networks: [parking]
```
*Remarque* : Le port 8082 n'est pas publié sur l'hôte, évitant tout conflit de port local.

### 4.2 Routage Nginx (`frontend/nginx.conf`)
Ajouter avant le bloc générique `location /api/` :
```nginx
        location /api/tarifs/ {
            proxy_pass http://tarifs:8082;
            proxy_http_version 1.1;
            proxy_set_header Host $http_host;
            proxy_set_header Forwarded "";
            proxy_set_header X-Forwarded-For "";
            proxy_set_header X-Forwarded-Proto "";
            proxy_set_header X-User-Id "";
            proxy_connect_timeout 3s;
            proxy_read_timeout 15s;
        }
```
La directive `location ^~ /internal { return 404; }` existante préserve la stricte confidentialité des routes internes de calcul et d'authentification.

