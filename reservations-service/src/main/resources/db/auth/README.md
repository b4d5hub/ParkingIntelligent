# Schéma d'authentification

`001_accounts.sql` crée les comptes et les rôles. `002_sessions.sql` reprend le schéma PostgreSQL de Spring Session JDBC 4.1.1, avec une enveloppe transactionnelle. Les tables sont dans `public`.

Les scripts ont été exécutés avec succès dans une base de test temporaire. Ils n'ont pas été appliqués à `parking-db`. Aucun compte initial ni mot de passe n'est inclus.

Sur une base existante, vérifier les tables et sauvegarder avant application. Exécuter chaque script une fois seulement. L'absence de `IF NOT EXISTS` permet de détecter un conflit de structure. Ne jamais supprimer les données ou volumes pour résoudre ce conflit.

Spring ne crée aucune table automatiquement. Le profil `auth` active explicitement `@EnableJdbcHttpSession` et nécessite les deux scripts. Hibernate reste en `ddl-auto=validate` pour les entités de réservation. Les comptes et sessions utilisent JDBC.

Compose monte ces scripts dans l'initialisation PostgreSQL pour une installation neuve seulement. Une base déjà initialisée ne rejoue pas ce dossier : appliquer les migrations manuellement, sans recréer son volume.

Le lien entre l'identité commune et les données des autres modules doit être confirmé avec l'équipe. Aucun FK vers les tables d'Abonnements/Places n'est inventé. Les clients machines sont configurés hors Git ; ils n'ont pas besoin d'une table supplémentaire.

Voir [AUTHENTICATION.md](../../../../../../AUTHENTICATION.md) pour la connexion, CSRF, la validation interne, les durées de session et le provisionnement local. Voir [RESERVATIONS.md](../../../../../../RESERVATIONS.md) pour l'exécution et les tests.
