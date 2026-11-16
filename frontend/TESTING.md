# Guide de Recette et Validation Manuelle

Ce document détaille les scénarios de test manuel pour vérifier chaque parcours utilisateur et chaque rôle sur l'application Parking Intelligent.

---

## Comptes de Test Pré-configurés
* Mot de passe unique pour tous les comptes : `Parking2026!Passphrase`
* **Conducteur** : `driver@parking.local`
* **Agent de parking** : `agent@parking.local`
* **Administrateur** : `admin@parking.local`
* **Super Utilisateur (Multirôles)** : `super@parking.local`

---

## 1. Scénario Conducteur (`driver@parking.local`)

1. **Connexion & Onglets visibles** :
   * Saisir l'adresse e-mail et le mot de passe sur la page d'accueil.
   * Constater l'apparition de l'identité en haut à droite avec le nom d'affichage.
   * Vérifier que seuls les 3 onglets conducteur sont affichés :
     * `Réserver une place`
     * `Mes réservations`
     * `Abonnements`

2. **Réserver une place (`#reserve`)** :
   * Vérifier l'affichage du plan du parking avec les places et leur état (Libre, Occupée, Hors service).
   * Cliquer sur une place disponible : elle prend l'état "Sélectionnée" (fond menthe).
   * Tester les boutons de durée rapide (1h, 2h, 3h, 4h) : la date de fin prévue s'ajuste immédiatement.
   * Cliquer sur "Obtenir le devis" : le montant estimé s'affiche en MAD (ex. 20,00 MAD).
   * Cliquer sur "Réserver et payer (simulation)" : la notification de confirmation s'affiche, et l'application redirige automatiquement vers l'onglet "Mes réservations".

3. **Consulter et annuler une réservation (`#history`)** :
   * Vérifier que la réservation nouvellement créée apparaît dans la section "À venir et en cours" avec le badge vert "Confirmée".
   * Vérifier les montants affichés (estimation et créneau payé).
   * Cliquer sur "Annuler la réservation" :
     * La boîte de dialogue modale de confirmation s'ouvre.
     * Appuyer sur Échap : la modale se ferme sans annuler.
     * Réouvrir et confirmer l'annulation : la réservation passe sous "Passées et annulées" avec le badge neutre "Annulée" et la mention "Paiement conservé, sans remboursement".

4. **Souscrire un abonnement (`#subscriptions`)** :
   * Cliquer sur l'onglet "Abonnements".
   * Vérifier la présence des 4 formules : Journalier (40 DH), Hebdomadaire (180 DH), Mensuel (450 DH, formule mise en avant), Annuel (4800 DH).
   * Cliquer sur "Souscrire" sur l'une des formules.
   * Confirmer la souscription dans la modale.
   * Vérifier que le nouvel abonnement s'ajoute immédiatement dans la liste "Mes abonnements" avec le badge "En attente de paiement" et le message d'information associé.

---

## 2. Scénario Agent de Parking (`agent@parking.local`)

1. **Connexion & Navigation** :
   * Se connecter avec `agent@parking.local`.
   * Vérifier que seul l'onglet "Arrivées et départs" est présent.

2. **Opérations & Plan d'occupation (`#operations`)** :
   * Vérifier les filtres de période (par défaut aujourd'hui jusqu'à demain).
   * Consulter le plan d'occupation : les places occupées et les arrivées attendues sont mises en évidence.
   * Cliquer sur une place du plan associée à une réservation : l'écran fait défiler la page jusqu'à la carte de réservation correspondante.
   * **Enregistrer une arrivée** :
     * Sur une réservation "Confirmée", cliquer sur "Enregistrer l’arrivée".
     * L'état passe immédiatement à "En cours", la place devient occupée sur le plan.
   * **Enregistrer un départ** :
     * Sur la réservation "En cours", cliquer sur "Enregistrer le départ".
     * Confirmer dans la modale.
     * Le statut passe à "Terminée", la place est libérée sur le plan, et le montant final calculé s'affiche clairement.

---

## 3. Scénario Administrateur (`admin@parking.local`)

1. **Connexion & Navigation** :
   * Se connecter avec `admin@parking.local`.
   * Vérifier que seuls les 2 onglets administrateur sont affichés :
     * `Places`
     * `Tarifs`

2. **Gestion des places (`#admin-places`)** :
   * Consulter la liste des places enregistrées avec leur numéro et statut ("En service", "Hors service", "Occupée").
   * **Ajout d'une place** :
     * Saisir un numéro unique (ex. `B-201`) dans le formulaire et valider.
     * La place s'ajoute immédiatement à la liste.
   * **Mise hors service / Remise en service** :
     * Cliquer sur "Mettre hors service" sur une place libre.
     * Son badge devient "Hors service" et le bouton devient "Remettre en service".
     * Cliquer sur "Remettre en service" : elle redevient libre.
     * Si une place est occupée ou réservée, le bouton affiche son état et empêche la mise hors service.

3. **Gestion des tarifs horaires (`#admin-tariffs`)** :
   * Vérifier l'affichage du tarif horaire actuel (ex. `10,00 MAD / h`).
   * Saisir un nouveau tarif strictement positif (ex. `15.00`) et valider.
   * Un toast de succès confirme la mise à jour et le tarif affiché passe immédiatement à `15,00 MAD / h`.
   * Tenter de saisir `0` ou un nombre négatif : le formulaire bloque la saisie.

---

## 4. Scénario Multirôles (`super@parking.local`)

1. **Connexion** :
   * Se connecter avec `super@parking.local`.
2. **Accès global** :
   * Vérifier que **tous les onglets** sont visibles et accessibles simultanément :
     * `Réserver une place`
     * `Mes réservations`
     * `Abonnements`
     * `Arrivées et départs`
     * `Places`
     * `Tarifs`
3. **Parcours croisé** :
   * Modifier le tarif dans "Tarifs" (ex. passer à `20,00 MAD / h`).
   * Basculer sur "Réserver une place" et demander un devis pour 2 heures : constater que le devis reflète immédiatement le nouveau tarif de 20 DH/h (ex. 40 DH).

---

## 5. Tests d'Accessibilité et Responsive

* **Largeur mobile 360px** :
  * Réduire la fenêtre du navigateur à 360px de largeur.
  * Vérifier que la grille du parking reste défilable verticalement sans casser la mise en page.
  * Vérifier que les onglets de navigation s'enroulent proprement sans déborder.
  * Vérifier la lisibilité des textes et l'accessibilité tactile des boutons (hauteur min 42px).
* **Navigation au clavier** :
  * Naviguer exclusivement avec la touche Tab.
  * Vérifier que le contour de focus vert (`outline: 3px solid #398250`) est visible sur chaque bouton, lien et champ de formulaire.
  * Vérifier que la touche Échap ferme systématiquement les fenêtres modales.
