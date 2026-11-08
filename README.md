# Parking intelligent

Projet universitaire : quatre services backend, un frontend commun et une base PostgreSQL commune. Réservations et Places peuvent être assemblés. Tarifs contient le calcul et la persistance mais ses API restent à fournir ; Abonnements reste à ajouter.

## Démarrer l'installation locale Réservations

Prérequis : Docker Desktop et Docker Compose. Pour exécuter Java sans Docker : JDK 21. Le build Docker compile le projet ; les tests doivent être exécutés séparément avant une livraison.

Depuis la racine, dans PowerShell :

```powershell
Copy-Item .env.example .env
# Modifier .env : choisir DB_PASSWORD, sans le versionner.
docker compose -f compose.reservations.yml up --build -d
```

Ouvrir [http://127.0.0.1:8080](http://127.0.0.1:8080). Le frontend est le seul port publié, sur loopback. La première construction télécharge Java, Maven et les dépendances. Le cookie local peut circuler en HTTP uniquement dans cette installation ; pour un déploiement en ligne, configurer HTTPS et conserver Secure.

Cette installation crée son propre volume `shared-data` et une base commune aux services qui seront ajoutés. Elle ne réutilise ni ne modifie le conteneur existant `parking-db`. Les SQL s'exécutent seulement lors de l'initialisation d'une base vide. Un volume existant exige une revue et une application explicite des migrations manquantes ; ne jamais supprimer le volume pour contourner une erreur.

Créer ensuite les comptes avec la procédure interactive locale :

```powershell
docker compose -f compose.reservations.yml run --rm --no-deps -it reservations java -jar /app/app.jar --spring.profiles.active=provision --spring.main.web-application-type=none
```

Le mot de passe est masqué et confirmé. Choisir les rôles nécessaires, sans attribuer ADMIN à tous les comptes. Aucun compte ni mot de passe prédéfini n'est créé. Le compte et les rôles sont enregistrés dans la base de cette installation.

Les URL et identifiants Places/Tarifs sont vides par défaut. La connexion et la consultation fonctionnent sans ces services ; un devis, une réservation ou un calcul final dépendant d'un partenaire répond `503` tant qu'il n'est pas configuré. Aucun faux tarif ou fausse place n'est utilisé dans l'application. Le formulaire charge la liste réelle de Places et permet de choisir une place par son numéro. Sans Places, il explique l'indisponibilité et propose de réessayer.

Pour assembler Réservations et Places, renseigner les deux comptes machine dans `.env`, puis utiliser `docker compose -f compose.reservations.yml -f compose.places.yml up --build -d`. Voir [PLACES_INTEGRATION.md](PLACES_INTEGRATION.md) pour les variables et les migrations. Cet assemblage active la synchronisation Places ; il ne fournit pas encore les API Tarifs.

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
