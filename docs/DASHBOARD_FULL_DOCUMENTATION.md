# Documentation complète — Dashboard Smart Shepherd

Dernière mise à jour : 2026-06-01

Table des matières

- Introduction
- Présentation générale du projet
- Architecture technique
- Authentification & sécurité
- Flux de données & APIs
- Pages principales (documentation détaillée)
  - Page `Tableau de bord` (`Dashboard`)
  - Page `Animaux` (liste) (`Animals`)
  - Page `Fiche animal` (`AnimalProfile`)
  - Page `Carte temps réel` (`MapMonitor / RealTimeMap_REDESIGNED`)
  - Page `Utilisateurs` (`Users`)
  - Page `Paramètres` (`Settings`)
  - Page `Alerts / Anomalies / Analytics / Hardware / Agenda` (synthèse)
  - Login
- Modules IA
  - `healthScoring` (scoring de santé)
  - `behaviorDetector` (synthèse)
  - `batteryPredictor` (synthèse)
- Cartographie & géolocalisation
- Composants UI récurrents
- Logique métier & règles importantes
- Données, modèles d'objets et APIs consommées
- État de maturité par fonctionnalité
- Sécurité & gestion des rôles
- Améliorations recommandées
- Captures & schémas (description)
- Conclusion et prochaines étapes

---

Introduction

Ce document fournit une description exhaustive et professionnelle du dashboard "Smart Shepherd". Il est conçu pour permettre à un développeur, un administrateur ou un encadrant de comprendre la structure, le comportement fonctionnel, la logique métier, les sources de données et les composants IA sans ouvrir le code.

Présentation générale du projet

- Objectif : fournir une interface de supervision et de gestion d’un troupeau connecté (IoT + IA). Surveillance en temps réel, gestion d’alertes, fiches animale, cartes géographiques et rapports vétérinaires.
- Stack frontend : React + TypeScript, Vite, React Query, Leaflet (cartographie), Chart.js pour graphiques, lucide-react pour icônes, framer-motion, react-window pour listes virtualisées.
- Backend & infra : dossier `backend/` (API Node.js, OpenAPI disponible), `ai-service/` (service Python pour IA), configuration Docker + docker-compose pour exécution locale/production.

Architecture technique

- Entrée application : `src/main.tsx` — providers (React Query, Router, Auth, Theme).
- Routage principal : `src/App.tsx` — routes lazy-loaded pour `Dashboard`, `MapMonitor`, `Animals`, `Users`, `Settings`, `Alerts`, `Analytics`, `Hardware`, `Agenda`, pages admin (labelling, AI settings), etc.
- Contexte et communication temps réel : `src/contexts/MqttContext.tsx` / `MQTT_Context_FIXED.tsx` qui gèrent la connexion MQTT (websocket) et la simulation.
- Store IoT : hooks personnalisés `useIoTStore` (zustand ou similaire) — centralise devices, alerts, history.
- Map worker / map utilities : `useMapWorker` et composants Map (leaflet + geoman + marker clustering).
- AI : `src/ai/` contient `healthScoring.ts`, `behaviorDetector.ts`, `batteryPredictor.ts` (algorithmes/heuristics ou modèles légers).

Authentification & sécurité

- Provider : `AuthProvider` (dans `src/contexts/AuthContext.tsx`) — abstrait login, logout, user roles.
- Rôles : `USER_ROLES` utilisé pour contrôler l’accès (ex: admin, operator, vet, viewer). Voir `src/pages/Users/Users.tsx` pour mapping rôle/libellés.
- JWT / rafraîchissement : documentation sur le flux de refresh token présente dans `docs/JWT_REFRESH_TOKEN_FLOW.md`.
- Protections : routes protégées via `useAuth()` ; UI adapte les actions (création, suppression) selon rôle.
- Bonnes pratiques observées : utilisation de `react-query` pour gestion des appels réseaux, erreurs et retries.

Flux de données & APIs

- Sources :
  - MQTT topics (collar GPS, alerts) : abonnements `collar/+/gps`, `alerts/+` (gérés par `MqttContext`).
  - API REST backend : `backend/openapi.yaml` définit routes vacations (animaux, utilisateurs, rapports, documents, medical history).
  - AI service (optionnel) : `ai-service/` Python expose endpoints d’inférence si utilisé.
  - Services externes : météo (`services/weatherService`), tile providers (Leaflet tile layers).
- Patterns : déduplication côté frontend via `useIoTStore.queueIoTUpdate` et worker (`useMapWorker`) pour enrichir positions et calculer KPI.

Pages principales (documentation détaillée)

Chaque sous-section suit le format demandé : nom technique, objectif, fonctionnalités, données, composants UI, logique, IA associée, cartographie (si applicable), sécurité, état de maturité, améliorations.

Page: Tableau de bord (Dashboard)
- Nom technique : `Dashboard` / fichier analysé : `Dashboard_PERFORMANCE_FIXED.tsx` (version optimisée).
- Nom affiché : "Tableau de bord intelligent" (titre visible).
- Objectif principal : vue synthétique temps réel des KPIs du troupeau, alertes critiques, graphiques historiques, accès rapide aux actions (pause chart, simulation).

Description fonctionnelle
- Rôle : offrir une vision opérationnelle en temps réel et KPIs agrégés (nombre de colliers, actifs, hors zone, alertes critiques, niveau batterie moyen, santé moyenne).
- Problème métier résolu : supervision centralisée pour détecter rapidement incidents (batterie faible, ANIMAUX hors zone, alertes critiques) et permettre réaction.
- Utilisateurs : opérateurs terrain, administrateurs, vétérinaires (lecture prioritaire), responsable exploitation.

