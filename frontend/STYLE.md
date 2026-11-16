# Guide de Style - Frontend Parking Intelligent

Ce document définit les règles graphiques et ergonomiques appliquées à l'interface du Parking Intelligent. L'objectif est de préserver une identité visuelle soignée, sobre et contrastée (palette minérale chaude, typographie lisible, micro-interactions soignées) tout en assurant une accessibilité irréprochable (WCAG AA).

---

## 1. Palette de Couleurs

### Couleurs de base
* **Fond général** : `#f2f1ed` (`--bg`) - Gris chaud minéral
* **Surface de carte** : `#fcfbf8` (`--surface`) - Blanc cassé chaleureux
* **Texte principal (Ink)** : `#242625` (`--ink`) - Anthracite profond
* **Texte secondaire (Muted)** : `#5b615d` (`--muted`) - Gris moyen lisible
* **Bordures & Séparateurs** : `#dad9d1` (`--line`) - Trait subtil
* **Sélection de texte** : Fond `#9cddad`, texte `#242625`

### Accentuation & États
* **Vert Action / Succès** :
  * Accent foncé : `#398250` (`--accent-green`)
  * Fond badge succès : `#dfeddf` (`--badge-green-bg`)
  * Texte badge succès : `#173321` (`--badge-green-text`)
* **Menthe (Sélection / Marqueur)** :
  * Couleur menthe : `#9cddad` (`--mint`)
  * Texte sur menthe : `#173321`
* **Ambre (Attente / En cours / Moyen)** :
  * Ambre vif : `#f4c578` (`--amber`)
  * Fond badge ambre : `#f8e4bd` (`--badge-amber-bg`)
  * Texte badge ambre : `#322313` (`--badge-amber-text`)
* **Gris Neutre (Terminé / Expiré / Inactif)** :
  * Fond badge neutre : `#ecebe5` (`--badge-neutral-bg`)
  * Texte badge neutre : `#5b615d` (`--badge-neutral-text`)
* **Rouge Erreur / Alerte** :
  * Fond alerte : `#f9e9e3` (`--alert-error-bg`)
  * Bordure alerte : `#c99588` (`--alert-error-border`)
  * Texte alerte : `#782d21` (`--alert-error-text`)
* **Vert Notification** :
  * Fond notice : `#e5efe5` (`--alert-success-bg`)
  * Bordure notice : `#96b59d` (`--alert-success-border`)
  * Texte notice : `#173321` (`--alert-success-text`)

### Plan du parking (Zone sombre "Lot")
* **Fond parking** : `#242728` (`--lot-bg`)
* **Place de parking standard** : Fond `#2c302f`, bordure `#757a77`, texte `#f4f5f1`
* **Place disponible** : Bordure `#a3b9a8`
* **Place sélectionnée** : Fond `#9cddad`, bordure `#9cddad`, texte `#173321`
* **Place occupée** : Fond `#d9dcda`, texte `#252928`
* **Place attendue** : Fond `#f4c578`, texte `#322313`
* **Place indisponible / hors service** : Hachures 135deg `#454846` / `#393c3a`, texte `#eeeee9`

---

## 2. Typographie

* **Famille** : `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`
* **Titres** :
  * `h1` : `1.9rem` (2.65rem sur page login desktop), interligne `1.17`, interlettrage `-0.025em`
  * `h2` : `1.13rem`, gras 650
  * `h3` : `1.0rem`, gras 600
* **Corps de texte** : `1rem`, interligne `1.55`
* **Textes secondaires (`.muted`)** : `0.875rem`
* **Nombres / Tarifs / Dates** : `font-variant-numeric: tabular-nums`

---

## 3. Formes, Rayons & Ombres

* **Rayons de courbure (`border-radius`)** :
  * Boutons de base / Entrées : `8px`
  * Badges : `14px` (forme pilule)
  * Durées rapides : `20px` (pilule pleine)
  * Cartes de contenu : `12px` à `14px`
  * Places de parking (`.bay`) : `7px`
  * Plan du parking (`.lot`) : `14px`
* **Focus visible** :
  * `outline: 3px solid #398250; outline-offset: 3px;`
  * Sur le plan sombre : `outline-color: #9cddad;`

---

## 4. Composants & Ergonomie

* **Boutons** :
  * Primaire : Fond `#242625`, texte blanc, hauteur minimale `42px`, padding `9px 14px`
  * Secondaire : Fond `#fcfbf8`, bordure `#dad9d1`, texte `#242625`
  * Discret (`.quiet`) : Fond transparent, bordure transparente
  * Désactivé : Fond `#e8e7e0`, texte `#61615b`, bordure `#e8e7e0`
* **Formulaires** :
  * Labels clairs, au-dessus des champs, gras 650
  * Inputs : hauteur min `42px`, bordure `#aaa9a0`, fond blanc
* **Accessibilité** :
  * Balisage HTML5 sémantique (`<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`)
  * Navigation au clavier intégrale (Tab, Entrée, Espace, Échap)
  * Attributs ARIA (`role="status"`, `role="alert"`, `aria-live`, `aria-label`, `aria-current`)
  * Contraste texte/fond conforme WCAG 2.1 niveau AA
* **Responsive** :
  * Lisible et manipulable dès `360px` de largeur d'écran
  * Défilement horizontal évité, mise en page en colonne unique sur mobile
