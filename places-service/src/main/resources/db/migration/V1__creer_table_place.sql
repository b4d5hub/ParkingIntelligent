CREATE TABLE place (
    id      BIGSERIAL PRIMARY KEY,
    numero  VARCHAR(20) NOT NULL UNIQUE,
    statut  VARCHAR(20) NOT NULL DEFAULT 'LIBRE',
    CONSTRAINT place_statut_valide
        CHECK (statut IN ('LIBRE', 'OCCUPEE', 'RESERVEE', 'HORS_SERVICE'))
);