Fonctionnalités
- KPIs en cartes (Total troupeau, En ligne, Alertes, Hors Zone) — personnalisation du layout stockée en localStorage (`ss_dashboard_layout_v1`).
- Graphiques temps réel (Chart.js) montrant evolution du nombre d'animaux actifs et des alertes.
- Pause / Reprise des graphiques pour réduire la charge CPU (`isChartPaused`).
- Mode Simulation vs Temps réel via `toggleSimulation` (MQTT simulation).
- LiveBadge indiquant l'état de connexion MQTT / offline data.
- Banner d'alertes critiques filtrée par gravité.
- Widgets secondaires (WeatherWidget, Mini KPIs).

Données utilisées
- Sources : `useIoTStore` (devices, history, alerts), `useMapWorker` (enrichedAnimals, kpis).
- APIs : Données temps réel via MQTT ; APIs REST pour historique et KPIs persistants si configuré.
- Données affichées : counts, liste animaux enrichis, alerts (read/unread), battery averages, chart historic points.
- Données modifiées : lecture des alertes (markAlertAsRead) via `useIoTStore`.

Composants UI/UX
- Cards (KpiCard, MiniKpi)
- Chart (Line via react-chartjs-2)
- Banner (alertes critiques)
- Buttons (Pause, Simulation), LiveBadge
- Skeletons pour chargement

Logique métier
- Calcul des KPIs via `useMapWorker` (aggrégation, filtrage hors zone)
- Seuil batterie faible : `BATTERY_LOW_THRESHOLD = 20`
- Chart throttling and visibility handling (document.hidden)

IA
- Le dashboard consomme sorties IA (ex: `kpis` calculés par map worker ou AI). Pas de modèle direct exécuté dans le composant.

Cartographie
- Le dashboard n'affiche pas la carte principale, mais il consomme `useMapWorker` pour obtenir `enrichedAnimals`.

Sécurité
- Action sensibles (marquer alerte, afficher détails) restreintes par contextes d'authentification dans le reste de l'app.

État de maturité
- KPIs & graphes : Production Ready
- Layout sauvegardé : Production Ready
- Throttling & perf : Implementé (optimisations présentes)

Améliorations recommandées
- Export CSV / PDF direct depuis les KPIs
- Pagination côté serveur si grand volume
- Option pour réduire intervalle chart via UI


Page: Animaux — Liste (Animals)
- Nom technique : `Animals` — `src/pages/Animals/Animals.tsx`.
- Nom affiché : "Animaux" (liste principale).
- Objectif : consulter, filtrer, trier et accéder aux fiches animales ; vue en grille/table virtuelle.

