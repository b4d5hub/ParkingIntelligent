# Dossier de Tests — Module Tarifs (Amine Nekhla)

Date de vérification : 12 novembre 2026.
Projet : Parking intelligent — Système de gestion de stationnement.

---

## 1. Synthèse globale des tests

| Catégorie | Classe de test | Tests exécutés | Succès | Échecs | Ignorés | Dépendance externe |
|-----------|----------------|----------------|--------|--------|---------|-------------------|
| **Unitaires purs** | `TarifServiceTest` | 19 | 19 | 0 | 0 | Aucune (classe pure) |
| **Unitaires persistance** | `JpaTarifRepositoryTest` | 3 | 3 | 0 | 0 | Aucune (mock JPA) |
| **Couche Web (MockMvc)** | `HourlyRateControllerTest` | 9 | 9 | 0 | 0 | Aucune (mocks auth) |
| **Couche Web (MockMvc)** | `InternalTarifsControllerTest` | 11 | 11 | 0 | 0 | Aucune (mocks partenaires) |
| **Intégration PostgreSQL** | `TarifPostgresTests` | 3 | 0 | 0 | 3 (activés via script) | Docker PostgreSQL temporaire |
| **Total** | | **45** | **42** | **0** | **3** | |

---

## 2. Détail des tests unitaires (Exécution `mvn test`)

### 2.1 Calculs métier purs (`TarifServiceTest` — 19 tests)
- `dureeNulle_retourneMontantZero` : Durée 0 minute -> 0,00 DH.
- `dureeUneHeure_retourneTarifHoraire` : 1 heure à 10 DH/h sans réduction -> 10,00 DH.
- `dureeDeuxHeuresTrente_retourneMontantProportionnel` : 2h30 à 10 DH/h -> 25,00 DH.
- `dureeUneMinute_arrondiCorrect` : 1 minute à 10 DH/h -> 0,17 DH.
- `reductionCinquantePourcent_appliqueReduction` : 1 heure avec 50% de réduction -> 5,00 DH.
- `reductionCentPourcent_retourneMontantZero` : Réduction 100% -> 0,00 DH.
- `reductionZeroPourcent_tarifPlein` : Réduction 0% -> tarif plein.
- `reductionNegative_leveIllegalArgumentException` : Réduction négative -> rejet 400.
- `reductionSuperieureACent_leveIllegalArgumentException` : Réduction > 100% -> rejet 400.
- `finAvantDebut_leveIllegalArgumentException` : Inversion des dates -> rejet 400.
- `dateDebutNulle_leveIllegalArgumentException` : Date de début nulle -> rejet 400.
- `dateFinNulle_leveIllegalArgumentException` : Date de fin nulle -> rejet 400.
- `modifierTarifHoraire_prixValide_miseAJourEffective` : Modification par admin valide -> prise en compte.
- `modifierTarifHoraire_prixNegatif_leveIllegalArgumentException` : Prix négatif -> rejet.
- `modifierTarifHoraire_prixZero_leveIllegalArgumentException` : Prix nul -> rejet.
- `montantEstimeEtMontantFinal_memeDureeMemeReduction_memeResultat` : Cohérence entre devis et final.
- `modifierTarifHoraire_creeParInvalide_leveIllegalArgumentException` : Auteur nul ou vide -> rejet.
- `montantEstime_offsetsDifferents_calculeDureeReelleCorrectement` : Décalages horaires différents (ex. UTC+1 vers UTC+2) -> calcul sur la durée réelle.
- `deuxMinutes_dixDhZeroCinq_arrondiSansPerte` : Régression précision intermédiaire (2 min à 10.05 DH/h -> 0.34 DH).

### 2.2 Persistance découplée (`JpaTarifRepositoryTest` — 3 tests)
- `lireTarifCourant_tableVide_leveTarifManquantException` : Vérifie l'absence de repli silencieux vers 10.00 DH lorsque la table est vide -> `TarifManquantException`.
- `lireTarifCourant_tarifPresent_retournePrix` : Lecture du tarif actif le plus récent.
- `enregistrerNouveauTarif_persisteAvecAuteur` : Insertion d'un nouveau tarif avec enregistrement de l'auteur (`cree_par`), de la date de création (`cree_le`) et de la date de validité (`valable_a_partir`).

