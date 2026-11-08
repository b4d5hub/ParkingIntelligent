# Parking intelligent

Projet universitaire : quatre services backend, un frontend commun et une base PostgreSQL commune. Le dépôt contient le module Réservations et le premier service Abonnements (Nest.js). Places et Tarifs restent à intégrer par leurs responsables. Compose démarre Abonnements sur le réseau interne ; son intégration au routage frontend attend le raccordement de l'authentification.

## Démarrer l'installation locale Réservations

Prérequis : Docker Desktop et Docker Compose. Pour exécuter Java sans Docker : JDK 21. Le build Docker compile le projet ; les tests doivent être exécutés séparément avant une livraison.

Depuis la racine, dans PowerShell :

```powershell
Copy-Item .env.example .env
# Modifier .env : choisir DB_PASSWORD, sans le versionner.
docker compose -f compose.reservations.yml up --build -d
```

Le schéma Abonnements n'est pas exécuté par Docker au démarrage. Après avoir démarré PostgreSQL et créé `parking_auth_users`, exécuter manuellement, dans cet ordre, `subscriptions-service/scripts/script001.sql`, `script002.sql` puis `script003.sql` dans la base `parking`.

## Configuration du service Abonnements

Compose construit le service Nest.js depuis `subscriptions-service/` et le démarre sous le nom `subscriptions` sur le réseau Docker privé `parking`. Il écoute le port `8082` dans le conteneur ; ce port n'est pas publié sur l'ordinateur et le frontend ne le route pas encore. La base commune est fournie par le service `db`.

Variables utilisées par le service :

- `PORT` : port HTTP interne, défini à `8082` dans Compose.
- `DB_URL` : adresse PostgreSQL interne, définie à `postgres://db:5432/parking`.
- `DB_USER` et `DB_PASSWORD` : identifiants PostgreSQL. `DB_PASSWORD` doit être défini dans le fichier local `.env` (copié depuis `.env.example`) ; ne pas publier ce fichier.
- `NODE_ENV` : défini à `production` dans Compose.

Routes actuellement disponibles : `POST /api/subscriptions` pour créer un abonnement au prix configuré côté serveur et `GET /api/subscriptions/me` pour consulter ceux du conducteur connecté. Les routes exigent un principal de session avec le rôle `CONDUCTEUR` ; le raccordement à l'authentification commune reste à faire. Aucun contrat d'appel direct depuis Places, Réservations ou Tarifs n'est défini pour l'instant. Voir le [README du service](subscriptions-service/README.md) pour les migrations, les prix et les tests.

Ouvrir [http://127.0.0.1:8080](http://127.0.0.1:8080). Le frontend est le seul port publié, sur loopback. La première construction télécharge Java, Maven et les dépendances. Le cookie local peut circuler en HTTP uniquement dans cette installation ; pour un déploiement en ligne, configurer HTTPS et conserver Secure.

Cette installation crée son propre volume `shared-data` et une base commune aux services qui seront ajoutés. Elle ne réutilise ni ne modifie le conteneur existant `parking-db`. Les SQL s'exécutent seulement lors de l'initialisation d'une base vide. Un volume existant exige une revue et une application explicite des migrations manquantes ; ne jamais supprimer le volume pour contourner une erreur.

Créer ensuite les comptes avec la procédure interactive locale :

```powershell
docker compose -f compose.reservations.yml run --rm --no-deps -it reservations java -jar /app/app.jar --spring.profiles.active=provision --spring.main.web-application-type=none
```

Le mot de passe est masqué et confirmé. Choisir les rôles nécessaires, sans attribuer ADMIN à tous les comptes. Aucun compte ni mot de passe prédéfini n'est créé. Le compte et les rôles sont enregistrés dans la base de cette installation.

Les URL et identifiants Places/Tarifs sont vides par défaut. La connexion et la consultation fonctionnent sans ces services ; un devis, une réservation ou un calcul final dépendant d'un partenaire répond `503` tant qu'il n'est pas configuré. Aucun faux tarif ou fausse place n'est utilisé dans l'application. La liste des places appartient au module Places ; le formulaire actuel reçoit son identifiant.

Pour arrêter : `docker compose -f compose.reservations.yml down` (sans `-v` : conserver les données).

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