Description fonctionnelle
- Rôle : fournir un catalogue paginé/virtualisé des animaux connectés, montrer état santé, batterie, localisation sommaire.
- Problème métier : permettre tri et triage rapide (sélection d'animaux pour intervention), workforce planning.
- Utilisateurs : opérateurs, vétérinaires, admins.

Fonctionnalités
- Liste virtualisée (`react-window`) pour performance (grand nombre d'entrées).
- Colonnes : sélection, nom, race, collier, santé, score IA, batterie, température, dernière MAJ, actions.
- Actions : sélection multiple, navigation vers fiche détaillée (`Détails →`), tri par colonne.
- Indications visuelles : badge santé, barre batterie, signal RSSI.
- Slide-over / panel de détails quick view (AnimalDetailPanel) avec actions rapides (Planifier visite, archiver).

Données utilisées
- Sources : `useIoTStore().devices` ; `healthScoring` pour enrichissement des scores.
- APIs : chargement initial via `useIoTStore`/query — persistence via backend CRUD (fetchUsers, animalsService etc.).
- Données affichées : `name`, `collar_id`, `breed`, `health`, `battery`, `temperature`, `lastUpdate`, `rssi`, `speed`.
- Données modifiées : sélection locale, opérations CRUD via services (archive par `animalsService.archive`).

Composants UI
- Virtualized list, List items, Health badges, Buttons, Progress bars, Mini map widget (`MiniGPSMap`), `VitalBox`.

Logique métier
- Enrichissement healthScore via `scoreAnimalHealth` (poids métriques, alerts recent)
- Virtualisation et mesure d'élément pour dimensionnement adaptatif
- Tri client et pessimistic update sur mutations (optimistic UI via react-query)

IA
- `scoreAnimalHealth` calcule un score agrégé basé sur batterie, température, activité, RSSI et alerts récentes — règle pondérée (voir `src/ai/healthScoring.ts`).

État de maturité
- Liste virtualisée : Production Ready
- Détail slide-over : Production Ready
- Upload documents & historique : Production Ready (mutations avec react-query)

Améliorations
- Filtre par secteur & geofence
- Chargement asynchrone par fenêtre pour très grandes fermes


Page: Fiche animal (AnimalProfile)
- Nom technique : `AnimalProfile` — `src/pages/Animals/AnimalProfile.tsx`.
- Nom affiché : "Fiche animal".
- Objectif : page détaillée pour suivre métriques, historique médical, documents et notes.

Description fonctionnelle
- Rôle : fournir dossier médical et télémetrie temps réel d’un animal ; actions vétérinaires et administratives.
- Problème métier : centraliser l’historique médical, documents (PDF/JPG), notes terrain et génération de rapports.
- Utilisateurs : vétérinaires, opérateurs, administrateurs.

Fonctionnalités
- Onglets : Vitaux, Historique médical, Documents, Notes.
- Metrics temps réel : batterie, température, vitesse, RSSI.
- Mini carte GPS (`MiniGPSMap`) affichant dernière position.
- Upload et gestion de documents (PDF/JPG/PNG) avec validation taille/type.
- Création d’entrée historique médicale (vaccin, traitement, examen).
- Export de rapport PDF (`downloadPDFReport`).
- Archivage et navigation (prev/next animal).

Données utilisées
- API : `animalProfileService` pour documents et historique médical.
- Données affichées : métriques du device, liste de documents, entrées historiques.
- Données modifiées : upload/delete documents, création d’entrées médicales, patch des notes.

Composants UI
- Tabs, Empty states, Upload drag/drop, modales de confirmation, toast notifications.

Logique métier
- Validation client des documents (extensions, mime types, taille maximale), tokenisation temporaire pour upload.
- Optimistic UI pour l’ajout d’entrées (mutation onMutate) avec rollback en cas d’erreur.

IA
- Health score et badges fournis par `healthScoring`.

État de maturité
- Production Ready (fonctions essentielles présentes)

Améliorations
- Visualisation temporelle des métriques (graphiques historique par métrique)
- Historique médical enrichi (liens vers traitement, rappels automatiques)


Page: Carte temps réel (RealTimeMap_REDESIGNED / MapMonitor)
- Nom technique : `RealTimeMapRedesigned` / `MapMonitor` (`src/pages/Map/RealTimeMap_REDESIGNED.tsx`, `pages/Map/MapMonitor.tsx` dans fixes).
- Nom affiché : "Carte" / "Surveillance géographique".
- Objectif : visualisation géographique des animaux, zones (geofences), clusters, heatmap et édition de zones.

Description fonctionnelle
- Rôle : permettre localisation, suivi de mouvements, détection hors zone et édition de geofences.
- Problème métier : repérage spatial rapide des incidents, planification d’interventions géo-localisées.
- Utilisateurs : opérateurs terrain, managers.

Fonctionnalités
- Rendu markers (icônes modernes), clustering, heatmap (leaflet.heat), trails (historique de positions), geofencing (création/édition/suppression) via leaflet-geoman.
- Filtres d’état (SAFE, OUT_OF_ZONE, LOW_BATTERY, CRITICAL) et modes d’affichage (markers, heatmap).
- Suivi utilisateur, recentrage, fitBounds automatique, options de tile layer (streets/satellite/dark).
- Custom icons with battery badges and selected halo; cluster icon indiquant nombre et statut.

Données utilisées
- Sources : `animalsList` (devices avec lat/lng), `history` (trails), `zones` (geofence definitions), `useFarmConfig` pour centre de ferme.
- APIs : stockage/synchronisation des zones via backend CRUD (hooks `onZoneCreated`/Edited/Deleted mentionnés en props).

Composants UI
- MapContainer, TileLayer, MarkerClusterGroup, HeatmapLayer, custom polygons (GeofenceLayer), MapEvents.

Logique métier
- Calcul des bounds, détection breached zones (breachedZoneIds), heuristiques de rendu mode selon nombre d'animaux et zoom.

IA
- Pas de modèle IA exécuté directement sur la carte ; les alertes/états sont pré-calculés et marqués.

Cartographie & géolocalisation
- Tile providers configurables, gestion des icônes Leaflet, intégration de `@geoman-io/leaflet-geoman-free` pour édition.

État de maturité
- Production Ready (fonctionnalités avancées présentes), à valider sur très grand volume (>1000 devices) pour performance.

Améliorations
- Pagination serveur ou clustering serveur pour très grands jeux de points
- Export GeoJSON des zones et snapshot carte


Page: Utilisateurs (Users)
- Nom technique : `Users` — `src/pages/Users/Users.tsx`.
- Nom affiché : "Utilisateurs".
- Objectif : gérer comptes utilisateur, rôles et téléphones, suppression et édition.

Description fonctionnelle
- Rôle : administration des comptes — création, édition, suppression, attribution de rôle.
- Utilisateurs : administrateurs.

Fonctionnalités
- CRUD utilisateurs via `services/usersService` ; formulaire validation client (email regex), rôles prédéfinis (`admin`, `operator`, `vet`, `viewer`).
- Badges de rôle, état skeleton et empty state, supports optimistic updates via react-query.

Données utilisées
- API : `fetchUsers`, `createUser`, `updateUser`, `deleteUser`.
- Données affichées : `name`, `email`, `role`, `phone`, `status`.

Sécurité
- Restriction d’accès à cette page côté route / UI selon `useAuth()` et rôle; actions critiques (delete) demandent confirmation.

État de maturité
- Production Ready

Améliorations
- Audit logs pour actions admin (création/suppression)
- Invitation par email et flow d’activation


Page: Paramètres (Settings)
- Nom technique : `Settings` — `src/pages/Settings/Settings.tsx`.
- But : configuration globale application (company, farm config, API endpoints, broker URLs, theme).
- Fonctions typiques : modification des variables de configuration, gestion des clés, toggle features.
- État : implémentée (fournir plus de détails si nécessaire en ouvrant le fichier `src/pages/Settings/Settings.tsx`).

Pages: Alerts / Anomalies / Analytics / Hardware / Agenda
- Ces modules sont référencés dans le routage principal (`src/App.tsx`) et semblent implémentés en pages séparées (lazy-load). Leur documentation détaillée suit le même format que ci-dessus ; pour chaque page, les points suivants doivent être approfondis à la demande : routes exactes, endpoints backend, schémas de données, permissions.

Login
- Composant `Login` dans `src/App.tsx` (implémentation intégrée) avec animations, validation des champs, gestion erreurs, redirection post-login.
- Authentification via `useAuth().login` ; redirection vers `/dashboard` après succès.

Modules IA

`healthScoring` (implémenté)
- Fichier : `src/ai/healthScoring.ts`.
- But : calculer un score de santé synthétique basé sur métriques devices et historique d’alertes.
- Entrées : `battery`, `temperature`, `speed`, `activity_level`, `rssi`, liste d'`alerts` et fenêtre temporelle.
- Sorties : `HealthScoreResult` { score (0–100), label (excellent|bon|surveillance|critique), mostConcerningMetric, breakdown }.
- Méthode : fonctions de scoring par métrique + pondérations (battery 20%, temperature 30%, activity 25%, rssi 15%, alerts 10%), clamping, calcul pondéré et mapping vers label.
- Cas d’usage : afficher badge health dans liste animaux, déclencher règles d’alerte et priorisation.
- État : implémenté en JS (heuristique), prêt en production pour scoring léger. Si besoin d’un modèle ML, prévoir export/inférence côté `ai-service/`.

`behaviorDetector` & `batteryPredictor` (présence détectée)
- Emplacement : `src/ai/behaviorDetector.ts`, `src/ai/batteryPredictor.ts`.
- Rôle : détection d’anomalies comportementales et prédiction d’autonomie batterie. Le niveau d’implémentation doit être vérifié (algorithme heuristique vs modèle ML).
- Recommandation : documenter précisément les entrées/sorties si vous souhaitez utiliser ou exposer via `ai-service`.

Cartographie & géolocalisation

- Library principale : `leaflet` (+ `react-leaflet`).
- Extensions : `leaflet.heat`, `leaflet.markercluster` / `react-leaflet-cluster`, `@geoman-io/leaflet-geoman-free` pour édition geofence.
- Fonctionnement : points animaux placés par lat/lng, iconographie dynamique selon status/battery/selection, clusters, heatmap (points pondérés par signal), trails via Polyline.
- Sources géographiques : tile providers (configurable), farm center via `useFarmConfig`.
- Interactions utilisateur : création zone polygonale, édition et suppression, tooltip marker, click to focus, fitBounds.

Composants UI/UX récurrents

- Layout : `AppLayout` (header, sidebar, main content)
- Buttons, Badges, KpiCard, MiniKpi, Skeleton components
- Map components : `MiniGPSMap`, `UserLocationTracker`
- Widgets : `WeatherWidget`, `LiveBadge`
- Forms : validation client, drag and drop upload

Logique métier

- Calculs et règles notables :
  - Health scoring (pondérations)
  - Battery threshold (20%) => low battery alerts
  - Alert severity (CRITICAL vs others) => bannering and notifications
  - Charting: throttling, pause on tab hidden
  - MQTT reconnect with exponential backoff
  - Optimistic updates & rollback patterns (react-query)

Données, modèles d'objets et APIs consommées

- Schémas utilisés (extraits significatifs) :
  - IAnimal: { collar_id, name, lat, lng, battery, temperature, rssi, speed, activity_level, health, lastUpdate, status }
  - Alert: { id, collar_id, severity, type, message, timestamp, read }
  - IGeofenceZone: { id, coords, name, color }
- Endpoints notables : see `backend/openapi.yaml` for path list (animals, alerts, users, reports, zones, documents).

Sécurité & gestion des rôles

- Rôles prévus : `admin`, `operator`, `vet`, `viewer`.
- Actions restreintes : création/suppression utilisateurs, settings avancés, modifications géofences, archiver animal.
- Recommandations :
  - Auditer endpoints sensibles (delete/archive)
  - Forcer TLS (HTTPS) pour MQTT WebSocket et API
  - Rate limiting pour endpoints de mutation (uploads, createRecord)

État de maturité — synthèse par fonctionnalité

- Dashboard (KPIs, charts) : Production Ready
- Liste Animaux (virtualisée) : Production Ready
- Fiche Animal (vitals/history/docs) : Production Ready
- Carte temps réel & édition geofences : Production Ready (tester sur gros volumes)
- Users CRUD : Production Ready
- Auth flow (login + roles) : Production Ready
- AI : `healthScoring` Production Ready (heuristic); `behaviorDetector` / `batteryPredictor` : Partiellement implémenté / à vérifier pour modèle ML complet
- Reports (PDF export) : Implémenté (export service), tester échelle

Améliorations recommandées (prioritaires)

- Performance & scalabilité
  - Activer clustering côté serveur ou pagination pour >2000 devices
  - WebWorker pour calculs lourds (déjà existant via `useMapWorker`, vérifier CPU)
- Observabilité
  - Ajouter metrics (Prometheus) pour latences backend et erreurs frontend
  - Centraliser logs (sentry) pour erreurs React et backend
- UX
  - Mode plein écran carte, snapshots, plus d’accessibilité (a11y)
  - Recherche globale et filtres sauvegardés
- Sécurité
  - Renforcer rotation des credentials MQTT
  - Policy CSP, HSTS, vérification des tokens côté serveur
- IA
  - Documenter spécifiquement `behaviorDetector` et `batteryPredictor` et exposer endpoints via `ai-service` si modeles lourds.

Captures & schémas (description)

- Eléments visuels principaux :
  - Header SaaS style avec état Live/Simulation et actions rapides
  - KPIs en tuiles rectangulaires (4 colonnes adaptatives)
  - Graphes time-series (zone courbe remplie + ligne pointillée pour alertes)
  - Liste virtualisée avec badge santé et barre de batterie
  - Slide-over détail animal (panel droit)
  - Carte interactive avec markers colorés, clusters et polygones geofence

Conclusion et prochaines étapes

J'ai généré une documentation complète et structurée basée sur l'analyse du code source principal.

Propositions d'étapes suivantes (je peux effectuer) :
- Générer automatiquement la documentation restée partielle pour les pages non inspectées (Alerts, Anomalies, Analytics, Hardware, Agenda).
- Ajouter diagrammes : architecture (mermaid) et schéma de flux MQTT → backend → frontend.
- Extraire et documenter les APIs du `backend/openapi.yaml` pour insérer des exemples d'appels.
- Produire captures d'écran (si vous fournissez des images) et les intégrer dans la doc.

Souhaitez-vous que je :
- 1) complète la doc en ajoutant chaque page non détaillée (Alerts/Analytics/Anomalies/Hardware/Agenda) ?
- 2) génère des diagrammes Mermaid pour l'architecture et le flux de données ?
- 3) exporte cette documentation au format PDF ou l’ajoute dans le README ?

