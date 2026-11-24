# Guide de Recette et Validation Manuelle

Ce document détaille les scénarios de test manuel pour vérifier chaque parcours utilisateur et chaque rôle sur l'application Parking Intelligent.

## Tests E2E Cypress

Les tests Cypress utilisent l'application réellement démarrée sur `http://127.0.0.1:8080` et le compte conducteur de démonstration. Depuis la racine du dépôt, démarre l'application puis, dans un autre terminal :

```sh
cd frontend
npm ci
read -rsp "Mot de passe conducteur : " CYPRESS_TEST_PASSWORD; export CYPRESS_TEST_PASSWORD; echo
npm run e2e
```

Le mot de passe reste dans l'environnement du terminal et n'est pas enregistré dans le dépôt. Pour ouvrir l'interface Cypress et exécuter les tests en mode interactif, remplace `npm run e2e` par `npm run e2e:open`. Le serveur doit être démarré avant de lancer Cypress. Le parcours Conducteur vérifie une connexion réelle contre l'API. Les scénarios Agent, Administrateur et multirôles simulent la réponse de connexion pour vérifier séparément la navigation et les pages autorisées sans ajouter de dépendance aux données du serveur. Une capture PNG est enregistrée après chaque test réussi dans `cypress/screenshots/`; les anciennes captures sont conservées entre les exécutions.

---

## Comptes de Test Pré-configurés
Le mot de passe de test doit être fourni dans `CYPRESS_TEST_PASSWORD` au lancement des tests. Les identifiants ci-dessous sont des comptes de démonstration locaux ; remplace leurs mots de passe avant tout déploiement partagé.
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
   * Vérifier que les **6 onglets administrateur** sont affichés et que l'utilisateur est redirigé par défaut vers le tableau de bord :
     * `Tableau de bord` (`#admin-dashboard`)
     * `Places` (`#admin-places`)
     * `Tarifs` (`#admin-tariffs`)
     * `Abonnements` (`#admin-subscriptions`)
     * `Réservations` (`#admin-reservations`)
     * `Utilisateurs` (`#admin-users`)
   * Vérifier qu'aucun onglet conducteur ou agent n'apparaît.

2. **Tableau de bord (`#admin-dashboard`)** :
   * Consulter les 4 cartes métriques :
     * **Places du parking** : nombre total, taux d'occupation calculé, barre de répartition pure CSS (vert pour libre, bleu pour réservée, ambre pour occupée, rouge pour hors service) et détails par statut.
     * **Chiffre d'affaires** : montant total perçu en MAD sur la période (somme `booking_paid + extra_paid`), nombre de réservations terminées et durée moyenne de stationnement.
     * **Réservations** : volume total sur la période sélectionnée avec barre CSS de répartition par statut (terminées, en cours, confirmées, annulées, expirées).
     * **Abonnements** : nombre d'abonnements actifs, total souscrit et barre CSS d'état (actifs, en attente, expirés, annulés).
   * Changer le filtre de période ("7 derniers jours", "Aujourd'hui", "Tout l'historique", ou "Personnalisée") et cliquer sur "Actualiser les données" : les métriques s'actualisent sans recharger la page.

3. **Gestion des places (`#admin-places`)** :
   * Consulter la liste des places enregistrées avec leur numéro et statut ("En service", "Hors service", "Occupée").
   * **Ajout d'une place** :
     * Saisir un numéro unique (ex. `B-201`) dans le formulaire et valider.
     * La place s'ajoute immédiatement à la liste.
   * **Mise hors service / Remise en service** :
     * Cliquer sur "Mettre hors service" sur une place libre : le statut passe à "Hors service".
     * Cliquer sur "Remettre en service" : elle redevient disponible.

4. **Gestion des tarifs horaires et historique (`#admin-tariffs`)** :
   * Vérifier l'affichage du tarif horaire actuel en vigueur (ex. `10,00 MAD / h`).
   * **Modification du tarif** :
     * Saisir un nouveau montant positif (ex. `12.50`) et valider.
     * Un toast confirme la modification et le tarif courant s'actualise.
   * **Historique des tarifs** :
     * Sous le formulaire, consulter la table paginée de l'historique des tarifs (colonnes : Tarif, Valable à partir du, Auteur, Enregistré le).
     * Vérifier que la modification effectuée apparaît en tête de liste (tri antéchronologique).
     * Tester la pagination (boutons "← Précédent" / "Suivant →").

