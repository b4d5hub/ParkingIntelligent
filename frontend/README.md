# Parking Intelligent - Frontend Web

Interface utilisateur moderne, accessible et modulaire pour le système de Parking Intelligent, développée en JavaScript Vanilla pur avec modules ES standard, sans framework, sans bundler et sans étape de compilation npm.

---

## 1. Structure du Projet

```text
frontend/
├── index.html          # Coquille HTML5 sémantique minimale
├── styles.css          # Point d'entrée CSS unifié
├── css/
│   ├── base.css        # Variables CSS, reset, typographie
│   ├── layout.css      # Topbar, navigation par onglets, grille, pied de page
│   ├── components.css  # Boutons, formulaire, plan du parking, badges, toasts, modales
│   └── pages.css       # Mises en page spécifiques par écran
├── js/
│   ├── main.js         # Bootstrap de l'application, gestion de session et routage
│   ├── api.js          # Client fetch avec gestion CSRF, retry et normalisation des erreurs
│   ├── session.js      # Gestion de l'utilisateur connecté, révision et rôles
│   ├── router.js       # Routeur par hachage (#route) avec contrôle d'accès par rôle
│   ├── data/
│   │   └── plans.js    # Référentiel des formules d'abonnements avec repli transparent
│   ├── ui/
│   │   ├── labels.js   # Référentiel unique des statuts, libellés en français et badges
│   │   ├── formatters.js# Formatage des devises (MAD), dates locales et manipulation DOM
│   │   ├── toast.js    # Notifications temporaires accessibles (aria-live)
│   │   ├── modal.js    # Boîtes de dialogue de confirmation avec piège de focus
│   │   ├── loading.js  # Indicateurs de chargement et spinners
│   │   ├── empty-state.js # Messages explicites pour les listes vides
│   │   └── form.js     # Gestion des boutons d'action et prévention du double clic
│   └── pages/
│       ├── login.js            # Écran de connexion
│       ├── driver-reserve.js   # Réservation de place avec plan interactif et devis
│       ├── driver-history.js   # Historique paginé des réservations et annulation
│       ├── subscriptions.js    # Catalogue et liste des abonnements souscrits
│       ├── agent-operations.js # Gestion des arrivées/départs et occupation
│       ├── admin-places.js     # Gestion des places (ajout, mise hors service)
│       └── admin-tariffs.js    # Consultation et mise à jour du tarif horaire
├── test/               # Tests unitaires natifs Node.js
│   ├── api-errors.test.js
│   ├── formatters.test.js
│   ├── labels.test.js
│   └── plans.test.js
├── Dockerfile          # Image Nginx Alpine servant les fichiers statiques
├── nginx.conf          # Reverse proxy pour les APIs et configuration CSP stricte
├── STYLE.md            # Guide de style graphique et ergonomique
└── TESTING.md          # Guide de recette et de validation manuelle par rôle
```

---

## 2. Principes & Contraintes Techniques

* **Content Security Policy (CSP)** : Politique stricte interdisant tout script en ligne, style en ligne (`style="..."` ou balises `<style>`), et gestionnaires d'événements inline (`onclick=...`). Seuls les fichiers externes servis par l'origine sont autorisés.
* **Sécurité des données & DOM** : Aucune donnée issue du serveur n'est injectée via `innerHTML`. Tout le rendu est construit via `createElement` et `textContent`.
* **Idempotence & CSRF** :
  * Le cookie de session `PARKING_SESSION` est `HttpOnly`.
  * Le jeton CSRF obtenu via `/api/auth/csrf` est conservé en mémoire et injecté dans l'en-tête `X-CSRF-TOKEN` pour toute méthode modificatrice (`POST`, `PUT`, `PATCH`, `DELETE`). En cas d'invalidation, un renouvellement avec réessai automatique est effectué une fois.
  * Les réservations utilisent l'en-tête `Idempotency-Key` avec conservation du jeton lors d'une même tentative de paiement.
* **Accessibilité (A11y)** : Balisage HTML5 sémantique, contraste AA, navigation complète au clavier (Tab, Échap, Entrée), régions ARIA dynamiques (`aria-live="polite"` / `aria-live="assertive"`).

---

## 3. Exécution des Tests Unitaires

Les tests unitaires vérifient les modules purs (libellés, formats, gestion d'erreurs, fallback catalogue) directement avec le moteur de test natif de Node.js, sans aucune dépendance :

```bash
cd frontend
node --test test/*.test.js
```

---

## 4. Déploiement & Démarrage avec Docker

Pour reconstruire et démarrer le conteneur frontend :

```bash
docker compose up -d --build frontend
```

L'application est ensuite accessible sur [http://localhost:8080](http://localhost:8080).
