BEGIN;
SET LOCAL search_path TO public;

-- Initialisation automatique des comptes de test pour l'environnement local.
-- Mot de passe commun : Parking2026!Passphrase
-- Empreinte Argon2id générée avec les paramètres Spring Security du projet :
-- {argon2}$argon2id$v=19$m=19456,t=2,p=1$KvPK/uS9+8tzi7p1h7dpMA$tUIeeo3Ebk5AMTb9JtAR2iAwF68XhWIO/jkQRhF0DNo

INSERT INTO parking_auth_users (id, email, display_name, password_hash, enabled)
VALUES
    (1, 'admin@parking.local', 'Administrateur', '{argon2}$argon2id$v=19$m=19456,t=2,p=1$KvPK/uS9+8tzi7p1h7dpMA$tUIeeo3Ebk5AMTb9JtAR2iAwF68XhWIO/jkQRhF0DNo', true),
    (2, 'driver@parking.local', 'Conducteur Test', '{argon2}$argon2id$v=19$m=19456,t=2,p=1$KvPK/uS9+8tzi7p1h7dpMA$tUIeeo3Ebk5AMTb9JtAR2iAwF68XhWIO/jkQRhF0DNo', true),
    (3, 'agent@parking.local', 'Agent Test', '{argon2}$argon2id$v=19$m=19456,t=2,p=1$KvPK/uS9+8tzi7p1h7dpMA$tUIeeo3Ebk5AMTb9JtAR2iAwF68XhWIO/jkQRhF0DNo', true),
    (4, 'super@parking.local', 'Super Utilisateur', '{argon2}$argon2id$v=19$m=19456,t=2,p=1$KvPK/uS9+8tzi7p1h7dpMA$tUIeeo3Ebk5AMTb9JtAR2iAwF68XhWIO/jkQRhF0DNo', true)
ON CONFLICT (lower(email)) DO NOTHING;

SELECT setval(pg_get_serial_sequence('parking_auth_users', 'id'), coalesce((SELECT max(id) FROM parking_auth_users), 1));

INSERT INTO parking_auth_user_roles (user_id, role)
VALUES
    (1, 'ADMIN'),
    (2, 'CONDUCTEUR'),
    (3, 'AGENT'),
    (4, 'CONDUCTEUR'),
    (4, 'AGENT'),
    (4, 'ADMIN')
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
