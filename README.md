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

Pour le développement local uniquement, les comptes de démonstration sont disponibles avec le mot de passe commun **`Parking2026!Passphrase`**. Ces identifiants sont publics et ne doivent jamais être utilisés en production ; remplace-les avant tout déploiement partagé :

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

## Analyse statique et qualité du code Java

Les quatre services Java (`auth-service`, `places-service`, `reservations-service` et `tarifs-service`) partagent les règles Checkstyle de `config/checkstyle/checkstyle.xml`. Depuis la racine, génère les quatre rapports HTML :

```sh
mvn -pl auth-service,places-service,reservations-service,tarifs-service \
  org.apache.maven.plugins:maven-site-plugin:3.21.0:site
```

Chaque page s'ouvre dans `SERVICE/target/site/checkstyle.html`. Les rapports XML bruts sont dans `SERVICE/target/site/checkstyle-result.xml`, et les deux formats de cette exécution sont archivés sous `security/reports/checkstyle/`. Pour vérifier les violations dans le terminal et faire échouer le build lorsqu'il en détecte, utilise `mvn checkstyle:check`.

### JaCoCo

Depuis la racine, compile et lance les tests des quatre services, puis génère les rapports JaCoCo :

```sh
mvn clean verify
```

Chaque service produit son rapport HTML dans `SERVICE/target/site/jacoco/index.html`. Le rapport global se trouve dans `target/site/jacoco-aggregate/index.html` (et son XML dans `target/site/jacoco-aggregate/jacoco.xml`). La propriété `sonar.coverage.jacoco.xmlReportPaths` est configurée pour que la prochaine analyse SonarQube importe la couverture globale.

### SonarQube

Démarre le serveur local depuis la racine du dépôt :

```sh
docker compose -f compose.sonar.yml up -d
```

