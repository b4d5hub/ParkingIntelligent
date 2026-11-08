# Service Abonnements

Premier module Nest.js organisé par responsabilités :

- `subscriptions.controller.ts` reçoit les DTO et récupère l'identité de la session.
- `subscriptions.service.ts` porte les règles métier ; les tests unitaires mockent ses repositories.
- `dto/`, `entities/` et `repositories/` isolent respectivement les entrées HTTP, le modèle et l'accès PostgreSQL.
- `helper/` contient uniquement la garde de session, l'horloge et le job d'expiration.
- `scripts/script001.sql` crée la table `subscriptions`.
- `scripts/script002.sql` crée le catalogue `subscription_prices`.
- `scripts/script003.sql` insère les tarifs de départ.

Le tarif est défini côté serveur dans `subscription_prices`. Une période sans tarif actif ne peut pas être souscrite. La grille de prototype proposée est : 40 MAD par jour, 180 MAD par semaine, 450 MAD par mois et 4 800 MAD par an. Ces montants sont des hypothèses pour le prototype et peuvent être changés dans la base. Après avoir créé `parking_auth_users`, exécuter manuellement `script001.sql`, puis `script002.sql`, puis `script003.sql`, chacun une seule fois.

Depuis le terminal à la racine du dépôt, après le démarrage de PostgreSQL, exécuter chaque commande dans l'ordre :

```sh
docker compose -f compose.reservations.yml exec -T db psql -U parking -d parking -v ON_ERROR_STOP=1 < subscriptions-service/scripts/script001.sql
docker compose -f compose.reservations.yml exec -T db psql -U parking -d parking -v ON_ERROR_STOP=1 < subscriptions-service/scripts/script002.sql
docker compose -f compose.reservations.yml exec -T db psql -U parking -d parking -v ON_ERROR_STOP=1 < subscriptions-service/scripts/script003.sql
```

Dans PowerShell, utiliser le pipeline :

```powershell
Get-Content -Raw subscriptions-service/scripts/script001.sql | docker compose -f compose.reservations.yml exec -T db psql -U parking -d parking -v ON_ERROR_STOP=1
Get-Content -Raw subscriptions-service/scripts/script002.sql | docker compose -f compose.reservations.yml exec -T db psql -U parking -d parking -v ON_ERROR_STOP=1
Get-Content -Raw subscriptions-service/scripts/script003.sql | docker compose -f compose.reservations.yml exec -T db psql -U parking -d parking -v ON_ERROR_STOP=1
```

Docker Compose ne monte pas et n'exécute pas ces fichiers SQL automatiquement. `script001.sql` et `script002.sql` créent les tables et ne doivent pas être rejoués après réussite. `script003.sql` peut être rejoué sans écraser un tarif déjà modifié.

Routes présentes : `POST /api/subscriptions` crée un abonnement `PENDING_PAYMENT` à partir du tarif serveur ; `GET /api/subscriptions/me` liste les abonnements du conducteur connecté. Le guard échoue fermé si aucun principal de session n'est fourni et exige le rôle `CONDUCTEUR`. Le raccordement au contrat d'authentification commun doit encore fournir ce principal.

La confirmation de paiement est une méthode de service appelée uniquement après validation d'un paiement par l'adaptateur à venir ; aucun endpoint navigateur ne permet de s'activer soi-même. L'expiration refuse l'accès dès `endsAt` et la liste du conducteur met à jour les statuts échus. Un job horaire UTC expire aussi les abonnements échus et consigne la notification sept jours avant la fin. Il réserve l'envoi avec une mise à jour SQL atomique afin que plusieurs exécutions ne produisent pas de doublon. L'envoi effectif par courriel et le raccordement au fournisseur de paiement restent à faire.

## Développement et tests

Prérequis : Node.js 20.19+ (ou 22.12+ sur la ligne 22), npm. Depuis ce dossier :

```sh
npm install
npm test
npm run build
```

Les tests sont isolés dans `test/` et ne contiennent que des mocks, des appels au service et des assertions. Ils couvrent les quatre périodes, le tarif serveur, le paiement idempotent, les limites d'accès, l'expiration et les notifications. Ils ne couvrent pas encore PostgreSQL réel, l'authentification HTTP ni l'intégration du fournisseur de paiement. Le détail des scénarios et des résultats est dans [TESTS.md](TESTS.md).
