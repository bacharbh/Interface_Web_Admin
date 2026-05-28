# Smart Shepherd - Reports & Analytics Module Documentation

## 📊 Module Overview

Le module de rapports et analytics avancé pour Smart Shepherd permet de générer des rapports PDF automatiques, d'exporter des données en Excel, et de visualiser des analytics avancés avec des graphiques interactifs.

## 🎯 Fonctionnalités Implémentées

### 1. **Génération de Rapports PDF (Backend)**

#### Rapport Hebdomadaire
- **Endpoint**: `POST /api/reports/weekly`
- **Paramètres**: `startDate`, `endDate` (format ISO 8601)
- **Contenu**:
  - Résumé général (animaux actifs, enregistrements télémétrie)
  - Aperçu santé (FC moyenne, température, batterie)
  - Analyse d'activité (distribution par type)
  - Alertes et anomalies (FC, température, batterie)

#### Rapport Mensuel
- **Endpoint**: `POST /api/reports/monthly`
- **Paramètres**: `year`, `month`
- **Contenu**: Tout le rapport hebdomadaire + tendances mensuelles

#### Rapport Vétérinaire par Animal
- **Endpoint**: `POST /api/reports/veterinary/:sheepId`
- **Paramètres**: `sheepId`, `startDate`, `endDate`
- **Contenu**:
  - Informations de l'animal (ID, race, âge, poids, etc.)
  - Données de santé détaillées
  - Alertes et anomalies spécifiques
  - Recommandations vétérinaires

### 2. **Export Excel (Frontend)**

#### Export Données Santé
- **Service**: `exportHealthDataToExcel()`
- **Colonnes**: ID Animal, ID Appareil, Date/Heure, FC, Température, Batterie, Activité, Signal, Pas, Vitesse, Cap, Latitude, Longitude
- **Feuilles**: Données brutes + Résumé

#### Export Analytics
- **Service**: `exportAnalyticsDataToExcel()`
- **Colonnes**: ID Animal, Date, FC Moyenne, Température Moyenne, Batterie Moyenne, Total Pas, Vitesse Moyenne, Activité Principale
- **Feuilles**: Analytics principal + une feuille par animal

### 3. **Dashboard Analytics Avancé**

#### Vue d'ensemble
- **Tendances Santé**: Graphique composé (FC + température)
- **Distribution Activité**: Bar chart des pas par jour
- **Tendances Batterie**: Area chart de l'évolution batterie
- **Analyse Vitesse**: Line chart de la vitesse moyenne

#### Heatmap GPS
- **Visualisation**: Scatter chart des positions GPS
- **Légende**: Pâturage (vert), Repos (bleu)
- **Intensité**: Opacité basée sur la fréquence

#### Corrélation Activité/Santé
- **FC vs Activité**: Scatter chart FC / Total Pas
- **Température vs Activité**: Scatter chart Température / Total Pas
- **Résumé Global**: Statistiques agrégées

## 📁 Structure des Fichiers

### Backend
```
backend/
├── services/
│   └── reportGenerator.js          # Service génération PDF (PDFKit)
├── routes/
│   └── reports.js                   # API routes rapports
└── models/
    ├── TelemetryData.js            # Modèle télémétrie
    └── Sheep.js                     # Modèle animaux
```

### Frontend
```
src/
├── services/
│   └── excelExport.ts               # Service export Excel (SheetJS)
├── pages/
│   └── Analytics/
│       └── Analytics.tsx            # Dashboard analytics
└── pages/
    └── Animals/
        └── AnimalDetail.tsx         # Page détail animal + export rapport
```

## 🔧 Dépendances

### Backend
```json
{
  "pdfkit": "^0.18.0",
  "blob-stream": "^0.1.3",
  "date-fns": "^2.30.0"
}
```

### Frontend
```json
{
  "xlsx": "^0.18.5",
  "recharts": "^2.10.0"
}
```