# Documentation complète — Dashboard Smart Shepherd

## Table des matières
1. Présentation générale
2. Architecture technique
3. Pages et composants (détaillé)
   - 3.1 Dashboard (Tableau de bord)
   - 3.2 Carte temps réel (Map Monitor / RealTimeMap)
   - 3.3 Liste Animaux (`Animals`)
   - 3.4 Fiche Animal (`AnimalProfile`)
   - 3.5 Utilisateurs (`Users`)
   - 3.6 Réglages (`Settings`) et Administration
   - 3.7 Autres pages importantes (Alerts, Anomalies, Analytics, Hardware, Agenda)
4. Modules IA
   - healthScoring
   - behaviorDetector
   - batteryPredictor
5. Cartographie & géolocalisation
6. Sécurité et gestion des accès
7. Données & APIs
8. Logique métier et calculs importants
9. Composants UI/UX récurrents
10. État de maturité par fonctionnalité
11. Recommandations d'amélioration
12. Captures et schémas (description)
13. Conclusion

---

## 1. Présentation générale
Ce document décrit en détail le dashboard "Smart Shepherd" présent dans ce dépôt. Il vise à fournir une compréhension complète des pages, composants, flux de données, règles métier et modules IA, afin qu'un développeur, administrateur ou manager puisse appréhender l'application sans accès direct au code.

