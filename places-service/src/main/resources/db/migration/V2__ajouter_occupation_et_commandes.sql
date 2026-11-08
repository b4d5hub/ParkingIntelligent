-- Réservation qui occupe actuellement la place (NULL si personne)
ALTER TABLE place ADD COLUMN reservation_id BIGINT;

-- Commandes déjà traitées, pour que les rappels de Réservations soient sans effet
CREATE TABLE place_command (
    idempotency_key VARCHAR(100) PRIMARY KEY,
    place_id        BIGINT      NOT NULL REFERENCES place(id),
    operation       VARCHAR(10) NOT NULL CHECK (operation IN ('OCCUPY', 'RELEASE')),
    reservation_id  BIGINT      NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);