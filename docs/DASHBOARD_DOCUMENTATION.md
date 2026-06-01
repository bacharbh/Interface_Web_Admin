# Documentation — Dashboard Smart Shepherd

## Vue d'ensemble
Ce dépôt contient une interface web de supervision (dashboard) pour le projet Smart Shepherd. Le frontend est une application TypeScript + React (Vite). Le backend (API) et un service IA sont présents dans les dossiers `backend/` et `ai-service/`.

## Objectifs
- Visualiser la télémétrie et les performances des dispositifs.
- Fournir des vues d'analyse (performance, santé, cartes).
- Intégrer des services IA pour détection/insights.

## Prérequis
- Node.js (>=16 / recommandé 18+)
- npm ou yarn
- Docker & docker-compose (pour déploiement conteneurisé)
- Python 3.8+ (si vous exécutez `ai-service` localement)

## Installation (développement)
1. Installer les dépendances frontend:

```bash
npm install
```

2. Lancer le serveur de développement Vite:

```bash
npm run dev
```

3. Backend local (dossier `backend/`):
- Consulter `backend/README.md` pour instructions spécifiques; typiquement `npm install` puis `npm start`.

4. AI service (facultatif):

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
python app/main.py
```

## Démarrage avec Docker
Pour lancer l'ensemble (frontend + backend + ai-service) via Docker Compose:

```bash
docker-compose up --build
```

ou pour la production:

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

## Structure clé du projet
- [Dashboard_PERFORMANCE_FIXED.tsx](../Dashboard_PERFORMANCE_FIXED.tsx#L1) — Vue de performance principale (fichier racine).
- [src/App.tsx](../src/App.tsx#L1) — Point d'entrée React (app principal).
- [src/main.tsx](../src/main.tsx#L1) — Bootstrap Vite + React.
- [index.html](../index.html#L1) — Page HTML principale.
- [backend/openapi.yaml](../backend/openapi.yaml#L1) — Spécification OpenAPI pour l'API.
- [docker-compose.yml](../docker-compose.yml#L1) — Orchestration locale.
- [package.json](../package.json#L1) — Scripts et dépendances frontend.
- [vitest.config.ts](../vitest.config.ts#L1) — Configuration des tests unitaires.

> Remarque: les liens ci-dessus pointent vers les fichiers sources les plus pertinents pour le dashboard.

## Architecture et flux de données
- Frontend (Vite + React + TypeScript) consomme l'API exposée par `backend/server.js`.
- Les flux temps réel (si utilisés) passent par MQTT/WS (consulter `MQTT_Context_FIXED.tsx`).
- `ai-service` fournit des endpoints ML séparés ou est appelé par le backend pour inférences.

## Composants et pages importants
- Vue Performance: `Dashboard_PERFORMANCE_FIXED.tsx` — métriques, graphiques et tendances.
- Contextes: `MQTT_Context_FIXED.tsx` — abonne et distribue les messages MQTT dans l'app.
- Pages et composants UI: consulter `src/pages/` et `src/components/`.

## Variables d'environnement
- Frontend: configurez `.env` ou variables Vite (`VITE_API_BASE_URL`, `VITE_MQTT_URL` si présent).
- Backend: variables dans `backend/` (ex: `PORT`, `REDIS_URL`).

## Tests
- Tests unitaires front: `npm run test` (vitest).
- Linter/format: exécuter les scripts définis dans `package.json`.

## Déploiement
- Pour déploiement en prod, utiliser `docker-compose.prod.yml` et config nginx (`nginx.conf`).
- CI/CD: ajouter étapes de build frontend (`npm run build`) puis déployer images Docker.

## Dépannage rapide
- Erreurs de build frontend: supprimer `node_modules` et réinstaller `npm ci` ou `npm install`.
- Problèmes d'API: vérifier `backend/logs/` et `backend/openapi.yaml` pour routes.
- Service IA: vérifier que `ai-service` a installé ses dépendances Python.

## Ressources et lectures
- Document principal: [README.md](../README.md#L1)
- Spécification API: [backend/openapi.yaml](../backend/openapi.yaml#L1)
- Diagramme ER / docs: consulter `docs/` et `docs/PROJECT_DOCUMENTATION.md` si présent.

## Contact & contribution
Pour contribuer, ouvrir une issue ou une Pull Request. Décrire clairement le bug ou la fonctionnalité et la branche ciblée.

---

_Petite note_: Ce document est un point de départ; je peux l'étendre (guide d'architecture détaillé, explications des composants, captures d'écran, ou ajouter des exemples d'utilisation). Dites-moi ce que vous voulez approfondir.