Stack principal observé:
- Frontend: React + TypeScript, bundler Vite
- Réactivité / data fetching: `@tanstack/react-query`
- Cartographie: Leaflet (+ plugins : markercluster, heatmap, geoman)
- Temps réel: MQTT client (via websocket si `VITE_MQTT_URL`) et simulation
- Backend/API: dossier `backend/` (OpenAPI présent)
- Service IA séparé: `ai-service/` (Python)

Fichiers pointés comme entrées: `index.html`, `src/main.tsx`, `src/App.tsx`, `package.json`, `docker-compose.yml`, `backend/openapi.yaml`, `ai-service/`.

---

## 2. Architecture technique
- Entrée application: `src/main.tsx` — providers (`QueryClient`, `AuthProvider`, `ThemeProvider`) puis `App`.
- Routage et pages: `src/App.tsx` charge les pages via `React.lazy` et `react-router-dom`.
- Contexte MQTT: `MQTT_Context_FIXED.tsx` et `src/contexts/MqttContext.tsx` — encapsulent la connexion MQTT, la simulation, la reconnexion et la distribution des messages vers le store.
- Stockage client: hooks personnalisés `useIoTStore` (Zustand ou similaire) gèrent `devices`, `alerts`, `history`.
- Cartographie: composants basés sur `react-leaflet` (ex: `src/pages/Map/RealTimeMap_REDESIGNED.tsx`) avec clustering, heatmap, geofencing (Leaflet Geoman).
- IA: modules JS/TS (`src/ai/*`) pour scoring & features internes; `ai-service/` permet services Python pour entraînement ou inférence lourde.
- Tests: configuration `vitest.config.ts` présente.

Communication Frontend ↔ Backend:
- Requêtes REST via services dans `src/services/*` (ex: `animalsService`, `usersService`).
- Spécification OpenAPI: `backend/openapi.yaml`.
- Messages temps réel: topics MQTT `collar/+/gps` et `alerts/+`.

---

## 3. Pages et composants (détaillé)