## 🚀 Utilisation

### Backend - Démarrage du Serveur

```bash
cd backend
npm install
node server.js
```

### Frontend - Démarrage du Dev Server

```bash
npm run dev
```

### Exemples d'API

#### Générer un rapport hebdomadaire
```bash
curl -X POST http://localhost:5000/api/reports/weekly \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "startDate": "2026-04-15",
    "endDate": "2026-04-22"
  }'
```

#### Exporter les données de santé
```bash
curl "http://localhost:5000/api/reports/export/health-data?startDate=2026-04-15&endDate=2026-04-22" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Dashboard Analytics

### Accès
1. Connectez-vous à l'application
2. Cliquez sur "Analytics" dans la barre latérale
3. Sélectionnez la plage de dates
4. Choisissez la vue (Vue d'ensemble, Heatmap GPS, Corrélation)

### Fonctionnalités
- **Sélecteur de dates**: Pour filtrer les données par période
- **Export Excel**: Boutons pour exporter les données
- **Rapport PDF**: Téléchargement direct du rapport hebdomadaire
- **Rafraîchissement**: Bouton pour recharger les données

### Export Rapport Vétérinaire
1. Allez sur la page "Troupeau"
2. Cliquez sur un animal
3. Cliquez sur "Rapport Vétérinaire"
4. Le PDF est généré et téléchargé automatiquement

## ⚠️ Notes Importantes

### ES Module Compatibility
Le backend utilise ES modules (`"type": "module"` dans package.json). Tous les fichiers doivent utiliser la syntaxe ES6:
- `import` au lieu de `require`
- `export` au lieu de `module.exports`

### MongoDB Requis
Les rapports nécessitent une connexion MongoDB pour récupérer les données de télémétrie et d'animaux.

### Données de Test
Pour tester sans données réelles, utilisez le script:
```bash
node scripts/createAITestData.cjs
```

## 🔍 Dépannage

### Erreur: "already been declared"
Vérifiez qu'il n'y a pas de déclarations dupliquées dans les fichiers ES modules.

### Erreur: Module not found
Assurez-vous que tous les imports utilisent l'extension `.js`:
```javascript
import ReportGenerator from './services/reportGenerator.js'; // ✅
import ReportGenerator from './services/reportGenerator'; // ❌
```

### Backend ne démarre pas
1. Vérifiez que MongoDB est en cours d'exécution
2. Vérifiez les variables d'environnement (.env)
3. Consultez les logs dans le dossier `backend/logs/`

## 📈 Roadmap

### Fonctionnalités Futures
- [ ] Rapports personnalisables (sélection des sections)
- [ ] Scheduling automatique des rapports
- [ ] Envoi par email des rapports
- [ ] Graphiques plus avancés (3D, animations)
- [ ] Comparaison entre périodes
- [ ] Alertes basées sur les analytics
- [ ] Export CSV/JSON
- [ ] Templates de rapports personnalisés

## 🎨 Personnalisation

### Styles des Rapports PDF
Modifiez les couleurs et polices dans `reportGenerator.js`:
```javascript
doc.fontSize(24).fillColor('#16a34a').text('🐑 Smart Shepherd', 50, 50);
```

### Graphiques Recharts
Personnalisez les couleurs et styles dans `Analytics.tsx`:
```typescript
const getActivityColor = (activity: string) => {
  const colors = {
    'grazing': '#16a34a',
    'resting': '#3b82f6',
    // ...
  };
  return colors[activity] || '#6b7280';
};
```

## 📞 Support

Pour toute question ou problème, consultez:
- La documentation principale: `PROJECT_DOCUMENTATION.md`
- Le guide de test IA: `AI_TESTING_GUIDE.md`
- Les logs d'erreur: `backend/logs/`

---

**Version**: 1.0.0  
**Date**: 22 Avril 2026  
**Auteur**: Smart Shepherd Team
