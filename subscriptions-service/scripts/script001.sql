-- Crée la table principale Abonnements.
-- À exécuter après la création de parking_auth_users.
BEGIN;
SET LOCAL search_path TO public;

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES parking_auth_users(id),
    period VARCHAR(16) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING_PAYMENT',
    payment_reference VARCHAR(120),
    expiration_notification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscriptions_period_valid
        CHECK (period IN ('DAILY', 'WEEKLY', 'MONTHLY', 'ANNUAL')),
    CONSTRAINT subscriptions_dates_valid CHECK (ends_at > starts_at),
    CONSTRAINT subscriptions_price_valid CHECK (price >= 0),
    CONSTRAINT subscriptions_currency_valid CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT subscriptions_status_valid
        CHECK (status IN ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT subscriptions_payment_reference_unique UNIQUE (payment_reference)
);

CREATE INDEX subscriptions_user_created_idx ON subscriptions (user_id, created_at DESC);
CREATE INDEX subscriptions_expiration_notice_idx
    ON subscriptions (ends_at) WHERE status = 'ACTIVE' AND expiration_notification_sent_at IS NULL;

COMMIT;
