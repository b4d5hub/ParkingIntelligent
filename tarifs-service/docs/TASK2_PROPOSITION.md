# Proposition Tarifs-Service — Phase B (révisée)

> Document de conception révisé. Rien n'est encore implémenté.
> Source des règles : code source de reservations-service, AUTHENTICATION.md, RESERVATIONS.md, README.md.
> Toute règle non documentée formellement par l'équipe est listée en section 10 "Hypothèses à confirmer".

---

## 1. Authentification — séparation routes internes / routes utilisateur

### 1.1 Routes internes — `POST /internal/tarifs/estimate` et `POST /internal/tarifs/final`

Ces routes sont appelées **machine à machine** par le service Réservations uniquement.
Elles ne traitent **pas** de session utilisateur, pas de cookie de session, pas de jeton CSRF.

**Mécanisme retenu** : HTTP Basic, comparaison en temps constant.

```
Authorization: Basic base64(INTERNAL_CALLER_USER:INTERNAL_CALLER_SECRET)
```

Tarifs stocke dans son environnement le nom d'utilisateur et le secret en clair attendus de Réservations (`INTERNAL_CALLER_USER`, `INTERNAL_CALLER_SECRET`).
La comparaison utilise `MessageDigest.isEqual` (temps constant) sur les octets UTF-8 pour neutraliser les attaques temporelles.

| Cas | Code HTTP | Corps JSON |
|-----|-----------|-----------|
| En-tête absent ou mal formé | `401` | `{"code":"SERVICE_AUTHENTICATION_FAILED","message":"En-tête d'authentification machine manquant ou invalide"}` |
| Identifiants machine incorrects | `401` | `{"code":"SERVICE_AUTHENTICATION_FAILED","message":"Identifiants machine incorrects"}` |
| Caller authentifié mais non habilité sur cette route | `403` | `{"code":"SERVICE_FORBIDDEN","message":"Accès refusé pour ce service"}` |

> Source : `AUTHENTICATION.md` §Intégration — "HTTP Basic sur TLS, sans session machine".
> Les variables `TARIFFS_API_USER` / `TARIFFS_API_PASSWORD` côté Réservations sont le miroir de `INTERNAL_CALLER_USER` / `INTERNAL_CALLER_SECRET` côté Tarifs.

### 1.2 Routes utilisateur — `GET /api/tarifs/hourly` et `PUT /api/tarifs/hourly`

Ces routes sont exposées aux utilisateurs via Nginx sous le préfixe `/api/tarifs/**` (conformément à la règle de préfixe documentée dans `AUTHENTICATION.md`).

Elles délèguent la validation de session à Réservations en appelant `POST /internal/auth/validate-user-request` avec les informations extraites de la **vraie requête HTTP reçue** :

```json
{
  "sessionCookie": "<valeur brute du cookie PARKING_SESSION>",
  "httpMethod": "GET ou PUT",
  "csrfToken": "<valeur de l'en-tête X-CSRF-TOKEN>"
}
```

