# Smart Shepherd - Audit de suppression simulation/mock

Date: 2026-05-30

## Nettoyage applique

### Frontend (mode donnees reelles)
- Desactivation du mode simulation dans le contexte MQTT.
- Suppression des badges/labels visuels "SIMULATION".
- Suppression des controles simulation dans la carte et les parametres.
- Suppression des fallbacks GPS hardcodes dans la mini-carte.
- IA dashboard: suppression des predictions simulees locales; retour vers etats vides.
- Message no-data standardise: "Aucune donnee disponible".

Fichiers modifies:
- src/contexts/MqttContext.tsx
- src/hooks/useIoTStore.ts
- src/components/ui/LiveBadge.tsx
- src/components/layout/AppLayout.tsx
- src/pages/Dashboard/Dashboard.tsx
- src/pages/Map/MapControls.tsx
- src/pages/Map/RealTimeMap.tsx
- src/pages/Map/MapMonitor.tsx
- src/pages/Settings/Settings.tsx
- src/components/widgets/MiniMapWidget.tsx
- src/components/widgets/MiniMapPreview.tsx
- src/components/ui/MqttIndicator.tsx
- .env.development
- .env.example

### Backend/API
- Suppression des reponses mock hardcodees du copilot backend.
- Fallback IA backend: plus de predictions inventees (liste vide / indisponible).
- Suppression du helper meteo aleatoire de simulation.
- Route telemetry: suppression wording placeholder.

Fichiers modifies:
- backend/services/copilotService.js
- backend/services/aiHealthPrediction.js
- backend/services/weatherService.js
- backend/routes/telemetry.js

### AI service Python
- Endpoints: suppression des features mock battery et logique demo position.
- Modeles: suppression des modes mock explicites, erreur explicite si modele indisponible.

Fichiers modifies:
- ai-service/app/api/endpoints.py
- ai-service/app/models/battery_xgb.py
- ai-service/app/models/health_lstm.py

### Donnees fictives/scripts
- Scripts de generation de test data supprimes.
- Script backend mock AI supprime.
- Scripts de seed desactives dans package scripts.

Fichiers modifies/supprimes:
- package.json (scripts seed supprimes)
- backend/package.json (scripts seed supprimes)
- scripts/createAITestData.js (supprime)
- scripts/createAITestData.cjs (supprime)
- backend/services/test_ai_mock.py (supprime)

## Elements restants contenant simulation/mock/fake (a nettoyer definitivement)

### Frontend
- src/utils/simulation.ts
- src/utils/simulation_FIXED.ts
- src/utils/enhancedSimulation.ts
- src/utils/authStorage.ts (DEV_MOCK_USER)
- src/stories/Page.tsx (storybook mock content)

### Backend
- backend/src/seeds/seedUsers.ts
- backend/src/seeds/seedAnimals.ts
- backend/src/seeds/seedAlerts.ts
- backend/services/briefingService.js (commentaire demo)

### AI service
- ai-service/app/services/active_learning.py (Mocking trigger)
- ai-service/app/scripts/synthetic_data.py
- ai-service/app/scripts/train_model.py

### Firmware/lab
- firmware/esp32-collar-ml/src/test_harness.cpp (mock telemetry)

## Recommendation de cloture
- Supprimer physiquement les fichiers de simulation non utilises (notamment src/utils/simulation*.ts et backend/src/seeds/*) apres validation qu'aucune importation runtime ne subsiste.
- Garder les elements tests/lab uniquement dans un dossier de tests isole non charge en production.
- Ajouter un controle CI qui echoue si des mots-cles interdits apparaissent dans le runtime app (simulation/mock/fake/dummy/seed/synthetic).
