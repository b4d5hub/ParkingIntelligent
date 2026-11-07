-- Appliquer apres 003_reservation_workflow.sql, sans modifier les paiements historiques.
BEGIN;
ALTER TABLE reservations
    ADD COLUMN booking_paid NUMERIC(10,2),
    ADD COLUMN extra_paid NUMERIC(10,2),
    ADD COLUMN extra_payment_reference VARCHAR(100),
    ADD CONSTRAINT reservation_prepaid_valid CHECK (
        (booking_paid IS NULL OR booking_paid >= 0) AND
        (extra_paid IS NULL OR extra_paid >= 0));
COMMIT;