### 2.3 Contrôleur REST Utilisateur (`HourlyRateControllerTest` — 9 tests)
- `get_sansCookieSession_retourne401` : Accès sans cookie `PARKING_SESSION` rejeté (401 `AUTHENTICATION_REQUIRED`).
- `get_sessionExpireParAuthService_retourne401` : Session expirée auprès de Réservations rejetée (401 `AUTHENTICATION_REQUIRED`).
- `get_utilisateurConducteurAuthentifie_retourne200` : Conducteur authentifié accède à la consultation (200).
- `get_authServiceIndisponible_retourne503` : Service d'authentification injoignable -> 503 `SERVICE_UNAVAILABLE`.
- `put_utilisateurConducteur_retourne403` : Conducteur tentant de modifier le tarif rejeté (403 `ACCESS_DENIED`).
- `put_csrfInvalide_retourne403` : Admin avec jeton CSRF absent/invalide rejeté (403 `CSRF_INVALID`).
- `put_adminAvecCsrfValide_modifieTarifEtRetourne200` : Admin avec CSRF valide met à jour le tarif et retourne 200.
- `put_prixNul_retourne400SansAppelerLeRepository` : Validation Jakarta sur le corps (`prixDh` nul) -> 400 `INVALID_REQUEST`.
- `put_authServiceIndisponible_retourne503` : Panne de l'authentification lors du PUT -> 503 `SERVICE_UNAVAILABLE`.

### 2.4 Contrôleur REST Interne Machine (`InternalTarifsControllerTest` — 11 tests)
- `estimate_sansBearerToken_retourne401` : Requête machine sans Basic Auth rejetée (401 `SERVICE_AUTHENTICATION_FAILED`).
- `estimate_avecMauvaisSecret_retourne401` : Secret machine erroné rejeté en temps constant (401 `SERVICE_AUTHENTICATION_FAILED`).
- `estimate_avecBonsCredentials_retourne200` : Devis valide retournant montant, devise ISO et référence unique (`devis-XXXXXXXX`).
- `estimate_avecReduction30pourcent_appliqueueLaFormule` : Application exacte de la réduction abonnement (ex. 14,00 DH pour 2h à 10 DH/h avec -30%).
- `estimate_sansDebutPrevu_retourne400` : Champ `debutPrevu` manquant rejeté (400 `INVALID_REQUEST`).
- `estimate_abonnementsIndisponible_retourne503` : Service Abonnements inaccessible -> 503 `SERVICE_UNAVAILABLE` (pas de simulation silencieuse de 0%).
- `estimate_reductionInvalideParAbonnements_retourne502` : Réduction hors bornes [0, 100] reçue d'Abonnements -> 502 `PARTNER_RESPONSE_INVALID`.
- `estimate_dateFinAvantDateDebut_retourne400` : `finPrevue` antérieure à `debutPrevu` -> 400 `INVALID_REQUEST`.
- `finalAmount_sansAuthentification_retourne401` : Appel `/final` sans Basic Auth rejeté (401).
- `finalAmount_avecBonsCredentials_retourne200AvecReference` : Montant final calculé avec référence (`final-XXXXXXXX`).
- `finalAmount_avecDatesPrevuesSeulement_utiliseFallbackEtRetourne200` : Compatibilité avec les appels envoyant les dates dans `debutPrevu`/`finPrevue`.

---

## 3. Tests d'intégration PostgreSQL (`TarifPostgresTests`)

Ces tests utilisent une base PostgreSQL éphémère créée par `scripts/Test-Tarifs.ps1`.
Ils sont ignorés lors des tests unitaires standard grâce à la condition `@EnabledIfEnvironmentVariable(named = "PARKING_INTEGRATION", matches = "true")`.

Vérifications couvertes :
1. Application de la migration idempotente `tarifs.sql` et vérification de la valeur de seed (10.00 DH/h).
2. Insertion d'un nouveau tarif en base PostgreSQL réelle et consultation du nouveau tarif actif.
3. Vérification de l'exclusion des tarifs futurs : un tarif avec `valable_a_partir` dans le futur n'est pas sélectionné pour le tarif courant.
4. Traçabilité complète : présence de `cree_par`, `cree_le` et respect des contraintes de précision décimale `NUMERIC(10,2)`.

---

## 4. Travaux non vérifiés et blocages externes

1. **Intégration réelle avec Abonnements** :
   - Bloqueur : Le module `abonnements-service` n'existe pas encore dans le dépôt (Kamal).
   - Mesure de sécurité : L'implémentation `AbonnementsReductionClient` refuse de simuler de fausses réductions et lève une exception 503 claire.
2. **Décisions métier en attente d'arbitrage** :
   - Facturation exacte à la seconde vs minute entamée vs minute tronquée.
   - Date de référence pour le droit à la réduction abonnement (date de réservation vs date de sortie).
   - Règle de gel de tarif sur devis vs application du tarif en vigueur à la sortie.

