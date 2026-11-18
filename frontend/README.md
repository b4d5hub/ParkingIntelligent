# Frontend Parking Intelligent

Le frontend utilise Angular avec Tailwind CSS pour l'écran de connexion et tous les espaces : administrateur (tableau de bord, places, tarifs, abonnements, réservations et utilisateurs), conducteur (réservation, historique et abonnements) et agent (arrivées et départs).

Les composants Angular sont classés par fonctionnalité dans `src/app/` : `auth/` pour la connexion, `admin/` pour l'administration, `driver/` pour les parcours conducteur, `agent/` pour les opérations et `app.component.ts` pour la coquille commune. Les utilitaires Tailwind sont compilés dans `src/tailwind.css`. Le CSS historique est conservé dans une couche de compatibilité pour les styles partagés.

Le tableau de bord admin présente les revenus, l’occupation, les réservations et la durée moyenne, avec des graphiques de répartition basés sur les statuts renvoyés par les services.

## Démarrage avec Docker

Depuis la racine du dépôt :

```sh
docker compose up --build -d frontend
```

L'application est accessible sur [http://127.0.0.1:8080](http://127.0.0.1:8080). La construction Angular et Node se fait dans l'étape de build Docker ; aucun Node.js n'est nécessaire pour simplement démarrer l'application.

## Développement Angular

Dans ce dossier, installer les dépendances avec `npm ci`, puis lancer `npm run build`. Les dépendances sont verrouillées dans `package-lock.json`. Le client API existant conserve la gestion des cookies de session, du jeton CSRF et des erreurs tant que les pages Angular dédiées ne l'ont pas remplacé.

Les tests historiques des modules JavaScript peuvent être lancés avec `npm test`.

## Accessibilité et sécurité

Conserver le HTML sémantique et les annonces accessibles. Les appels API restent sur la même origine via Nginx ; ne pas déplacer les secrets ou les règles d'autorisation dans le navigateur. Les données serveur doivent être affichées par interpolation Angular échappée ou via le DOM sécurisé, sans `innerHTML` non fiable.