Tarifs s'authentifie auprès de l'endpoint interne d'authentification avec ses propres identifiants machine :
```
Authorization: Basic base64(AUTH_TARIFS_USER:AUTH_TARIFS_SECRET)
```
(`AUTH_TARIFS_SECRET` est un secret en clair pour Tarifs ; l'empreinte Argon2 correspondante est stockée dans la configuration de Réservations sous `AUTH_TARIFFS_PASSWORD_HASH`).

| Route | Rôle requis | Vérification CSRF par l'auth ? | Contrôle Origin ? |
|-------|-------------|--------------------------------|-------------------|
| `GET /api/tarifs/hourly` | Tout rôle authentifié (`CONDUCTEUR`, `AGENT`, `ADMIN`) | Non (méthode de lecture) | Non |
| `PUT /api/tarifs/hourly` | `ADMIN` uniquement | Oui (`X-CSRF-TOKEN` validé par l'auth) | Oui (vérification de l'en-tête `Origin` s'il est présent) |

**Règles de résilience et de sécurité de la validation d'authentification** :
- Délai maximal vers le service d'authentification : **2 secondes** (connexion + lecture).
- Aucun cache positif : chaque requête réévalue la validité de la session en base.
- Si le service d'authentification est indisponible ou en timeout → code **`503`** (`code: AUTHENTICATION_UNAVAILABLE`).
- Si le service d'authentification répond `401 SERVICE_AUTHENTICATION_FAILED` ou `403 SERVICE_FORBIDDEN` aux identifiants machine de Tarifs, il s'agit d'un défaut de configuration inter-services → Tarifs répond **`503`** (`code: AUTHENTICATION_UNAVAILABLE`) au client et ne divulgue pas l'erreur interne.
- Pour `PUT /api/tarifs/hourly`, si l'en-tête `Origin` est présent et non conforme à l'origine autorisée de l'application, la requête est rejetée avec **`403`** (`code: CSRF_INVALID`).

---

## 2. Format de la réponse du service d'authentification (code source vérifié)

Le format est directement dérivé du code source officiel de `reservations-service` :
- [`InternalAuthController.java`](file:///c:/Users/Amine/Desktop/WS/ParkingIntelligent/reservations-service/src/main/java/com/parking/reservations_service/auth/InternalAuthController.java#L72) :
  `public record ValidationResponse(AuthUserResponse user, Instant authenticatedAt) { }`
- [`AuthUserResponse.java`](file:///c:/Users/Amine/Desktop/WS/ParkingIntelligent/reservations-service/src/main/java/com/parking/reservations_service/auth/AuthUserResponse.java#L7) :
  `public record AuthUserResponse(String userId, String displayName, List<String> roles) { }`

Le format JSON exact renvoyé par `POST /internal/auth/validate-user-request` est donc :

```json
{
  "user": {
    "userId": "42",
    "displayName": "Amine Nekhla",
    "roles": ["CONDUCTEUR"]
  },
  "authenticatedAt": "2026-11-07T19:00:00Z"
}
```

- `userId` est une chaîne décimale représentant un entier BIGINT (ex. `"42"`).
- `roles` contient les rôles normalisés sans le préfixe `ROLE_` (ex. `["CONDUCTEUR"]`, `["AGENT"]`, `["ADMIN"]`).
- Tarifs utilise `userId` pour renseigner l'auteur de la modification (`cree_par`) lors d'un `PUT /api/tarifs/hourly`.

---

## 3. Variables d'environnement — liste complète

Fichier `tarifs-service/.env.example` :

```dotenv
# ── Base de données (PostgreSQL commun) ──────────────────────────────────────
DB_URL=
DB_USER=
DB_PASSWORD=

# ── Routes internes : credentials que Réservations envoie à Tarifs ───────────
# Doit correspondre à TARIFFS_API_USER / TARIFFS_API_PASSWORD côté Réservations
INTERNAL_CALLER_USER=
INTERNAL_CALLER_SECRET=

# ── Appel vers le service d'authentification (hébergé dans Réservations) ─────
AUTH_SERVICE_URL=
AUTH_TARIFS_USER=
AUTH_TARIFS_SECRET=
# Note : l'empreinte Argon2 de AUTH_TARIFS_SECRET est à renseigner dans
# Réservations sous AUTH_TARIFFS_PASSWORD_HASH.

# ── Appel vers Abonnements ────────────────────────────────────────────────────
ABONNEMENTS_API_URL=
ABONNEMENTS_API_USER=
ABONNEMENTS_API_SECRET=

# ── Paramètres métier ─────────────────────────────────────────────────────────
TARIFS_CURRENCY=MAD
```

*Remarque* : la valeur initiale du tarif horaire (10,00 DH/h) n'est pas une variable d'environnement, elle provient exclusivement de l'amorçage SQL (`tarifs.sql`).

---

## 4. Migration SQL (`db/tarifs.sql`)

Fichier : `tarifs-service/src/main/resources/db/tarifs.sql`

```sql
-- Migration : table de l'historique des tarifs horaires
-- Module Tarifs — Amine Nekhla
-- À appliquer UNE SEULE FOIS sur la base commune PostgreSQL.
-- Ne jamais réexécuter sur une base contenant déjà la table.

CREATE TABLE IF NOT EXISTS tarif_horaire (
    id               BIGSERIAL     PRIMARY KEY,
    prix_dh          NUMERIC(10,2) NOT NULL CHECK (prix_dh > 0),
    -- Date d'entrée en vigueur de ce tarif
    valable_a_partir TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- userId de l'admin ayant réalisé la modification (chaîne décimale BIGINT)
    cree_par         TEXT          NOT NULL,
    cree_le          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Tarif initial de 10,00 DH/h inséré uniquement si la table est vide
-- (WHERE NOT EXISTS assure l'idempotence sans ON CONFLICT)
INSERT INTO tarif_horaire (prix_dh, valable_a_partir, cree_par)
SELECT 10.00, now(), 'init'
WHERE NOT EXISTS (SELECT 1 FROM tarif_horaire);
```

**Règle de lecture du tarif courant** :
```sql
SELECT prix_dh FROM tarif_horaire ORDER BY valable_a_partir DESC, id DESC LIMIT 1;
```

### Procédure de test sur conteneur PostgreSQL jetable

Ne **JAMAIS** appliquer directement sur la base partagée `parking-db`.
Procédure automatisée PowerShell avec `pg_isready` et pipeline sans redirection `<` :

```powershell
# 1. Démarrer un PostgreSQL temporaire sur un port non-standard
docker run --rm -d --name tarifs-test-db `
  -e POSTGRES_PASSWORD=test `
  -p 15432:5432 `
  postgres:16-alpine

# 2. Attendre que PostgreSQL soit prêt via pg_isready (sans délai aveugle)
do { Start-Sleep -Milliseconds 200 } until (docker exec tarifs-test-db pg_isready -U postgres -q)

# 3. Appliquer le script via le pipeline PowerShell (compatible Windows)
Get-Content tarifs-service/src/main/resources/db/tarifs.sql -Raw | docker exec -i tarifs-test-db psql -U postgres

# 4. Vérifier l'insertion initiale
docker exec tarifs-test-db psql -U postgres -c "SELECT * FROM tarif_horaire;"

# 5. Arrêter et détruire le conteneur jetable
docker stop tarifs-test-db
```

---

## 5. Évolution de `TarifService` et impacts complets sur les tests (Étape B1)

### 5.1 Changements dans la classe métier `TarifService`

1. **Passage de `LocalDateTime` à `OffsetDateTime`** :
   Les horodatages transmis par Réservations comportent un décalage horaire (ex. `2026-11-08T09:00:00+01:00`). L'utilisation de `OffsetDateTime` permet à `ChronoUnit.MINUTES.between(debut, fin)` de mesurer la durée réelle écoulée en minutes même si les deux bornes ont des décalages d'offset distincts.
2. **Découplage de la persistance via `TarifRepository`** :
   `TarifService` ne stocke plus le tarif dans un champ mutable isolé. Il reçoit une interface `TarifRepository` par constructeur :
   ```java
   public TarifService(TarifRepository repository)
   ```
3. **Mise à jour de `modifierTarifHoraire`** :
   La méthode requiert désormais l'identifiant de l'auteur de la modification pour des besoins de traçabilité :
   ```java
   public void modifierTarifHoraire(BigDecimal nouveauPrix, String creePar)
   ```
   Elle vérifie que `nouveauPrix` est strictement positif et que `creePar` est non nul et non vide.

### 5.2 Liste exhaustive des adaptations de tests (Étape B1)

Les 15 tests existants sont préservés et adaptés comme suit :
1. **Initialisation (`@BeforeEach`)** :
   Instanciation avec un `InMemoryTarifRepository` (ou un mock `TarifRepository`) initialisé avec le tarif de base `10.00 DH`.
2. **Types de dates** :
   Toutes les occurrences de `LocalDateTime.of(...)` sont converties en `OffsetDateTime.of(..., ZoneOffset.ofHours(1))`.
   Les valeurs attendues des montants (`BigDecimal`) demeurent strictement identiques (ex. `15.00`, `24.00`, `0.00`, `0.17`).
3. **Tests de modification de tarif** :
   - `modifierTarifHoraire_prixValide_miseAJourEffective` passe `new BigDecimal("15")` et `"admin-1"`.
   - `modifierTarifHoraire_prixNegatif_leveIllegalArgumentException` passe `new BigDecimal("-5")` et `"admin-1"`.
   - `modifierTarifHoraire_prixZero_leveIllegalArgumentException` passe `BigDecimal.ZERO` et `"admin-1"`.
4. **Nouveaux tests unitaires ajoutés** :
   - `modifierTarifHoraire_creeParInvalide_leveIllegalArgumentException` : vérifie qu'un auteur `null` ou vide déclenche une `IllegalArgumentException`.
   - `montantEstime_offsetsDifferents_calculeDureeReelleCorrectement` : vérifie le calcul d'une durée entre deux bornes avec des décalages horaires distincts (ex. début à `09:00+01:00` et fin à `10:30+02:00`, durée réelle = 30 minutes → montant attendu : `5.00 DH`).

---

## 6. Architecture de la couche données et dépendances POM

`TarifService` demeure une classe pure, sans annotation d'infrastructure Spring.

```
TarifRepository (interface)
  ├── lireTarifCourant() : BigDecimal
  └── enregistrerNouveauTarif(prix: BigDecimal, creePar: String) : void

JpaTarifRepository (implémentation Spring Data JPA, annotée @Repository)
  └── TarifHoraireJpaRepository (interface Spring Data)
  └── TarifHoraire (entité JPA associée à la table tarif_horaire)

InMemoryTarifRepository (implémentation de test en mémoire pour tests unitaires)
```

### Dépendances POM copiées de `reservations-service/pom.xml`

Les artefacts et groupes sont strictement alignés sur `reservations-service/pom.xml` (gérés par le parent `spring-boot-starter-parent:4.1.2`) :

```xml
<dependencies>
    <!-- Web MVC pour les contrôleurs REST et filtres HTTP -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webmvc</artifactId>
    </dependency>

    <!-- JPA / Hibernate pour la persistance du tarif horaire -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <!-- Driver PostgreSQL -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- Validation Jakarta (@Valid, @NotNull, etc.) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- Tests unitaires et d'intégration -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webmvc-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

---

## 7. Client Abonnements (`AbonnementsReductionClient`)

Le client HTTP implémente l'interface `ReductionProvider` :

```
AbonnementsReductionClient implements ReductionProvider
```

**Règles strictes de traitement des réponses partenaires** :
- Endpoint ciblé : `GET {ABONNEMENTS_API_URL}/internal/abonnements/reduction?conducteurId={id}` avec `Authorization: Basic ...`
- Délais : connexion 2 s, lecture 3 s.
- Si `ABONNEMENTS_API_URL` est vide ou si le service Abonnements est injoignable (timeout, connexion refusée) → déclenche `ServiceUnavailableException` traduite en HTTP **`503`**.
- Si Abonnements répond **`404`** : considéré comme une anomalie de réponse partenaire → HTTP **`502`** (`code: PARTNER_RESPONSE_INVALID`).
- Si le pourcentage renvoyé est inférieur à 0 ou supérieur à 100 : réponse invalide → HTTP **`502`** (`code: PARTNER_RESPONSE_INVALID`).
- Si le format JSON est illisible ou tronqué → HTTP **`502`** (`code: PARTNER_RESPONSE_INVALID`).
- Seule une réponse HTTP `200` avec un corps `{"reductionPourcent": X}` où `0 <= X <= 100` est acceptée.

---

## 8. Format d'erreur uniforme et codes de statut

Toutes les erreurs de l'API retournent un corps JSON standardisé :
```json
{
  "code": "CODE_ERREUR",
  "message": "Message explicatif compréhensible par un étudiant"
}
```

### Matrice des codes HTTP par route

| Route | 400 | 401 | 403 | 502 | 503 |
|-------|-----|-----|-----|-----|-----|
| `POST /internal/tarifs/estimate` | Dates invalides, fin avant début | Auth machine absente ou incorrecte | — | Réponse Abonnements invalide (404, hors [0, 100], JSON corrompu) | Abonnements injoignable ou non configuré |
| `POST /internal/tarifs/final` | Dates invalides, fin avant début | Auth machine absente ou incorrecte | — | Idem | Idem |
| `GET /api/tarifs/hourly` | — | Session utilisateur absente ou expirée | — | — | Auth service injoignable, ou credentials machine Tarifs refusés (401/403) par l'Auth |
| `PUT /api/tarifs/hourly` | Prix <= 0, corps invalide | Session utilisateur absente ou expirée | Rôle != ADMIN, CSRF invalide/absent, ou Origin invalide | — | Auth service injoignable, ou credentials machine Tarifs refusés (401/403) par l'Auth |

---

## 9. Plan de tests

### Tests unitaires purs (sans serveur REST, sans DB)
- `TarifServiceTest` : 15 tests existants adaptés + test offsets multiples + validation `creePar`.
- `InMemoryTarifRepositoryTest` : vérification du repository en mémoire.

### Tests de la couche Web (MockMvc avec dépendances mockées)
- `InternalTarifsControllerTest` :
  - Auth machine correcte → 200
  - Auth machine absente ou incorrecte → 401
  - Dates invalides → 400
  - Abonnements répond 404 ou réduction 150% → 502
  - Abonnements timeout → 503
- `HourlyRateControllerTest` :
  - `GET /api/tarifs/hourly` sans session → 401
  - `GET /api/tarifs/hourly` avec rôle CONDUCTEUR → 200
  - `PUT /api/tarifs/hourly` avec rôle CONDUCTEUR → 403
  - `PUT /api/tarifs/hourly` avec rôle ADMIN mais sans jeton CSRF → 403
  - `PUT /api/tarifs/hourly` avec rôle ADMIN, CSRF valide et Origin suspect → 403
  - `PUT /api/tarifs/hourly` avec rôle ADMIN, CSRF valide et Origin valide → 200
  - Service Auth injoignable ou credentials Tarifs rejetés par l'Auth → 503

### Tests d'intégration JPA (base jetable uniquement)
- `JpaTarifRepositoryTest` : exécuté uniquement sur conteneur temporaire via script PowerShell dédié (jamais `parking-db`).

---

## 10. Hypothèses à confirmer avec l'équipe

| # | Sujet | Interlocuteur | Question / Action requise |
|---|-------|---------------|---------------------------|
| A | Format réponse auth | **Badr** | Confirmé par le code source : `{ "user": { "userId": "...", "displayName": "...", "roles": [...] }, "authenticatedAt": "..." }`. |
| B | Endpoint Abonnements | **Kamal** | Confirmer le chemin exact de consultation de réduction (ex. `/internal/abonnements/reduction?conducteurId=...`) et l'authentification machine associée. |
| C | Comptes machine | **Badr** | Noms des identifiants machine : `INTERNAL_CALLER_USER` pour les requêtes Réservations → Tarifs, et `AUTH_TARIFS_USER` pour les requêtes Tarifs → Auth. |
| D | Routage Nginx | **Badr + Zakariya** | Confirmer que le reverse proxy Nginx redirige `/api/tarifs/**` vers le port exposé par `tarifs-service`. |
| E | Compte DB Tarifs | **Badr** | Tarifs utilise-t-il le rôle PostgreSQL partagé ou un utilisateur avec droits restreints ? |
| F | `typeVehicule` | **Badr** | Préciser les types admis à terme. Pour le moment : reçu dans le corps du devis, ignoré dans le calcul. |
| G | `quoteReference` dans `/final` | **Badr** | Champ purement informatif ou Tarifs doit-il vérifier la concordance du devis ? |
| H | Déploiement SQL et permissions | **Badr** | Comment `tarifs.sql` s'intègre aux migrations partagées (ex. renommage en `004_tarifs.sql`), et validation des droits : `GRANT SELECT, INSERT ON TABLE tarif_horaire TO <user>;` et `GRANT USAGE, SELECT ON SEQUENCE tarif_horaire_id_seq TO <user>;`. |
