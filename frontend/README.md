# Frontend Parking Intelligent

Le frontend migre progressivement vers Angular avec Tailwind CSS. Angular gère l'écran de connexion et tous les écrans administrateur (tableau de bord, places, tarifs, abonnements, réservations et utilisateurs). Les écrans conducteur et agent restent montés depuis l'interface JavaScript historique pendant leur conversion.

Les composants Angular sont classés par fonctionnalité dans `src/app/` : `auth/` pour la connexion, `admin/` pour chaque écran d'administration et `app.component.ts` pour la coquille commune. Les utilitaires Tailwind sont compilés dans `src/tailwind.css`. Le CSS existant reste utilisé par les pages conducteur et agent ; Tailwind n'applique pas son reset global.

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
