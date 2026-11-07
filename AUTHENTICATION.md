# Authentification commune du parking

État vérifié le 7 novembre 2026. Ce document remplace les anciens checkpoints de préparation.

## Architecture

Conserver quatre backends, un frontend et une seule base PostgreSQL. Le package technique `com.parking.reservations_service.auth` héberge la connexion dans Réservations. Le navigateur reçoit un cookie opaque ; ne pas conserver de token dans localStorage. Les autres services restent responsables de leurs droits métier.

Spring Security gère les mots de passe, login, logout, session et CSRF. Les comptes sont dans `parking_auth_users` et `parking_auth_user_roles`. Rôles : `CONDUCTEUR`, `AGENT`, `ADMIN`. L'identifiant utilisateur sert de conducteur dans Réservations et vient uniquement du principal authentifié. Confirmer cette correspondance avec Abonnements. Les identifiants JSON sont des chaînes décimales pour préserver les BIGINT.

Les mots de passe utilisent Argon2id via l'encodeur Spring : 19 MiB, deux passes, parallélisme 1, sel généré par la bibliothèque, format préfixé `{argon2}`. Aucun mot de passe réel ni compte de démonstration n'est versionné. Aucun endpoint public ne permet de créer un agent ou administrateur.

## Parcours navigateur implémenté

Activer le profil `auth` après création des tables. Les API de réservation sont désactivées sans ce profil.

1. `GET /api/auth/csrf` retourne `headerName` et `token`. Garder ce jeton en mémoire.
2. `POST /api/auth/login` accepte un formulaire `email`, `password` et l'en-tête CSRF. Succès : `200`, identité minimale ; échec générique : `401 INVALID_CREDENTIALS` ; stockage indisponible : `503`.
3. La connexion renouvelle la session. Récupérer un nouveau jeton CSRF après connexion.
4. `GET /api/auth/me` retourne `userId`, `displayName`, `roles`, ou `401`.
5. Chaque modification exige le jeton de cette session. Jeton absent/invalide : `403 CSRF_INVALID` ; rôle insuffisant : `403 ACCESS_DENIED`.
6. `POST /api/auth/logout`, avec CSRF, invalide la session et répond `204`.

Utiliser des URL relatives et `credentials: 'same-origin'`. Ne pas envoyer un conducteur ou un rôle dans un en-tête pour prouver l'identité. Ne pas exposer les empreintes de mots de passe.

Le cookie `PARKING_SESSION` est HttpOnly, Secure, SameSite=Lax, Path=/, sans Domain. HTTPS est nécessaire en ligne. Le profil `auth,local` permet HTTP sur loopback uniquement ; le profil local désactive Secure et ne doit pas être utilisé sur une machine accessible au réseau.

Les routes navigateur exigent les rôles : conducteur pour devis/création/consultation personnelle/annulation ; agent pour consultation des opérations et arrivée/départ. Un administrateur ne reçoit pas automatiquement ces rôles. Les contrôles de propriétaire sont dans le service, pas seulement dans l'interface. Une réservation appartenant à un autre conducteur répond `404`.

## Intégration à réaliser avec l'équipe

Le frontend/Nginx commun doit transmettre `/api/auth/**` et `/api/reservations/**` à Réservations, puis chaque autre préfixe au service concerné. Ne jamais publier `/internal/**`. Aucune technologie ni aucun port n'est imposé aux trois autres modules.

Contrat implémenté côté Réservations, à confirmer et intégrer avec Places, Tarifs et Abonnements : `POST /internal/auth/validate-user-request`, avec authentification machine distincte par service (HTTP Basic sur TLS), sans session machine. Corps proposé : `sessionCookie`, `httpMethod`, `csrfToken`. Le middleware extrait ces valeurs de la vraie requête HTTP ; il ne prend pas une identité dans le JSON métier.