Ouvre [http://localhost:9000](http://localhost:9000). Lors de la première connexion, SonarQube peut demander de changer le mot de passe initial `admin` avant d'accéder à l'interface. Utilise uniquement un mot de passe local et unique, puis crée un token dans **My Account → Security**. Ne réutilise pas ces identifiants ou ce token dans un environnement partagé. Une fois le serveur prêt, définis `SONAR_TOKEN` dans le terminal puis lance l'analyse depuis la racine du dépôt. Le POM agrégateur analyse les quatre modules Java sous le même projet SonarQube `parking-intelligent` :

```sh
mvn clean verify org.sonarsource.scanner.maven:sonar-maven-plugin:5.5.0.6356:sonar -Dsonar.host.url=http://localhost:9000 -Dsonar.token="$SONAR_TOKEN"
```

Le build Maven compile et teste les quatre modules avant l'analyse. Les résultats apparaissent ensemble dans l'interface SonarQube, avec les modules Auth, Places, Réservations et Tarifs. Pour arrêter le serveur sans supprimer ses données, exécute `docker compose -f compose.sonar.yml down`. Le frontend Angular et le service NestJS ne font pas partie de ce projet d'analyse Java.

Le frontend utilise Angular avec Tailwind pour l'écran de connexion et tous les espaces administrateur, conducteur et agent. Voir [le guide frontend](frontend/README.md). Les tests unitaires historiques se lancent avec `cd frontend && node --test test/*.test.js tests/*.test.mjs`. Le guide [Tests E2E Cypress](frontend/TESTING.md#tests-e2e-cypress) décrit les parcours navigateur.

## Test de performance JMeter

Le plan `performance/parking-load-test.jmx` ouvre une session conducteur, puis sollicite les routes de lecture des cinq services à chaque boucle, via le frontend et son proxy API. Démarre d'abord l'application locale avec `docker compose up --build -d`. Installe Apache JMeter 5.6.3 ou une version ultérieure et saisis le mot de passe du compte conducteur dans une variable d'environnement sans l'ajouter aux arguments de la commande. Le plan ne contient aucun mot de passe. Depuis la racine, lance le scénario en mode non graphique :

```sh
read -rsp "Mot de passe conducteur : " JMETER_PASSWORD; export JMETER_PASSWORD; echo
mkdir -p performance/results
run_id="$(date +%Y%m%d-%H%M%S)"
jmeter -n -t performance/parking-load-test.jmx -l "performance/results/run-${run_id}.jtl" -e -o "performance/results/dashboard-${run_id}" -Jthreads=5 -Jrampup=20 -Jduration=60 -Jemail=driver@parking.local
```

Le test utilise cinq utilisateurs simultanés, une montée en charge de 20 secondes, une durée de 60 secondes et une pause de 500 ms dans chaque parcours. Le rapport HTML est créé dans le dossier `dashboard-*`, et les échantillons bruts dans `performance/results/run-*.jtl`. Le plan ne modifie pas les données métier. Ces paramètres servent de scénario de départ ; augmente la charge progressivement et surveille les erreurs avant de comparer les temps de réponse. Le mode non graphique et les options de génération de rapport suivent le [guide officiel JMeter](https://jmeter.apache.org/usermanual/get-started.html).

## Sécurité applicative : OWASP ZAP et Snyk

### OWASP ZAP

Le plan ZAP explore l'application avec le Spider puis examine passivement les réponses ; il ne lance pas de scan actif. Le Compose utilise l'image légère `zaproxy/zap-bare` et le plan Automation Framework `security/zap-automation.yaml`. Démarre d'abord l'application, puis exécute depuis la racine :

```sh
mkdir -p security/reports
docker compose -f docker-compose.yml -f compose.zap.yml --profile security run --rm zap
```

Les rapports apparaissent dans `security/reports/zap-baseline.html` et `security/reports/zap-baseline.json`. Le scan cible l'interface via le réseau Docker Compose ; il ne couvre que les routes découvertes sans session authentifiée. Cette image étant `zap-bare`, le plan Automation Framework remplace le script Baseline empaqueté. Pour une analyse authentifiée des API, il faudra fournir à ZAP un contexte et un compte de test. Voir le [guide officiel ZAP Automation Framework](https://www.zaproxy.org/docs/desktop/addons/automation-framework/) et la [documentation de l'image Docker bare](https://www.zaproxy.org/docs/docker/about/).

### Snyk

Installe Snyk CLI et authentifie-toi une fois avec `snyk auth`. Depuis la racine, construis les modules Maven (les tests ne sont pas lancés par cette commande), puis scanne tous les manifests Maven et npm :

```sh
mkdir -p security/reports
mvn -DskipTests install
snyk test --all-projects --json-file-output=security/reports/snyk-open-source.json
```

`--all-projects` détecte les fichiers `pom.xml` et les verrous `package-lock.json` de l'ensemble du dépôt. Le rapport JSON est conservé dans `security/reports/`. `snyk test` recherche les vulnérabilités connues dans les dépendances, y compris transitives ; `snyk code test` peut être lancé séparément pour l'analyse statique du code si cette fonction est disponible dans le compte Snyk. Consulte la [documentation Snyk CLI](https://docs.snyk.io/developer-tools/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-open-source).

## Documents à transmettre

- [RESERVATIONS.md](RESERVATIONS.md) : règles retenues, routes, concurrence, migrations et propositions Places/Tarifs.
- [AUTHENTICATION.md](AUTHENTICATION.md) : compte commun, login/logout, sessions JDBC, CSRF et validation interne pour les trois autres services.
- [TEAM_HANDOFF.md](TEAM_HANDOFF.md) : travail restant pour assembler le projet.

Paiement retenu : simulation du paiement du creneau a la reservation, sans remboursement. Au depart, seul le temps apres la fin prevue est facture en plus, sans penalite. Aucune expiration pour absence ; un retard ne prolonge pas la fin prevue. Voir RESERVATIONS.md pour la migration 004 et le contrat Tarifs a valider.