5. **Gestion des formules et abonnements (`#admin-subscriptions`)** :
   * **Formules d'abonnement** :
     * Consulter les 4 formules tarifaires (Journalier, Hebdomadaire, Mensuel, Annuel).
     * Pour une formule (ex. Journalier), ajuster le tarif ou basculer la case "Formule active" et cliquer sur "Enregistrer".
     * Vérifier le toast de confirmation de mise à jour.
   * **Souscriptions conducteurs** :
     * Consulter la table des souscriptions conducteurs (colonnes : ID / Référence, Utilisateur, Formule, Statut avec badge, Début, Fin, Montant).
     * Filtrer par statut via le menu déroulant (Tous, Actifs, En attente de paiement, Expirés, Annulés) : la table se recharge instantanément.
     * Tester la pagination de la liste.

6. **Consultation et filtres des réservations (`#admin-reservations`)** :
   * Consulter l'ensemble des réservations du système sous forme de table (colonnes : ID, Conducteur, Place, Début prévu, Fin prévue, Statut avec badge de `labels.js`, Arrivée réelle, Départ réel, Montant).
   * **Filtres multicritères** :
     * Filtrer par statut (ex. "CONFIRMED" ou "COMPLETED").
     * Filtrer par dates "Du" et "Au". Vérifier que si la date "Du" est postérieure à la date "Au", un message d'erreur est affiché.
     * Filtrer par identifiant de place ou de conducteur.
     * Cliquer sur "Appliquer les filtres" puis tester le bouton "Réinitialiser".
   * Tester la pagination des réservations.

7. **Gestion des utilisateurs (`#admin-users`)** :
   * **Consultation et recherche** :
     * Consulter la liste des comptes avec colonnes : Utilisateur (Nom + Email), Rôles (badges colorés), Statut (Actif en vert / Désactivé en neutre), Créé le, Actions.
     * Tester la recherche textuelle (par nom ou e-mail) et la pagination.
   * **Création d'un utilisateur ("+ Nouvel utilisateur")** :
     * Cliquer sur "+ Nouvel utilisateur" : la fenêtre modale accessible s'ouvre.
     * Renseigner l'adresse e-mail, le nom d'affichage, un mot de passe d'au moins 12 caractères et cocher au moins un rôle (`Conducteur`, `Agent`, `Administrateur`).
     * Valider : l'utilisateur est créé activé et apparaît dans la liste.
     * Tester la connexion avec le compte nouvellement créé pour confirmer son bon fonctionnement.
   * **Activation / Désactivation d'un utilisateur** :
     * Sur un compte tiers, cliquer sur "Désactiver" : une modale de confirmation demande confirmation.
     * Confirmer : le badge de statut passe immédiatement à "Désactivé".
     * Vérifier que si cet utilisateur avait une session ouverte, sa prochaine requête est rejetée en 401 et il est déconnecté.
     * Cliquer sur "Activer" : le compte redevient "Actif".
   * **Modification des rôles** :
     * Cliquer sur "Rôles" pour un utilisateur : la modale permet d'ajouter ou retirer des rôles avec cases à cocher.
     * Valider : les rôles s'actualisent immédiatement.
   * **Réinitialisation du mot de passe** :
     * Cliquer sur "Mot de passe" : saisir un nouveau mot de passe d'au moins 12 caractères et valider.
   * **Protection du propre compte administrateur** :
     * Sur la ligne de l'administrateur actuellement connecté (`admin@parking.local`), vérifier que les boutons "Désactiver" et "Rôles" sont désactivés avec infobulle explicative.
     * Tenter une action interdite via l'API : l'application capture le retour 409 et affiche explicitement le message d'erreur du backend en français.

---

## 4. Scénario Multirôles (`super@parking.local`)

1. **Connexion** :
   * Se connecter avec `super@parking.local`.
2. **Accès global** :
   * Vérifier que **tous les onglets** de l'ensemble des rôles sont visibles et accessibles simultanément :
     * *Espace Conducteur* : `Réserver une place`, `Mes réservations`, `Abonnements`
     * *Espace Agent* : `Arrivées et départs`
     * *Espace Administrateur* : `Tableau de bord`, `Places`, `Tarifs`, `Abonnements`, `Réservations`, `Utilisateurs`
3. **Parcours croisé** :
   * Modifier le tarif horaire dans "Tarifs" (ex. passer à `20,00 MAD / h`).
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
