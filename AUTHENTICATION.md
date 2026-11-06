# Authentification commune du parking

Date : 6 novembre 2026.

Ce document définit la conception de l'authentification pour les quatre modules. Il permet à chaque membre de préparer son intégration. La couche des comptes et le parcours HTTP de connexion sont maintenant implémentés et testés avec un stockage simulé. Les scripts SQL ne sont pas appliqués ; la persistance des sessions, les droits métier et l'intégration des autres services restent à réaliser.

L'approche retenue pour le prototype est une connexion unique avec une session côté serveur. Le navigateur conserve seulement un cookie opaque. Les quatre services appliquent les droits sur leurs propres données.

Les contrats ci-dessous sont la proposition commune à relire avec l'équipe avant de coder les intégrations. Les technologies et les ports des autres services restent à confirmer.

## Architecture retenue

Conserver les quatre backends Réservations, Places, Tarifs et Abonnements, le frontend commun et une seule base PostgreSQL.

Pour démarrer, héberger l'authentification dans un package technique séparé de Réservations, par exemple `com.parking.reservations_service.auth`. Cette responsabilité est proposée à Badr Eddine pour éviter d'ajouter un cinquième backend ; sa prise en charge doit être convenue avec l'équipe. Aucun autre module ne développe un deuxième login.

Utiliser Spring Security pour vérifier les mots de passe, gérer la connexion, la session, la déconnexion et la protection CSRF. Utiliser Spring Session JDBC pour conserver les sessions dans PostgreSQL. Les autres services valident une session par l'API interne décrite plus bas ; ils ne lisent pas les objets Java sérialisés dans les tables de session.

Le frontend et les API utilisent la même origine publique. Le point d'entrée frontend/Nginx transmet `/api/auth/**` et `/api/reservations/**` à Réservations, puis les autres préfixes à leurs services. Le navigateur utilise des URL relatives. Ces routes Nginx ne sont pas encore configurées dans le dépôt.

Ce choix convient à un prototype avec un frontend commun. Il évite de construire un émetteur JWT, de distribuer une clé secrète à toute l'équipe ou d'ajouter un fournisseur d'identité maintenant. Une évolution vers OpenID Connect pourra être étudiée si plusieurs applications clientes ou une connexion institutionnelle deviennent nécessaires.

