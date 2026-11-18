# Parking intelligent

Projet universitaire composé des services Auth, Réservations, Places, Tarifs et Abonnements, d'un frontend commun et d'une base PostgreSQL partagée.

## Démarrage complet en une seule commande

Prérequis : Docker Desktop avec Docker Compose. Depuis la racine du dépôt, lance toute l'application :

```sh
docker compose up --build -d
```

Tous les services et les identifiants machine de développement sont configurés dans Compose ; Node.js n'est pas nécessaire sur le poste. `.env` est facultatif et sert uniquement à surcharger les valeurs locales. Ces identifiants sont réservés au développement local : ne pas exposer les ports au réseau ni les réutiliser en production.

L'application est directement accessible sur [http://127.0.0.1:8080](http://127.0.0.1:8080).

### Persistance des données et comptes de test

Le volume Docker `parking_db_data` conserve les données PostgreSQL entre les démarrages (y compris après `docker compose down`). Ne pas utiliser `-v` si tu souhaites garder les données.

Les comptes de démonstration sont disponibles avec le mot de passe commun **`Parking2026!Passphrase`** :

| Rôle | Email | Nom affiché | Mot de passe |
|---|---|---|---|
| **ADMIN** | `admin@parking.local` | Administrateur | `Parking2026!Passphrase` |
| **CONDUCTEUR** | `driver@parking.local` | Conducteur Test | `Parking2026!Passphrase` |
| **AGENT** | `agent@parking.local` | Agent Test | `Parking2026!Passphrase` |
| **MULTI-RÔLES** | `super@parking.local` | Super Utilisateur | `Parking2026!Passphrase` |

Pour arrêter l'application sans perdre les données :
```sh
docker compose down
```
Ne pas ajouter `-v` si tu souhaites conserver le contenu de la base.

---

## Configuration du service Abonnements

Compose construit le service Nest.js depuis `subscriptions-service/` et le démarre sous le nom `subscriptions` sur le réseau Docker privé `parking`. Il écoute le port `8082` dans le conteneur et le frontend relaie ses routes. La base commune est fournie par le service `db`.

Variables utilisées par le service :

- `PORT` : port HTTP interne, défini à `8082` dans Compose.
- `DB_URL` : adresse PostgreSQL interne, définie à `postgres://db:5432/parking`.
- `DB_USER` et `DB_PASSWORD` : identifiants PostgreSQL. Compose fournit une valeur locale par défaut ; `.env` peut la remplacer.
- `NODE_ENV` : défini à `production` dans Compose.

Routes disponibles : `POST /api/subscriptions` pour créer un abonnement au prix configuré côté serveur et `GET /api/subscriptions/me` pour consulter ceux du conducteur connecté. Le service valide le cookie de session auprès d'Auth ; les appels internes de Tarifs utilisent un compte machine distinct. Voir le [README du service](subscriptions-service/README.md) pour les migrations, les prix et les tests.

### Démarrer seulement une partie des services

Les fichiers `compose.reservations.yml`, `compose.places.yml` et `compose.tarifs.yml` restent disponibles pour les scénarios de développement partiels. Ils ne sont pas requis pour l'application complète. Voir [PLACES_INTEGRATION.md](PLACES_INTEGRATION.md) et le [guide Tarifs](tarifs-service/docs/INTEGRATION_BADR.md) pour ces intégrations spécifiques.

Le frontend est le seul port publié par défaut, sur loopback. Le cookie local circule en HTTP uniquement dans cette installation ; pour un déploiement en ligne, configurer HTTPS.

## Vérifier le module

Depuis `reservations-service`, avec JAVA_HOME pointant sur un JDK 21 :

```powershell
./mvnw.cmd -ntp test
./scripts/Test-Reservations.ps1
```

La première commande teste sans base externe. La seconde crée un PostgreSQL jetable, applique les schémas, lance aussi les tests de transactions, concurrence et authentification HTTP, puis arrête uniquement son propre conteneur. La base de développement n'est pas modifiée. `-Offline` utilise le cache Maven local.

Tests JavaScript sans dépendances : `node --test frontend/tests/api.test.mjs`. Les écrans sont en HTML/CSS/JavaScript standard ; aucun framework frontend n'est imposé à l'équipe. L'adaptateur commun `frontend/api.js` gère session, CSRF et erreurs. Les données affichées utilisent textContent, sans interprétation HTML.

## Documents à transmettre

- [RESERVATIONS.md](RESERVATIONS.md) : règles retenues, routes, concurrence, migrations et propositions Places/Tarifs.
- [AUTHENTICATION.md](AUTHENTICATION.md) : compte commun, login/logout, sessions JDBC, CSRF et validation interne pour les trois autres services.
- [TEAM_HANDOFF.md](TEAM_HANDOFF.md) : travail restant pour assembler le projet.

Paiement retenu : simulation du paiement du creneau a la reservation, sans remboursement. Au depart, seul le temps apres la fin prevue est facture en plus, sans penalite. Aucune expiration pour absence ; un retard ne prolonge pas la fin prevue. Voir RESERVATIONS.md pour la migration 004 et le contrat Tarifs a valider.
