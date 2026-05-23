# AnimalProfile.tsx - Page de Profil Animal

## 📋 Vue d'ensemble
`AnimalProfile.tsx` est une page détaillée et complète pour visualiser le profil d'un animal spécifique dans Smart Shepherd. Elle offre une expérience multi-onglets avec des données temps réel, historique médical, documents, notes et positionnement GPS.

## 📍 Route
```
/animal/:id
```
Exemple: `/animal/SHEEP_001`

## 🎨 Composants Principaux

### 1. **AnimalProfile.tsx** (Composant Principal)
Charge tous les sous-composants et gère:
- Navigation prev/next entre animaux
- Gestion des onglets actifs
- État des notes avec sauvegarde automatique
- Historique médical avec filtrage
- Gestion des documents

#### Props dynamiques:
- **animal**: Récupéré depuis le store IoT par l'ID
- **Animals**: Liste complète pour navigation
- **lastUpdate**: Timestamp mis à jour en temps réel

### 2. **VitalBox.tsx** - Affichage des Vitaux
Affiche les signes vitaux (BPM, Température, Activité, Batterie) dans une grille 2x2.

**Caracteristiques:**
- Coloration dynamique selon plage normale:
  - ✅ **Vert** (#1D9E75): Valeur normale
  - ⚠️ **Orange** (#EF9F27): Anormal (léger dépassement)
  - 🔴 **Rouge** (#E24B4A): Critique (dépassement > 15%)
- Barre de progression colorée
- Affichage de la plage normale en texte
- Icône du type de vital

**Props:**
```typescript
interface VitalBoxProps {
  label: string;           // "BPM", "Température", etc.
  value: number;           // Valeur actuelle
  unit: string;            // "BPM", "°C", "%"
  range: { min: number; max: number };
  icon: React.ReactNode;   // Icône lucide-react
}
```

### 3. **FileUpload.tsx** - Drag & Drop pour Documents
Zone d'upload avec drag-and-drop et sélection manuelle.

**Caractéristiques:**
- Zone drag-and-drop interactive
- Affichage de la liste des fichiers
- Limite de taille (10 MB par défaut)
- Support formats: PDF, images, documents
- Suppression individuelle de fichiers

### 4. **MiniGPSMap.tsx** - Carte Leaflet
Affiche les 24 dernières heures de positionnement GPS.

**Caractéristiques:**
- Tracé de la ligne de mouvement (pointillée)
- Points historiques (fading)
- Position actuelle surlignée (marqueur vert)
- Popup au clic pour détails
- Zoom/pan automatique
- Hauteur fixe: 140px

## 🗂️ Structure des Onglets

### Onglet "Vitaux" ❤️
```
├── Grille VitalBox 2x2
│   ├── VitalBox BPM (70-120)
│   ├── VitalBox Température (38.5-39.5°C)
│   ├── VitalBox Activité (50-100%)
│   └── VitalBox Batterie (20-100%)
└── Graphique Chart.js (7j / 30j toggle)
    ├── Ligne BPM
    └── Ligne Température
```

### Onglet "Historique" 📋
```
├── Chips de filtrage
│   ├── Tous
│   ├── 💉 Vaccin
│   ├── 💊 Traitement
│   ├── 🩺 Visite
│   ├── ⚠️ Alerte
│   └── ✅ Récupération
└── Timeline verticale
    └── MedicalEvent[]
        ├── date, type, title, description, veterinarian
```

**Types d'événements:**
```typescript
type EventType = 'vaccine' | 'treatment' | 'visit' | 'alert' | 'recovery';

interface MedicalEvent {
  id: string;
  date: string;              // ISO timestamp
  type: EventType;
  title: string;
  description: string;
  veterinarian?: string;     // Optionnel
}
```

### Onglet "Documents" 📄
```
├── FileUpload (Drag & Drop)
└── Documents List
    └── Document[]
        ├── name, type, uploadedAt, size
        └── Actions: Download, Delete
```

**Interface Document:**
```typescript
interface Document {
  id: string;
  name: string;
  type: string;              // "pdf", "image", etc.
  uploadedAt: string;        // ISO timestamp
  size: number;              // bytes
  url?: string;              // pour download/preview
}
```

### Onglet "Notes" 📝
```
├── Textarea éditable
├── Sauvegarde auto (debounce 1000ms)
└── Timestamp de dernière modification
```

## 🎨 Styling & Animations

### Transitions
- **Tab change**: fade + slide-up via Framer Motion
- **Drag & Drop**: border highlight
- **Hover states**: shadow elevation

### Dark Mode
Support complet avec classes `dark:`

## 📊 Données Mock Incluses
```javascript
// Historique médical (5 événements)
- Vaccination RVT (5j passés)
- Traitement antiparasitaire (2j passés)
- Visite de suivi (1j passé)
- Alerte température élevée (12h passées)
- Récupération confirmée (maintenant)

// Documents (2 fichiers)
- Ordonnance_Antibiotique_2024.pdf
- Certificat_Santé_Animal.pdf

// Points GPS (14 positions, 24h)
```

## 🔗 Intégrations

### Store IoT (`useIoTStore`)
```typescript
const { animals } = useIoTStore();
// Récupère la liste complète des animaux pour:
// 1. Navigation prev/next
// 2. Recherche par ID
// 3. Données temps réel
```

### Context Thème
```typescript
const { theme } = useTheme();
// Gère dark/light mode
```

### Routing
```typescript
const { id } = useParams<{ id: string }>();
const navigate = useNavigate();

// Navigation prev/next via:
navigate(`/animal/${prevId}`);
navigate(`/animal/${nextId}`);
```

## 🎯 Fonctionnalités Clés

### 1. Navigation Inter-Animaux
```
[◀] Animal 1/5 [▶]
```
- Flèches prev/next disabled aux extrémités
- Numérotation en temps réel
- Lien profond avec ID unique

### 2. Avatar Généré
```typescript
// Initiales sur fond coloré par secteur
const getAvatarColor = (sector?: string) => {
  // Nord → Bleu, Sud → Orange, Est → Vert, Ouest → Violet
}
```

### 3. Badge Sévérité Dynamique
```
Normal (vert) | Warning (orange) | Critical (rouge)
```

### 4. Notes Auto-Save
```typescript
// Debounce 1000ms sur chaque changement
// Timestamp de dernière modification visible
```

### 5. Timeline Filtrable
```
Affiche/cache événements par type
avec animations de transition
```

### 6. Mini-Map GPS
```
// 24 dernières heures
- Tracé pointillé en vert
- Points fading (historique)
- Marqueur surlignié (position actuelle)
- Popup avec détails au clic
```

## 📱 Responsive Design
- Desktop: Pleine largeur
- Tablet: Adaptatif
- Mobile: Optimisé (cartes 1 col, sidebar collapsible)

## 🔄 Flux de Données

```
┌─────────────────────────────────────┐
│      useParams({ id })              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    useIoTStore (animals list)        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Find animal by id                 │
│   (sheepId ou collar_id)            │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  ┌─ Render UI with animal data       │
│  ├─ VitalBox (BPM, Temp, etc.)      │
│  ├─ Chart.js graph (7j/30j)         │
│  ├─ Timeline (filtered events)       │
│  ├─ Documents list                   │
│  ├─ Editable notes                   │
│  └─ GPS map (24h trail)             │
└──────────────────────────────────────┘
```

## 🐛 Dépannage

### Animal non trouvé
```
✓ Vérifier l'ID dans la URL
✓ Vérifier que useIoTStore retourne les animaux
✓ Affiche un message "Animal non trouvé" avec bouton retour
```

### Map Leaflet ne s'affiche pas
```
✓ Vérifier react-leaflet et leaflet installations
✓ Vérifier suppression de l'icône par défaut (déjà fait)
✓ Vérifier que gpsPoints ne sont pas vides
```

### Notes ne sauvegardent pas
```
✓ Actuellement sauvegarde est mock (debounce seulement)
✓ À connecter avec API backend: POST /api/animals/:id/notes
```

## 📦 Dépendances

- ✅ `react` & `react-dom` v18+
- ✅ `react-router-dom` v6+
- ✅ `framer-motion` (pour animations)
- ✅ `react-leaflet` v4+ (pour carte GPS)
- ✅ `leaflet` v1.9+
- ✅ `lucide-react` (pour icônes)

Toutes les dépendances sont déjà présentes dans le projet.

## 🚀 Prochaines Étapes

1. **Connecter le backend**
   - GET `/api/animals/:id` pour données actualisées
   - POST `/api/animals/:id/notes` pour sauvegarde notes
   - GET `/api/animals/:id/medical-history` pour historique
   - POST `/api/animals/:id/documents` pour upload

2. **Ajouter Chart.js**
   - Graphique temps réel BPM + Température
   - Toggle 7j/30j
   - Annotations pour événements critiques

3. **Améliorer GPS**
   - Animation fluide du tracé
   - Heatmap de zones fréquentées
   - Alertes géofence en surimpression

4. **Notifications**
   - Toast pour actions (save, upload)
   - Real-time updates pour vitaux
   - Alerts critiques

## 📄 Licence
MIT - Smart Shepherd 2024