Sources : [sessions Spring Security](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html), [Spring Session JDBC](https://docs.spring.io/spring-session/reference/configuration/jdbc.html).

## Comptes et identité

Prévoir un registre unique des utilisateurs, appartenant au module technique d'authentification : identifiant interne stable, adresse email de connexion unique, nom affiché, empreinte du mot de passe, compte actif et rôles attribués côté serveur.

Pour le prototype, proposer que `conducteur_id` corresponde à l'identifiant de cet utilisateur lorsqu'il possède le rôle `CONDUCTEUR`. Vérifier ce choix avec Abonnements et les éventuelles données existantes avant toute migration. Si une table Conducteur distincte existe plus tard, définir une correspondance explicite et unique ; ne jamais faire une correspondance par email à chaque requête.

Dans les réponses d'authentification, transmettre `userId` comme une chaîne décimale, par exemple `"42"`, afin de conserver la précision d'un BIGINT dans tous les langages. Cela ne modifie pas aujourd'hui le DTO Réservation, qui utilise encore `Long` ; sa représentation JSON devra être harmonisée lors de l'intégration.

L'identifiant du conducteur vient de la session validée. Un `conducteurId`, un rôle ou un en-tête `X-User-Id` envoyé par le navigateur ne prouve jamais une identité. Les DTO de création de réservation ne doivent pas permettre au navigateur de choisir le conducteur, le statut ou les montants.

Pour la première version, prévoir des comptes de démonstration provisionnés par une procédure réservée à l'équipe, avec des secrets locaux non versionnés. Ne pas exposer un endpoint public de création d'agent ou d'administrateur. L'inscription publique, la vérification d'email et la récupération de compte seront définies séparément si elles sont retenues.

## Mots de passe

Utiliser un `PasswordEncoder` Spring avec Argon2id et un sel généré par la bibliothèque. Point de départ : mémoire de 19 MiB, deux passes et parallélisme de 1 ; mesurer le coût sur l'environnement cible. Conserver le format permettant de reconnaître l'algorithme et de faire évoluer ses paramètres. Vérifier les dépendances nécessaires lors de l'implémentation, sans les installer dans cette étape documentaire.

Ne jamais enregistrer le mot de passe en clair, le chiffrer de manière réversible ou utiliser un simple SHA-256. Ne pas retourner l'empreinte dans les DTO ou les journaux.

Sans MFA, retenir au moins 15 caractères, accepter les phrases de passe et au moins 64 caractères au maximum. Ne pas tronquer silencieusement. Refuser les mots de passe courants ou compromis sans envoyer le mot de passe en clair à un service externe. Préférer une politique de longueur et de blocage des valeurs faibles à des règles arbitraires de majuscules et de symboles.

Limiter les essais par compte et par adresse source, avec un délai progressif et une réponse générique. Les seuils seront configurables et testés ; éviter un blocage permanent exploitable contre un utilisateur. Prévoir MFA pour les comptes privilégiés avant un usage réel en ligne.

Sources : [OWASP stockage des mots de passe](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP authentification](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [PasswordEncoder Spring](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html).

## Session et cookie

Le cookie proposé est `PARKING_SESSION`, avec `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` et sans attribut `Domain`. Il contient seulement l'identifiant opaque produit par le framework. Ni mot de passe, ni rôle, ni donnée métier dans sa valeur. Ne pas placer ce secret dans les URL, `localStorage` ou `sessionStorage`.

Valeurs de départ proposées : expiration après 30 minutes d'inactivité et durée absolue de 8 heures après connexion. Ce sont des paramètres du projet, pas des durées imposées par une norme. Le serveur applique les deux limites, y compris pour les consultations effectuées via les autres services.

Renouveler l'identifiant de session après connexion. Invalider la session à la déconnexion et révoquer les sessions d'un compte après changement du mot de passe, des rôles ou désactivation. Vérifier aussi l'état actuel du compte lors de chaque validation : une ancienne session ne doit pas conserver un droit retiré.

Les réponses d'authentification et les réponses personnelles utilisent `Cache-Control: no-store`. Ne jamais journaliser cookies, mots de passe, jetons CSRF ou secrets interservices. Les sessions persistées et les sauvegardes de la base sont des données sensibles ; limiter leurs accès.

En ligne, utiliser HTTPS. Pour le développement HTTP sur loopback uniquement, un profil dédié pourra désactiver `Secure` ; cette exception ne doit jamais être active dans un déploiement accessible à d'autres machines.

Source : [OWASP gestion des sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Connexion et protection CSRF

CSRF désigne une requête qu'un autre site tente de faire envoyer par le navigateur avec son cookie. Le cookie de session ne suffit donc pas pour autoriser une modification.

Parcours commun proposé :

1. Le frontend appelle `GET /api/auth/csrf`. Le serveur peut créer une session anonyme et retourne `{"headerName":"X-CSRF-TOKEN","token":"<valeur>"}`.
2. Le frontend conserve le jeton CSRF en mémoire et envoie `POST /api/auth/login`, au format `application/x-www-form-urlencoded`, avec `email`, `password` et l'en-tête CSRF. Configurer le filtre de connexion Spring avec ces noms de paramètres.
3. Le filtre Spring authentifie l'utilisateur et renouvelle la session. Répondre `200` avec l'identité minimale, sans redirection HTML ; un échec renvoie `401` et un message générique. Le navigateur reçoit le cookie, que JavaScript ne peut pas lire.
4. Après connexion, rappeler `/api/auth/csrf` : le précédent jeton peut avoir été invalidé par Spring. `GET /api/auth/me` retourne l'identité courante ou `401`.
5. Tout `POST`, `PUT`, `PATCH` ou `DELETE` du navigateur exige le jeton CSRF de cette session. Les GET ne modifient aucune donnée métier.
6. `POST /api/auth/logout` exige CSRF, invalide la session, supprime le cookie et répond `204`. Renouveler le jeton avant une connexion suivante.

Contrat JSON proposé pour le succès du login et `/api/auth/me` : `{"userId":"42","displayName":"Conducteur de démonstration","roles":["CONDUCTEUR"]}`. Format commun d'erreur : `{"code":"AUTHENTICATION_REQUIRED","message":"Authentification requise"}`. Ne pas ajouter de détails internes ou indiquer si une adresse email existe lors d'un échec de connexion.

Utiliser les mécanismes Spring de génération, de masquage et de validation du jeton ; ne pas inventer un calcul cryptographique. Garder la protection sur login et logout. Pour les API, personnaliser les erreurs en JSON : une absence d'authentification valide vaut `401`, un refus de droit ou CSRF vaut `403` selon le contrôle ayant échoué.

Le frontend utilise `credentials: "same-origin"`. Éviter CORS lorsque tout passe par la même origine. Si le développement exige une autre origine, autoriser uniquement les origines exactes convenues, avec un proxy de développement de préférence ; jamais `*` avec les credentials.

Pour les requêtes navigateur qui modifient des données, vérifier aussi l'origine lorsqu'elle est fournie. Les informations de proxy comme `Forwarded` ou `X-Forwarded-Proto` ne sont acceptées que depuis le proxy de confiance, après suppression des valeurs envoyées directement par le client.

Sources : [CSRF Spring Security](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html), [connexion par filtre Spring](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/form.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Contrat commun de validation interne

Places, Tarifs et Abonnements ont besoin de la même identité. Leur middleware appelle l'authentification avant chaque requête utilisateur protégée. Réservations applique les contrôles directement avec Spring, sans s'appeler lui-même en HTTP.

Endpoint proposé : `POST /internal/auth/validate-user-request`. Cette API est spécifique au projet ; ce n'est pas un endpoint OAuth standard. Elle est accessible aux services autorisés uniquement, sans route publique Nginx et sans CORS navigateur.

Chaque service possède un identifiant machine et un secret aléatoire distinct, stocké hors Git. Le contrat utilise HTTP Basic sur TLS pour authentifier ce client interne. La valeur base64 n'est pas du chiffrement. Pour une installation HTTP entièrement locale, n'utiliser que des secrets de démonstration et un réseau privé ; ne pas réutiliser cette exception en ligne. Le serveur vérifie le secret et les permissions du service ; le réseau Docker seul ne constitue pas une authentification.

La requête JSON contient les informations extraites de la vraie requête HTTP par le middleware :

```json
{
  "sessionCookie": "<valeur exacte du cookie PARKING_SESSION>",
  "httpMethod": "POST",
  "csrfToken": "<valeur de X-CSRF-TOKEN>"
}
```

Pour une lecture GET, `csrfToken` peut être `null`. Le middleware ne prend jamais la méthode ou ces informations dans le JSON métier fourni par l'utilisateur. Rejeter les méthodes inconnues. Transmettre ces secrets dans le corps, jamais dans l'URL, et masquer le corps dans les journaux.

L'authentification vérifie le client machine, retrouve et décode la session avec Spring Session, contrôle son expiration et le compte actif, puis valide CSRF pour toute méthode de modification. Pour ce chemin interne seulement, séparer le filtre d'authentification machine, sans session machine : il ne doit ni remplacer l'identité de l'utilisateur ni désactiver CSRF sur les routes navigateur. La validation du jeton utilisateur reste obligatoire dans le traitement interne.

Réponse `200`, avec `Cache-Control: no-store`, seulement si tous les contrôles sont valides :

```json
{
  "userId": "42",
  "roles": ["CONDUCTEUR"],
  "authenticatedAt": "2026-11-06T12:00:00Z",
  "absoluteExpiresAt": "2026-11-06T20:00:00Z"
}
```

Les valeurs sont illustratives. Aucun mot de passe, cookie ou jeton CSRF dans cette réponse. L'API maintient l'heure d'activité de la session quand une vraie requête utilisateur est validée, sans prolonger l'expiration absolue.

Erreurs JSON proposées : `401 AUTHENTICATION_REQUIRED` pour une session invalide ; `403 CSRF_INVALID` pour CSRF ; `401 SERVICE_AUTHENTICATION_FAILED` pour un client machine invalide ; `403 SERVICE_FORBIDDEN` pour un client sans permission. Les services traduisent une erreur de leur propre credential machine en `503` pour le navigateur et une alerte technique, sans demander au conducteur de se reconnecter.

L'identité retournée est valable pour cette requête seulement. Le service applique ensuite ses rôles et le contrôle de propriété. S'il ne peut pas valider la session, ou si l'authentification est indisponible, il ne lance pas l'action métier et renvoie `503`. Aucun cache positif dans cette première version, afin de ne pas accepter une session déjà révoquée. Un délai de départ de 2 secondes pour l'appel interne est proposé et devra être mesuré.

Cette centralisation ajoute un appel réseau et rend les opérations protégées dépendantes de l'authentification hébergée dans Réservations. C'est un compromis explicite pour le prototype, à mesurer lors des tests de performance.

## Rôles et propriété des données

Les noms communs sont `CONDUCTEUR`, `AGENT` et `ADMIN`. Ils sont attribués uniquement côté serveur. Dans Spring, les autorités peuvent être `ROLE_CONDUCTEUR`, `ROLE_AGENT`, `ROLE_ADMIN` ; le JSON commun utilise les noms sans préfixe.

- `CONDUCTEUR` : créer une réservation à son nom, consulter et annuler ses réservations selon les règles métier ; gérer ses propres abonnements.
- `AGENT` : consulter les données nécessaires à l'exploitation et enregistrer les arrivées et départs. Aucun droit de gestion des tarifs, des formules ou des rôles.
- `ADMIN` : gérer les places, les tarifs et les formules d'abonnement. Tout accès supplémentaire, notamment à l'ensemble des réservations personnelles, doit être défini explicitement. Aucun héritage automatique entre les rôles.

Refuser toute action non autorisée explicitement. Pour une réservation personnelle, faire la recherche avec l'identifiant de réservation ET l'identifiant du conducteur authentifié. Un identifiant appartenant à un autre conducteur renvoie `404`, comme un identifiant absent. Masquer un bouton dans le frontend ne remplace pas ce contrôle serveur.

La liste générale actuellement disponible dans le profil `local` ne devient pas une liste publique après connexion. Prévoir une consultation personnelle telle que `GET /api/reservations/me` et des routes d'exploitation distinctes pour l'agent. Leur contrat précis devra être fixé avant modification du contrôleur.

Source : [OWASP autorisation](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Appels métier entre services

Une session utilisateur et un compte machine ont des fonctions différentes. Chaque endpoint interne vérifie quel service l'appelle et quelle action il peut effectuer. Ne jamais accepter un rôle d'administrateur ou une identité utilisateur dans un en-tête non vérifié.

Permissions de départ proposées : Réservations consulte l'état des places, demande leur occupation/libération et demande les calculs de Tarifs ; Tarifs demande à Abonnements la réduction applicable. Un service ne peut pas utiliser son secret pour appeler une API navigateur ou devenir administrateur.

Les endpoints internes de calcul ou d'occupation acceptent les identifiants métier transmis par un service autorisé, après validation et contrôle du scénario. Un conducteur appelant une route publique ne peut pas remplacer son identité pour obtenir la réduction ou les données d'un autre conducteur.

Ne pas transmettre la session et tous les cookies à chaque appel métier. Réservations vérifie d'abord les droits de l'utilisateur puis effectue l'appel interne avec son identité machine et les seules données nécessaires. Les secrets de validation et les permissions des appels métier doivent être gérés explicitement, par client et destination.

Le point d'entrée supprime les en-têtes d'identité fournis par un client externe. Chaque backend garde ses contrôles, même si une requête contourne le frontend. Ne pas exposer les ports internes en ligne ; les noms Compose et les adresses internes restent à convenir, sans inventer les ports des autres modules.

Source : [OWASP sécurité des microservices](https://cheatsheetseries.owasp.org/cheatsheets/Microservices_Security_Cheat_Sheet.html).

## Base de données et configuration

Préparer des migrations SQL explicites pour les comptes, les rôles, les clients machines et les tables Spring Session PostgreSQL, dans la base commune. Réutiliser le script du composant Spring Session réellement installé. Prévoir un préfixe technique convenu et un compte PostgreSQL par service avec les droits minimaux ; cela ne crée pas plusieurs bases.

Seul le module d'authentification gère les empreintes des mots de passe et le contenu des sessions. Les autres services ne doivent pas modifier ces tables ni ajouter leurs propres colonnes de mot de passe. Ne pas ajouter de clé étrangère vers une table utilisateur supposée avant d'avoir défini la correspondance des identifiants avec l'équipe.

Conserver `ddl-auto=validate`. Prévoir la désactivation de l'initialisation automatique du schéma Spring Session après application de sa migration explicite. Aucun `ddl-auto=update` global et aucune remise à zéro des volumes.

Les clés de configuration et leurs exemples pourront être versionnés, mais les credentials réels restent dans les variables d'environnement ou les fichiers locaux ignorés. Aucun compte admin avec un mot de passe fixe dans le dépôt. Garder les versions gérées par le POM Spring Boot existant ; vérifier leur compatibilité avant tout ajout de dépendance.

## Travail de chaque membre

- Badr Eddine, Réservations : convenir de la responsabilité du module technique, puis implémenter login/session/CSRF et l'API de validation ; protéger les réservations par rôle et propriétaire.
- Zakariya, Places : intégrer la validation commune pour les requêtes utilisateur ; réserver la gestion des places à l'administrateur et l'occupation/libération aux appels internes autorisés.
- Amine, Tarifs : intégrer la validation commune ; protéger les modifications de tarif ; séparer les calculs internes et ne pas accepter une réduction imposée par le navigateur.
- Kamal, Abonnements : intégrer la validation commune ; limiter chaque conducteur à ses abonnements ; protéger la gestion des formules et la consultation interne des réductions.
- Frontend commun, répartition à convenir : un seul écran de connexion, gestion du cookie par le navigateur, récupération et renouvellement de CSRF, affichage selon le rôle et traitement cohérent des erreurs. Le code partagé de connexion ne doit pas être recopié dans quatre dossiers.

## Vérifications avant intégration

Vérifier au minimum les scénarios suivants, avec deux conducteurs distincts et des comptes agent/admin séparés :

- Une requête protégée sans session ou avec une session expirée est refusée.
- La connexion renouvelle l'identifiant de session ; la déconnexion et la révocation empêchent toute réutilisation ultérieure.
- Modifier un rôle ou désactiver un compte retire l'accès aux anciennes sessions.
- Un conducteur ne peut ni lister ni modifier les données de l'autre, même en devinant son identifiant ou en forgeant un en-tête.
- Les modifications sans CSRF, avec un mauvais jeton ou avec le jeton d'une autre session échouent dans chacun des quatre modules.
- Un faux compte machine, un secret destiné à un autre service ou une permission insuffisante bloque l'appel interne.
- Une panne d'authentification renvoie une erreur contrôlée sans accès aux données ni modification métier.
- Aucun cookie, secret ou mot de passe n'apparaît dans les journaux ; les chemins internes sont inaccessibles depuis l'entrée publique.
- Les appels protégés et la charge de vérification des mots de passe respectent les objectifs mesurés du prototype.

Ces scénarios restent à vérifier en intégration réelle. Les tests avec stockage simulé décrits plus bas couvrent une partie du parcours d'authentification, mais ne prouvent pas le fonctionnement de PostgreSQL, des cookies dans le navigateur ou des échanges entre services.

Vérification du 6 novembre 2026 : après autorisation du téléchargement des composants Maven manquants, les six tests ciblés du contrôleur ont réussi avec Java 21, sans échec ni erreur. Ils couvrent les réponses JSON, une liste vide, une réservation trouvée ou absente, les identifiants invalides et la désactivation des routes sans profil `local`. Ils n'utilisent pas PostgreSQL et ne testent pas encore l'authentification.

## Situation actuelle et prochaine étape

Le contrôleur de consultation reste limité par `@Profile("local")`. Le parcours d'authentification est limité au profil `auth`, inactif par défaut. Ce profil refuse actuellement les routes métier, même après connexion, tant que les contrôles de rôle et de propriétaire ne sont pas branchés. Ces profils ne constituent pas une configuration prête pour un déploiement en ligne.

La prochaine étape proposée est la revue des tables de comptes, puis leur application uniquement après autorisation explicite et vérification des données existantes. Il faudra ensuite tester la recherche réelle, configurer et tester les sessions JDBC, puis les contrôles de propriétaire et les échanges internes. La limitation des essais et la révocation doivent être ajoutées avant une utilisation réelle en ligne.

Avant cette étape, l'équipe doit confirmer la responsabilité de l'authentification, la correspondance `userId` / `conducteur_id`, le provisioning des comptes, les clients machines et la configuration de l'origine publique. Les règles de paiement, de tolérance d'absence et de remboursement restent indépendantes et non décidées par ce document.

La rédaction de ce document ne modifie ni le code, ni le POM, ni la base. Tout commit et tout push doivent faire l'objet d'un accord explicite de Badr Eddine ; les messages de commit restent en français.

## Préparation des dépendances et du schéma

Étape suivante réalisée le 6 novembre 2026 : le POM contient maintenant le starter Spring Security, le module Spring Session JDBC et le starter de tests Security, avec les versions gérées par Spring Boot 4.1.2. Le build et les sept tests MVC ciblés ont réussi avec Java 21, y compris le refus des appels anonymes. Cela remplace le précédent résultat de six tests pour le contrôleur.

Hors profil `auth`, le starter active les protections Spring par défaut lors d'un nouveau démarrage, y compris sur le health endpoint. Le parcours spécifique au profil `auth` est décrit plus bas ; les droits métier et les contrôles de propriétaire restent à implémenter. Le module Session JDBC est ajouté directement, sans starter Session Boot et sans activation de la session JDBC avant approbation des tables. Les [modalités Spring Boot](https://docs.spring.io/spring-boot/reference/web/spring-session.html) permettent cette préparation sans activer le stockage de session.

Les propositions SQL se trouvent dans `reservations-service/src/main/resources/db/auth/001_accounts.sql` et `002_sessions.sql`, avec un `README.md` de revue. Elles n'ont pas été appliquées. Aucun compte n'est créé et aucun lien avec `reservations.conducteur_id` n'est ajouté. Le script de session provient du JAR Spring Session JDBC 4.1.1 résolu localement.

## Préparation de la couche des comptes

Le package `com.parking.reservations_service.auth` contient maintenant le modèle de compte, les trois rôles, une recherche JDBC par email et l'adaptation vers `UserDetailsService`. La requête utilise un paramètre SQL et les rôles proviennent des tables proposées. Ces classes ne sont pas des entités JPA ; elles n'ajoutent pas de validation Hibernate de tables encore absentes.

`AuthAccountConfiguration` est limitée au profil `auth`, inactif par défaut. Aucun profil n'a été activé pour l'application locale et aucun script SQL n'a été appliqué. Ne pas activer ce profil avant approbation et création des tables. Il prépare la recherche des comptes ; il ne constitue pas encore la configuration finale du login, des routes et des sessions.

Les mots de passe sont vérifiés par `DaoAuthenticationProvider` avec un encodeur Argon2id Spring, préfixé `{argon2}`. La configuration utilise 19 MiB, deux passes et un parallélisme de 1. La dépendance d'exécution `bcprov-jdk18on` est fixée à 1.86, version stable vérifiée auprès de [Bouncy Castle](https://www.bouncycastle.org/download/bouncy-castle-java/), car elle n'est pas gérée par le BOM Boot utilisé. [Spring documente cette dépendance pour son encodeur Argon2](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html).

Un compte inconnu, désactivé, sans rôle ou avec un mauvais mot de passe ne peut pas être authentifié par cette couche. Le principal conserve l'identifiant interne et le nom affiché ; Spring efface ses credentials après authentification. Le modèle masque son empreinte dans `toString()`. Cela ne remplace pas les futurs DTO de réponse et les contrôles de propriété sur chaque route.

La recherche SQL réelle, les sessions JDBC, la limitation des essais, la politique de création des mots de passe et la révocation restent à implémenter ou à vérifier. Le parcours HTTP et CSRF est présenté dans la section suivante. Aucun compte de démonstration n'a été ajouté.

Vérification de cette couche le 6 novembre 2026 : compilation Java 21 et vingt tests ciblés réussis, dont treize pour les comptes, l'encodeur et l'activation de configuration, plus les sept tests MVC existants. Ils couvrent notamment le mauvais mot de passe, le compte inconnu ou désactivé, l'absence de rôle, une panne de stockage, l'effacement des credentials et le refus d'un format de mot de passe en clair. Les tests utilisent un stockage simulé et n'accèdent pas à PostgreSQL.

## Parcours HTTP préparé

Les endpoints suivants existent dans le profil `auth` : `GET /api/auth/csrf`, `POST /api/auth/login`, `GET /api/auth/me` et `POST /api/auth/logout`. Login et logout sont gérés par les filtres Spring, sans contrôleur qui vérifierait lui-même les mots de passe. Le login accepte `email` et `password` au format formulaire ; ses succès et erreurs sont en JSON.

Le flux CSRF décrit plus haut est appliqué, y compris sur login et logout. La connexion renouvelle l'identifiant d'une session existante et invalide l'ancien jeton CSRF. Le frontend doit récupérer un nouveau jeton après connexion. Logout invalide la session et demande la suppression du cookie `PARKING_SESSION`.

La réponse login/me contient uniquement `userId` sous forme de chaîne, `displayName` et `roles`. L'identité provient du principal serveur, sans confiance dans les en-têtes d'identité du navigateur. Les erreurs de mot de passe, compte absent ou désactivé ont le même code `INVALID_CREDENTIALS` et le même message. Une panne de stockage renvoie `503 AUTHENTICATION_UNAVAILABLE` ; une session absente renvoie `401 AUTHENTICATION_REQUIRED` ; un refus CSRF renvoie `403 CSRF_INVALID`.

`AuthWebSecurityConfiguration` refuse par défaut les autres routes. La connexion ne donne donc pas encore accès à la liste générale des réservations. HTTP Basic est désactivé dans ce profil et aucune redirection vers une page HTML de connexion n'est utilisée.

`application-auth.properties` limite l'écoute à loopback et prépare un cookie `HttpOnly`, `Secure`, `SameSite=Lax`, sans identifiant de session dans les URL, avec un délai d'inactivité de 30 minutes. `Secure` exige HTTPS pour une utilisation normale dans le navigateur. Aucun serveur HTTPS ni exception HTTP locale n'a été configuré dans cette étape ; ne pas désactiver ce réglage pour contourner un test.

Les sessions HTTP restent actuellement en mémoire. La persistance JDBC, l'expiration absolue de 8 heures, la révocation après changement des droits et la limitation des essais ne sont pas encore implémentées. Les flags réels du cookie, le navigateur, le proxy et le stockage PostgreSQL n'ont pas été vérifiés par MockMvc.

Résultat du 6 novembre 2026 : compilation Java 21 et 34 tests ciblés réussis, dont 14 nouveaux tests HTTP. Ils couvrent notamment la rotation de session, les jetons CSRF absents/invalides/d'une autre session, le refus de l'ancien jeton après login, la déconnexion, les erreurs génériques et le maintien du blocage des réservations. Les 20 tests ciblés précédents passent également. Aucun accès à PostgreSQL ni application de SQL dans cette vérification.

Sources : [connexion Spring Security](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/form.html), [CSRF Spring Security](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html), [déconnexion Spring Security](https://docs.spring.io/spring-security/reference/servlet/authentication/logout.html), [protection contre la fixation de session](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html).