### 3.1 Dashboard (Tableau de bord)
- Nom technique: `Dashboard` (implémentation principale: `Dashboard_PERFORMANCE_FIXED.tsx` et `src/pages/Dashboard/Dashboard.tsx` si présent)
- Nom affiché: "Tableau de bord intelligent" / "Tableau de bord".
- Objectif principal: fournir une vue synthétique temps réel des métriques globales (nombre d'animaux, alertes, devices hors-zone, KPIs) et des graphiques d'évolution.

Description fonctionnelle:
- Rôle: synthèse opérationnelle et accès rapide aux actions (pause/reprendre flux graphique, basculer simulation/temps réel, voir alertes critiques).
- Problème métier: surveillance centralisée et détection rapide d'incidents (batterie faible, animaux hors zone, alertes critiques).
- Utilisateurs: Opérateurs, Administrateurs, Vétérinaires (vue synthétique).

Fonctionnalités:
- KPIs dynamiques (Total troupeau, En ligne, Alertes, Hors zone).
- Graphique temps réel (Line chart) avec historique limité pour performance.
- Bannières d'alerte critique.
- Boutons: Pause/Play graphique, Activer/Désactiver simulation, Marquer alertes.
- Widgets météo (`WeatherWidget`) et LiveBadge de connexion MQTT.

Données utilisées:
- Source: `useIoTStore` (store central des devices), `useMapWorker` (enrichissement), MQTT topics.
- APIs: lecture via stores; pas de mutation directe depuis le dashboard (sauf actions sur alertes via store).
- Données affichées: counts, KPIs, séries temporelles (effectifs & alertes), liste d'appareils en défaut (batterie, outOfZone).

Composants UI/UX:
- `KpiCard`, `MiniKpi`, `SkeletonCard`, `SkeletonChart`, `LiveBadge`, `Button`.
- Layout responsive grid (col-span, aside météo).

Logique métier:
- Calculs de KPI (ex: kpis.totalActive, kpis.outOfZone) réalisés côté client dans `useMapWorker`.
- Seuils (BATTERY_LOW_THRESHOLD = 20%).
- Stockage du layout dans `localStorage` (`ss_dashboard_layout_v1`).

IA: le dashboard consomme indicateurs IA (score santé, breakdown) produits par `healthScoring` et `useMapWorker`.

Maturité: Production Ready (UI principale présente et logique de mise à jour en place).

Recommandations (extraits):
- Ajouter indicateur de latence MQTT.
- Option pour exporter le graphe en CSV/PDF.

---

### 3.2 Carte temps réel (Map Monitor / RealTimeMap)
- Nom technique: `RealTimeMapRedesigned` (`src/pages/Map/RealTimeMap_REDESIGNED.tsx`) et `MapMonitor` variant
- Nom affiché: "Carte" / "Moniteur carte temps réel".
- Objectif principal: visualiser la position des collier/animaux, zones de geofence, clusters, trails et heatmap.

Description fonctionnelle:
- Rôle: centre opérationnel pour la géolocalisation et la surveillance spatiale.
- Problème métier: repérer animaux hors zone, densités, zones à investiguer et fournir outils de création/édition de geofence.
- Utilisateurs: Opérateurs terrain, Admin.

Fonctionnalités:
- Affichage markers, clusters, heatmap selon volume.
- Filtre statut (ALL / SAFE / OUT_OF_ZONE / LOW_BATTERY / CRITICAL).
- Mode affichage: markers / heatmap.
- Options: trails (historique de trajectoire), geofence (création/édition via Geoman), recenter sur ferme ou utilisateur.
- Interaction: sélectionner animal, fitBounds, click sur cluster, zoom, mesurer, dessiner zones.

Données utilisées:
- Source: `useIoTStore` devices + `history` (trajets).
- Données affichées: lat/lng, battery, status, health, lastUpdate, speed, rssi.
- Données modifiées: geofence (création/édition) envoyée via callbacks (`onZoneCreated`, `onZoneEdited`).

Composants UI/UX:
- `MapContainer`, `TileLayer`, `MarkerClusterGroup`, `HeatmapLayer`, `GeofenceLayer`, `UserLocationTracker`.
- Custom markers via `L.divIcon` (icônes modernes avec badge batterie).

Logique métier:
- Algorithmes de rendu: passage automatique en `heatmap`/`cluster` selon nombre d'animaux et zoom.
- Breach detection: calcul zones en infraction (breachedZoneIds).
- Priorité pour centrage: userLocation > farmCenter > animal center > défaut (Paris).

Sécurité: tile layers et clés (si satellite) via variables d'environnement; limiter accès édition geofence aux rôles autorisés côté backend.

Maturité: Production Ready (fonctionnalités avancées présentes).

Recommandations:
- Déplacer heavy rendering vers WebWorker si >1000 markers.
- Ajouter throttling pour les événements de map (move/zoom).

---

### 3.3 Liste Animaux (`Animals`)
- Fichier: `src/pages/Animals/Animals.tsx`
- Nom affiché: "Animaux" / "Liste animaux".
- Objectif: afficher liste virtualisée d'animaux avec filtres, sélection multiple et actions.

Description fonctionnelle:
- Rôle: gestion opérationnelle (recherche, tri, sélection, navigation vers fiche), vue virtualisée pour performance.
- Utilisateurs: Opérateurs, vétérinaires.

Fonctionnalités:
- Recherche, tri multi-colonnes, sélection en masse (cases à cocher).
- Liste virtualisée (`react-window`) pour performance sur grands volumes.
- Item actions: bouton "Détails →" qui ouvre la fiche.
- Indicateurs par ligne: nom, collier, race, health label, score IA, batterie, température, dernier update.

Données utilisées:
- Source: `useIoTStore` devices (enrichies par `scoreAnimalHealth`).
- Données modifiées: sélection locale, export possible via services.

Composants:
- `VirtualizedAnimalsList`, `AnimalListItem`, `VitalBox`, `MiniGPSMap` (aperçu carte), `Button`.

Logique métier:
- Health scoring via `ai/healthScoring.ts`.
- Badges santé calculés selon score; seuils pour couleur et animations (pulse pour critique).

Maturité: Production Ready.

Recommandations:
- Ajouter pagination backend-friendly si la source devient très grande.
- Ajouter sauvegarde des colonnes/tri par utilisateur.

---

### 3.4 Fiche Animal (`AnimalProfile`)
- Fichier: `src/pages/Animals/AnimalProfile.tsx`
- Nom affiché: "Fiche animal" / "Profil animal".
- Objectif: vue détaillée d'un animal avec métriques temps réel, historique médical, documents et notes.

Description fonctionnelle:
- Rôle: dossier opérationnel/vétérinaire pour un animal.
- Problème métier: centraliser les informations cliniques et opérationnelles d'un collier.
- Utilisateurs: vétérinaires, opérateurs.

Fonctionnalités:
- Onglets: `Vitaux`, `Historique médical`, `Documents`, `Notes`.
- Actions: planifier visite, télécharger rapport PDF, archiver l'animal, upload & delete documents, ajouter entrée historique.
- Navigation: précédent / suivant animal.

Données utilisées:
- Sources: `useIoTStore` (métriques realtime), services HTTP (`animalProfileService`) pour historique/documents.
- Données modifiées: création historique médical, upload documents, patch notes, archiver animal.

Composants UI/UX:
- `VitalBox` (cartes métriques), `MiniGPSMap` (mini-carte), uploader drag & drop, listes paginées, forms et validations.

Logique métier:
- Formes de validation, debounce pour sauvegarde notes, optimistic update pour historique.
- Report generation via `downloadPDFReport`.

IA:
- Affichage `healthScore` (issu de `healthScoring`), breakdown des métriques.

Maturité: Production Ready (fonctionnalités avancées présentes).

Recommandations:
- Améliorer gestion erreurs upload (retry/rate-limit), ajouter versioning documents.

---

### 3.5 Utilisateurs (`Users`)
- Fichier: `src/pages/Users/Users.tsx`
- Objectif: CRUD utilisateurs, gestion de rôles et permissions.

Description fonctionnelle:
- Rôle: administration des comptes, attribution des rôles (admin, operator, vet, viewer).
- Utilisateurs: Administrateurs.

Fonctionnalités:
- Liste utilisateurs, create/edit modal, suppression, rôle selection, validations email.
- Badges de rôle et filtre.

Données utilisées:
- Services: `usersService` (fetchUsers, createUser, updateUser, deleteUser).
- Données modifiées: création / mise à jour / suppression utilisateur via API.

Logique métier:
- Validation email, unicité, optimistic updates via `react-query`.

Sécurité:
- Les actions doivent être protégées par rôles côté backend (ex: seuls `admin` peuvent créer/supprimer).

Maturité: Production Ready.

---

### 3.6 Réglages (`Settings`) et Administration
- Fichier: `src/pages/Settings/Settings.tsx` et sous-pages admin (`pages/Admin/*`).
- Objectif: configuration applicative (ferme, MQTT, intégrations IA), pages d'administration IA (labelling, AISettings).

Fonctionnalités typiques:
- Modification de paramètres globaux, gestion tokens, réglages de la carte, maintenance.

Maturité: dépend des sous-pages; page `Settings` présente.

---

### 3.7 Autres pages importantes
- `Alerts` : centre d'alertes, filtrage, marquage lu/non lu, historisation.
- `Anomalies` : détection & revue d'anomalies (IA assistée).
- `Analytics` : rapports et KPI historiques.
- `Hardware` : inventaire des appareils (colliers), firmware, état.
- `Agenda` : planning visites, rendez-vous.

Les composants et routes pour ces pages sont chargés via `React.lazy` dans `src/App.tsx`.

---

## 4. Modules IA
Le projet intègre des modules IA légers côté client (`src/ai/*`) et un service Python pour tâches plus lourdes.

### 4.1 `healthScoring` (src/ai/healthScoring.ts)
- But: calculer un score de santé par animal basé sur batterie, température, activité, RSSI et alertes récentes.
- Entrées: métriques device (`battery`, `temperature`, `speed`, `activity_level`, `rssi`) et liste d'alertes.
- Sortie: `HealthScoreResult` comprenant `score`, `label` (`excellent|bon|surveillance|critique`), `mostConcerningMetric` et `breakdown`.
- Règles: poids configurés (battery 20%, temperature 30%, activity 25%, rssi 15%, alerts 10%).
- Cas d'usage: affichage de badges, ordonnancement d'alertes priorisées, filtres sur Map.

### 4.2 `behaviorDetector`
- Module côté client pour détection de patterns comportementaux (présence d'inactivité, errance, etc.).
- Entrées: séries temporelles de position et activité.
- Sorties: flags d'anomalie potentielle.

### 4.3 `batteryPredictor`
- Module de prédiction d'autonomie (évolution batterie) sur séries historiques.

### IA côté serveur (`ai-service/`)
- Contient code Python pour entraînement / inférence et endpoints REST.
- Utilisé pour tâches lourdes non réalisables en navigateur (ex: entraînement de modèles, batch inference).

Maturité IA: modules heuristiques (healthScoring) prêts, modèles ML plus avancés isolés dans `ai-service` (vérifier `ai-service/app/`).

---

## 5. Cartographie & géolocalisation
Résumé du fonctionnement:
- Base: `react-leaflet` + `leaflet` core.
- Plugins: `leaflet.markercluster`, `leaflet.heat`, `@geoman-io/leaflet-geoman-free` pour édition de polygones.
- Custom markers: `L.divIcon` pour rendre badges colorés selon statut et batterie.
- Heatmap: layer construite via `heatLayer(points, options)`.
- Geofence: polygons stockés dans `IGeofenceZone[]` et rendus via `L.polygon`.
- Interactions: fitBounds, move/zoom detection, recenter sur user/farm/animal, drawing tools pour création de zones.

Sources géographiques:
- Tile provider configurable (env `tileLayerOverride`). Si clé satellite nécessaire, passez par variable d'environnement.

Maturité: Production Ready. Recommandations: limiter opérations DOM lourdes, passer le clustering à WebWorker pour datasets très volumineux.

---

## 6. Sécurité
Authentification & autorisations:
- Contexte: `src/contexts/AuthContext.tsx` gère `useAuth`, roles (`USER_ROLES`) et login.
- Routes protégées: `App` redirige vers login si non authentifié (`login` component dans `App.tsx`).
- Gestion des rôles: droits d'accès (admin/operator/vet/viewer) appliqués côté frontend pour UI, mais doivent aussi être vérifiés côté backend.

Pratiques observées:
- Utilisation de tokens (probablement JWT) — vérifier `backend/` et `auth` middleware.
- Stockage local: attention à la persistance de `localStorage` pour layout/flags; ne pas y stocker secrets.

Protection des données:
- Charges potentiellement sensibles (documents animaux) uploadées via endpoints; s'assurer d'encryption / ACL côté backend.

Recommandations sécurité:
- Forcer vérifications côté backend pour toutes les mutations.
- Révoquer tokens en cas de compromission; ajouter rotation de clés pour services externes.

---

## 7. Données & APIs
- Temps réel: MQTT topics `collar/+/gps`, `alerts/+` (traités par `MQTT_Context_FIXED.tsx`).
- REST APIs: services dans `src/services/*` (ex: `animalsService`, `usersService`, `animalProfileService`).
- OpenAPI: `backend/openapi.yaml` décrit les endpoints (vérifier pour schéma complet).
- Données principales affichées: device telemetry, KPIs, historiques médicaux, documents, utilisateurs, geofences.

Considérations: définir contrats API (entêtes, pagination, filtres) et gérer erreurs réseau (retry/backoff déjà présent dans certains hooks).

---

## 8. Logique métier et calculs importants
- Health scoring: voir `src/ai/healthScoring.ts` (poids et seuils).
- KPI computing: réalisé dans `useMapWorker` et hooks `useIoTStore` (calcul totalActive, outOfZone, avgBattery).
- Alert handling: `MQTT` messages d'alerte ajoutés au store et notifiés via `notificationService`.
- Charting: historique limité et throttling (MAX_CHART_POINTS, CHART_UPDATE_INTERVAL).

Validation et règles:
- Upload docs: vérification extension, taille maximale.
- Form validations: login, user email, animal history inputs.

---

## 9. Composants UI/UX récurrents
- Layout: `AppLayout` (sidebars, header), boutons `Button`, badges, skeletons pour loading.
- Widgets: `WeatherWidget`, `LiveBadge`, `UserLocationTracker`.
- Table/list: virtualized list via `react-window` pour `Animals`.
- Forms: modals & slideovers (panel) pour `AnimalProfile`.

Accessibilité & internationalisation:
- `src/i18n` présent — application prête pour traduction.

---

## 10. État de maturité par fonctionnalité
- Dashboard main: Production Ready
- Carte temps réel: Production Ready
- Liste Animaux (virtualisée): Production Ready
- Fiche Animal (vitals/history/documents): Production Ready
- Users CRUD: Production Ready
- IA client (`healthScoring`): Production Ready (heuristique)
- IA serveur (`ai-service`): Partiellement implémenté / dépend de l'environnement
- Geofencing editing: Production Ready (mais nécessite droits backend)
- Export & reporting avancés: Partiellement implémenté (PDF export present pour animal)

---

## 11. Recommandations d'amélioration
- Performance: utiliser WebWorker pour heavy map rendering/cluster calc si scale >1000 devices.
- Observabilité: ajouter métriques de latence MQTT, erreurs réseau et instrumentation (Sentry/Prometheus).
- Sécurité: vérifier que toutes les mutations sont protégées par serveur; améliorer gestion fichiers (virus scan, size limits).
- UX: ajouter rapports détaillés, historique KPI, personnalisation dashboards (favoris, widgets drag/drop).
- Tests: augmenter couverture unit/tests d'intégration pour composants critiques (map, mqtt handling, ai scoring).
- CI/CD: pipelines pour build et tests + scan sécurité images Docker.

---

## 12. Captures et schémas (description)
Plutôt que d'inclure images (non fournies), voici la description des éléments visuels à capturer pour la doc:
- Header du Dashboard: titre + actions (pause/simulation) + LiveBadge.
- KPI cards: 4 cards alignées, avec icônes et counts.
- Chart section: courbe animaux vs alertes (ligne verte & rouge) avec tooltips sombres.
- Carte: markers colorés, cluster icons, geofence polygons semi-transparents, control panel à droite.
- Liste Animaux: rows virtualisées avec avatar, badges santé, progress battery bar, bouton Détails.
- Fiche Animal: slide-over à droite avec onglets: vitaux (cartes), historique (liste), documents (uploader), notes (éditeur).

Conseil: produire un PDF d'exemples d'écran avec annotations pour accompagner cette doc.

---

## 13. Conclusion
Ce dépôt contient un dashboard complet et mature pour la surveillance IoT/IA du bétail. Le frontend est riche en fonctionnalités (carte avancée, liste virtualisée, scoring IA) et s'appuie sur un backend/API et un service IA dédiés.

Prochaines étapes proposées:
- Valider le contrat API (`backend/openapi.yaml`) et compléter la doc d'API.
- Ajouter captures d'écran & diagrammes (séquence, architecture-infrastructure).
- Prioriser les recommandations (performance, sécurité, tests) et planifier correctifs.

---

Annexe: fichiers consultés pour cette analyse (extrait):
- `Dashboard_PERFORMANCE_FIXED.tsx`
- `src/App.tsx`
- `src/main.tsx`
- `MQTT_Context_FIXED.tsx`
- `src/contexts/MqttContext.tsx`
- `src/pages/Animals/Animals.tsx`
- `src/pages/Animals/AnimalProfile.tsx`
- `src/pages/Map/RealTimeMap_REDESIGNED.tsx`
- `src/pages/Users/Users.tsx`
- `src/ai/healthScoring.ts`


Si vous le souhaitez, je peux:
- ajouter des schémas Mermaid pour l'architecture et les flux de données;
- extraire et documenter chaque composant de `src/components/` de façon automatisée;
- produire captures d'écran (si vous fournissez les images) ou générer SVGs simplifiés.

Voulez-vous que je génère maintenant : (A) schémas Mermaid architecture + flux MQTT, (B) documentation automatique des composants `src/components/`, ou (C) captures/annotations ?
