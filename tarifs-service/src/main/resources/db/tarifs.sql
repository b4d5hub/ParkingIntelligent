-- Migration : table de l'historique des tarifs horaires
-- Module Tarifs — Amine Nekhla
-- À appliquer UNE SEULE FOIS sur la base commune PostgreSQL.
-- Ne jamais réexécuter sur une base contenant déjà la table.

CREATE TABLE IF NOT EXISTS tarif_horaire (
    id               BIGSERIAL     PRIMARY KEY,
    prix_dh          NUMERIC(10,2) NOT NULL CHECK (prix_dh > 0),
    valable_a_partir TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cree_par         TEXT          NOT NULL,
    cree_le          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Tarif initial de 10,00 DH/h inséré uniquement si la table est vide
-- (WHERE NOT EXISTS assure l'idempotence sans ON CONFLICT)
INSERT INTO tarif_horaire (prix_dh, valable_a_partir, cree_par)
SELECT 10.00, now(), 'init'
WHERE NOT EXISTS (SELECT 1 FROM tarif_horaire);