La validation vérifie la session, son expiration, l'état actuel du compte et CSRF pour les modifications. Elle retourne `{"user":{"userId":"42","displayName":"...","roles":["CONDUCTEUR"]},"authenticatedAt":"..."}`. Les clients autorisés sont configurés par `AUTH_PLACES_USER` / `AUTH_PLACES_PASSWORD_HASH`, `AUTH_TARIFFS_USER` / `AUTH_TARIFFS_PASSWORD_HASH`, `AUTH_SUBSCRIPTIONS_USER` / `AUTH_SUBSCRIPTIONS_PASSWORD_HASH`. Chaque empreinte doit utiliser le format `{argon2}` et chaque nom doit être distinct. Aucun client n'est actif sans configuration. Refuser en cas de panne ; ne pas faire confiance à une identité non vérifiée. Les objets de session Java ne doivent pas être désérialisés par les autres langages.

Zakariya protège la gestion des places pour ADMIN et les occupations pour le client machine Réservations. Amine protège les tarifs et les calculs internes. Kamal limite un conducteur à ses propres abonnements et protège les formules. Chacun contrôle les rôles dans son backend, même si un bouton est caché dans le frontend.

## Points restant à terminer avant exposition en ligne

Les scripts `db/auth/001_accounts.sql` et `002_sessions.sql` sont fournis. Ils n'ont pas été appliqués à la base existante `parking-db`. Les tests utilisent une base temporaire et un stockage simulé selon le scénario. Le profil `auth` active maintenant explicitement Spring Session JDBC. Les cookies contiennent l'identifiant opaque Spring sans encodage base64 ; les autres services le transmettent sans transformation.

JDBC, expiration après 30 minutes d'inactivité, durée absolue de 8 heures, révocation après changement du mot de passe/des rôles ou désactivation, et API interne sont implémentés. Chaque requête authentifiée relit le compte ; une panne renvoie `503`. Un contrôle de version compare une empreinte du hash de mot de passe, sans conserver le mot de passe dans la session. La connexion est limitée à 10 tentatives par compte et 50 par adresse sur 5 minutes, puis `429` avec Retry-After. Seuils configurables par `parking.auth.login-account-limit` et `parking.auth.login-address-limit`. Le compteur est borné en mémoire pour une seule instance ; un déploiement distribué nécessitera un limiteur partagé. Le provisioning doit contrôler les phrases de passe (minimum 15 caractères, maximum au moins 64, sans troncature, blocage des valeurs faibles). Les inscriptions, récupération de compte et MFA ne sont pas encore définis.

Ces limites doivent être levées avant une utilisation réelle en ligne. Les chemins internes, clients machines, origine HTTPS et responsabilités d'exploitation doivent être convenus avec l'équipe.

## Vérification actuelle

Les tests couvrent les bons/mauvais mots de passe, comptes absents/désactivés/sans rôle, panne de stockage, effacement des credentials, CSRF, renouvellement de session, login/logout et droits des réservations. Huit tests HTTP supplémentaires utilisent PostgreSQL réel : persistance et rotation, logout, révocation, deux expirations, limitation des essais et validation interne avec CSRF. Le total final vérifié est de 82 tests Java réussis sur base temporaire, complétés par cinq tests JavaScript et les parcours navigateur décrits dans RESERVATIONS.md. Cela ne prouve pas encore l'intégration de l'authentification dans les trois autres modules.

Voir [RESERVATIONS.md](RESERVATIONS.md) pour les règles métier, migrations, contrats partenaires et tests PostgreSQL du module.

Références : [Spring Security : mots de passe](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html), [CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html), [sessions](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html), [Spring Session JDBC](https://docs.spring.io/spring-session/reference/configuration/jdbc.html), [OWASP authentification](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Provisionnement local

Après les migrations et le packaging Maven, un opérateur peut créer un compte depuis un terminal interactif :

```powershell
java -jar reservations-service/target/reservations-service-0.0.1-SNAPSHOT.jar --spring.profiles.active=provision --spring.main.web-application-type=none
```

Fournir DB_URL, DB_USER et DB_PASSWORD dans l'environnement, sans les afficher ni les versionner. Le programme demande email, nom, rôles et une phrase de passe de 15 à 128 caractères, masquée et confirmée. Il crée le compte et ses rôles dans une transaction puis s'arrête. Aucun compte n'est créé automatiquement. Ne pas activer `auth` en même temps que `provision`. La procédure a été vérifiée avec un compte synthétique dans l'installation de test temporaire ; aucun compte n'a été créé dans la base de l'utilisateur. Avant une ouverture publique, ajouter un contrôle de mots de passe compromis, une récupération de compte et MFA pour les comptes privilégiés.