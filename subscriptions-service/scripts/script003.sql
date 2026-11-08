-- Ajoute les tarifs de départ du prototype sans écraser les valeurs existantes.
BEGIN;
SET LOCAL search_path TO public;

INSERT INTO subscription_prices (period, price, currency) VALUES
    ('DAILY', 40.00, 'MAD'),
    ('WEEKLY', 180.00, 'MAD'),
    ('MONTHLY', 450.00, 'MAD'),
    ('ANNUAL', 4800.00, 'MAD')
ON CONFLICT (period) DO NOTHING;

COMMIT;
