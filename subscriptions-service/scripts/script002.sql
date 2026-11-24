-- Crée le catalogue des prix des formules Abonnements.
BEGIN;
SET LOCAL search_path TO public;

CREATE TABLE subscription_prices (
    period VARCHAR(16) PRIMARY KEY,
    price NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscription_prices_period_valid
        CHECK (period IN ('DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL')),
    CONSTRAINT subscription_prices_amount_valid CHECK (price >= 0),
    CONSTRAINT subscription_prices_currency_valid CHECK (currency ~ '^[A-Z]{3}$')
);

COMMIT;
