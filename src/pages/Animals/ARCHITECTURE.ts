/**
 * 📊 STRUCTURE & ARCHITECTURE - AnimalProfile.tsx
 * 
 * Ce fichier montre la structure complète et l'architecture de la page.
 */

// ============================================================================
// 📁 STRUCTURE DE FICHIERS
// ============================================================================

/*
src/pages/Animals/
├── AnimalProfile.tsx                    ✅ PRINCIPAL (440+ lignes)
│   └─ Contient: Header + 4 Onglets + Footer Map
│
├── components/
│   ├── VitalBox.tsx                     ✅ SOUS-COMPOSANT
│   │   └─ Affichage BPM, Temp, Activité, Batterie
│   │
│   ├── FileUpload.tsx                   ✅ SOUS-COMPOSANT
│   │   └─ Drag & drop upload files
│   │
│   ├── MiniGPSMap.tsx                   ✅ SOUS-COMPOSANT
│   │   └─ Leaflet map + GPS trail
│   │
│   └── index.ts                         ✅ BARREL EXPORT
│       └─ export { VitalBox, FileUpload, MiniGPSMap }
│
├── index.ts                             ✅ PAGE EXPORT
│   └─ export { default } from './AnimalProfile'
│
├── 📚 DOCUMENTATION
│   ├── README_FR.md                     ✅ Guide français complet
│   ├── ANIMAL_PROFILE_README.md         ✅ Docs techniques
│   ├── USAGE_EXAMPLES.ts                ✅ Exemples code
│   ├── VERIFICATION_CHECKLIST.ts        ✅ Checklist test
│   ├── INSTALL_SUMMARY.sh               ✅ Installation
│   ├── INDEX.md                         ✅ Index navigation
│   └── TEST_SUITE.ts                    ✅ Tests automatisés
│
└── 📊 THIS FILE
    └── ARCHITECTURE.ts                  ✅ Structure & types

*/

// ============================================================================
// 🏗️ ARCHITECTURE GÉNÉRALE
// ============================================================================

/*
                    ┌─────────────────────────────────┐
                    │   AnimalProfile.tsx             │
                    │   (Route: /animal/:id)          │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
            ┌───────▼────────┐          ┌─────────────▼──────────┐
            │    useParams   │          │    useIoTStore         │
            │    (animalId)  │          │    (animals list)      │
            └────────────────┘          └────────────────────────┘
                    │                             │
                    └────────────────┬────────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │       Animal Data State        │
                    │  (currentAnimal, vitals, etc)  │
                    └────────────────┬────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
         ┌──────▼──────┐    ┌────────▼────────┐   ┌──────▼──────┐
         │    HEADER   │    │   TABS (4)      │   │   FOOTER    │
         │             │    │                 │   │             │
         │ • Avatar    │    │ • ❤️ Vitaux     │   │ 🗺️ GPS Map  │
         │ • Infos     │    │ • 📋 Historique │   │             │
         │ • Sévérité  │    │ • 📄 Documents  │   │ • Leaflet   │
         │ • Boutons   │    │ • 📝 Notes      │   │ • Trail     │
         │ • Nav       │    │                 │   │ • Markers   │
         └─────────────┘    └─────────────────┘   └─────────────┘
*/

// ============================================================================
// 📋 DONNÉES FLUX (Data Flow)
// ============================================================================

/*
URL: /animal/SHEEP_001
       │
       ▼
useParams() → animalId = "SHEEP_001"
       │
       ▼
useIoTStore() → animals[] = [...]
       │
       ▼
useMemo(find animal) → currentAnimal = Bella
       │
       ├─────────────────┬─────────────────┬─────────────────┐
       │                 │                 │                 │
       ▼                 ▼                 ▼                 ▼
   HEADER          VITAL TAB         HISTORY TAB       DOCUMENTS TAB
       │                │                 │                 │
       ├─ name         ├─ BPM ──►        ├─ events[]  ├─ files[]
       ├─ breed        ├─ Temp           ├─ filtered  ├─ upload
       ├─ sector       ├─ Activity       ├─ timeline  ├─ delete
       ├─ avatar       ├─ Battery        └─ chips
       └─ nav              │
                      └─ Chart.js
                      
       + NOTES TAB
       └─ notes: string
          ├─ onChange (debounce)
          ├─ onSave (POST API)
          └─ lastEdited: timestamp
*/

// ============================================================================
// 🎯 COMPOSANT HIERARCHY
// ============================================================================

/*
AnimalProfile
│
├── Header Component
│   ├── Avatar
│   │   ├── getInitials(name)
│   │   └── getAvatarColor(sector)
│   │
│   ├── Animal Info Box
│   │   ├── Name
│   │   ├── ID
│   │   ├── Breed
│   │   ├── Age
│   │   ├── Weight
│   │   └── Sector
│   │
│   ├── Severity Badge
│   │   └── getSeverityColor(health)
│   │
│   ├── Action Buttons
│   │   ├── Visit
│   │   ├── Report
│   │   └── Archive
│   │
│   └── Navigation Buttons
│       ├── Prev
│       └── Next
│
├── Tab System (Framer Motion)
│   │
│   ├── ❤️ VITALS TAB
│   │   ├── VitalBox x4
│   │   │   ├── BPM
│   │   │   ├── Temperature
│   │   │   ├── Activity
│   │   │   └── Battery
│   │   │
│   │   └── Chart.js (optional)
│   │       └── 7j/30j toggle
│   │
│   ├── 📋 HISTORY TAB
│   │   ├── Filter Chips
│   │   │   ├── All
│   │   │   ├── Vaccine
│   │   │   ├── Treatment
│   │   │   ├── Visit
│   │   │   ├── Alert
│   │   │   └── Recovery
│   │   │
│   │   └── Timeline
│   │       ├── Event 1
│   │       ├── Event 2
│   │       ├── Event 3
│   │       ├── Event 4
│   │       └── Event 5
│   │
│   ├── 📄 DOCUMENTS TAB
│   │   ├── FileUpload Component
│   │   │   ├── Drag & Drop Zone
│   │   │   ├── File Input
│   │   │   └── Validation
│   │   │
│   │   └── File List
│   │       ├── File 1 (download/delete)
│   │       └── File 2 (download/delete)
│   │
│   └── 📝 NOTES TAB
│       ├── Textarea
│       ├── Auto-save (debounce)
│       └── Last Edited Timestamp
│
└── Footer (GPS Map)
    └── MiniGPSMap Component
        ├── Leaflet Container
        ├── TileLayer (OpenStreetMap)
        ├── Polyline (GPS Trail)
        ├── CircleMarkers (Historical Points)
        └── Marker (Current Position)
*/

// ============================================================================
// 🔄 STATE MANAGEMENT
// ============================================================================

/*
const [activeTab, setActiveTab] = useState('vitals')
  └─ Onglet actif (vitals, history, documents, notes)

const [filterEventType, setFilterEventType] = useState('all')
  └─ Filtre timeline (all, vaccine, treatment, visit, alert, recovery)

const [medicalHistory, setMedicalHistory] = useState([...])
  └─ Liste événements médicaux (5 mock events)

const [documents, setDocuments] = useState([...])
  └─ Liste fichiers (2 mock docs)

const [notes, setNotes] = useState('')
  └─ Texte notes éditable

const [notesLastEdited, setNotesLastEdited] = useState(null)
  └─ Timestamp dernière édition

const notesTimeoutRef = useRef(null)
  └─ Reference debounce timeout
*/

// ============================================================================
// 🎨 COULEURS & STYLING
// ============================================================================

/*
┌─────────────────────────────────────────────────────┐
│ VITAUX COLORATION                                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🟢 VERT (#1D9E75) = Normal                         │
│    └─ Valeur dans la plage normale                 │
│                                                     │
│ 🟠 ORANGE (#EF9F27) = Warning                      │
│    └─ Anormal: valeur < min OU value > max         │
│                                                     │
│ 🔴 ROUGE (#E24B4A) = Critical                      │
│    └─ Critique: value > max * 1.15 (15% au-dessus)│
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ AVATAR SECTEUR                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Nord  → from-blue-500 to-cyan-500       🔵 Bleu   │
│ Sud   → from-orange-500 to-red-500      🟠 Orange │
│ Est   → from-green-500 to-emerald-500   🟢 Vert   │
│ Ouest → from-purple-500 to-pink-500     🟣 Violet │
│                                                     │
└─────────────────────────────────────────────────────┘
*/

// ============================================================================
// 📱 RESPONSIVE DESIGN
// ============================================================================

/*
MOBILE (< 640px)
┌─────────────────────────┐
│ [Avatar]               │
│ Name | id              │
│ ┌──────────────────┐   │
│ │ Nav | Buttons   │   │
│ └──────────────────┘   │
│ [1x4 Tabs]             │
│ ┌──────────────────┐   │
│ │ Vital Box 1      │   │
│ ├──────────────────┤   │
│ │ Vital Box 2      │   │
│ ├──────────────────┤   │
│ │ Vital Box 3      │   │
│ ├──────────────────┤   │
│ │ Vital Box 4      │   │
│ └──────────────────┘   │
│ [Map 100% x 140px]     │
└─────────────────────────┘

TABLET (640px - 1024px)
┌──────────────────────────────────┐
│ [Avatar] Name | id | Buttons     │
│ ┌──────────────────────────────┐ │
│ │   Nav                        │ │
│ └──────────────────────────────┘ │
│ [4 Tabs]                         │
│ ┌────────────┬────────────┐      │
│ │ Vital Box  │ Vital Box  │      │
│ ├────────────┼────────────┤      │
│ │ Vital Box  │ Vital Box  │      │
│ └────────────┴────────────┘      │
│ [Map 100% x 140px]               │
└──────────────────────────────────┘

DESKTOP (> 1024px)
┌───────────────────────────────────────────────────┐
│ [Avatar] Name | Race | Age | Weight | Sector     │
│ ┌─────────────────────────────────────────────┐  │
│ │ Severity Badge     [Visit] [Report] [Arch]  │  │
│ └─────────────────────────────────────────────┘  │
│ Prev [4 Tabs] Next                               │
│ ┌──────────┬──────────┬──────────┬──────────┐   │
│ │VitalBox  │VitalBox  │VitalBox  │VitalBox  │   │
│ └──────────┴──────────┴──────────┴──────────┘   │
│ ┌────────────────────────────────────────────┐  │
│ │           Chart.js Vitals (7j/30j)         │  │
│ └────────────────────────────────────────────┘  │
│ ┌─────────────────────────────────────────────┐ │
│ │        Map 100% x 140px                     │ │
│ └─────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
*/

// ============================================================================
// 🚀 PERFORMANCE OPTIMIZATIONS
// ============================================================================

/*
✓ useMemo
  └─ Calcul animal actuel une seule fois
  └─ Filtrage historique une seule fois

✓ useCallback
  └─ Navigation prev/next stabilisée
  └─ Handlers de filtres stabilisés
  └─ Handlers de notes stabilisés

✓ Framer Motion
  └─ AnimatePresence pour transitions onglets
  └─ Layout animations smooth

✓ Code Splitting
  └─ Lazy loading des sous-composants (React.lazy)
  └─ Chargement carte Leaflet à la demande

✓ Debounce
  └─ Auto-save notes: 1000ms debounce
  └─ Évite appels API trop fréquents
*/

// ============================================================================
// 🔐 TYPE SAFETY (TypeScript)
// ============================================================================

/*
interface Animal {
  sheepId: string;
  collar_id: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  sector: 'Nord' | 'Sud' | 'Est' | 'Ouest';
  health: 'Good' | 'Warning' | 'Critical';
  heartRate: number;
  temperature: number;
  battery: number;
  activity: number;
}

interface MedicalEvent {
  id: string;
  date: string;
  type: 'vaccine' | 'treatment' | 'visit' | 'alert' | 'recovery';
  title: string;
  description: string;
  veterinarian?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  size: number;
  url?: string;
}

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: string;
}
*/

// ============================================================================
// 📞 API ENDPOINTS (À CONNECTER)
// ============================================================================

/*
ENDPOINTS REQUIS:

1. GET /api/animals/:id
   └─ Récupère données animal temps réel
   └─ Response: Animal

2. GET /api/animals/:id/medical-history
   └─ Récupère historique médical
   └─ Response: MedicalEvent[]

3. POST /api/animals/:id/notes
   └─ Sauvegarde les notes
   └─ Body: { notes: string }
   └─ Response: { success: boolean, timestamp: string }

4. POST /api/animals/:id/documents
   └─ Upload fichier
   └─ Body: FormData avec fichier
   └─ Response: Document

5. GET /api/animals/:id/gps-trail
   └─ Récupère tracé GPS 24h
   └─ Response: GPSPoint[]

6. GET /api/animals/:id/vitals/chart
   └─ Données pour graphique (7j/30j)
   └─ Params: ?days=7 ou ?days=30
   └─ Response: { timestamps[], bpm[], temperature[] }
*/

// ============================================================================
// 🧪 TESTING
// ============================================================================

/*
TESTS À EFFECTUER:

✓ Rendering
  └─ Component mounts sans erreurs
  └─ All tabs render correctly
  └─ Mock data affiche

✓ Navigation
  └─ Prev/Next buttons fonctionnent
  └─ URL updates avec /animal/:id
  └─ useParams hook récupère ID correct

✓ Tab Functionality
  └─ Switching tabs works
  └─ Content updates per tab
  └─ Animations play correctly

✓ Vitals
  └─ Colors change based on values
  └─ All 4 vitals display
  └─ Progress bars calculate correctly

✓ History
  └─ Events display in timeline
  └─ Filter chips work
  └─ Timestamps format correctly

✓ Documents
  └─ Upload zone responds to drag
  └─ Files display in list
  └─ Delete button removes files

✓ Notes
  └─ Textarea editable
  └─ Auto-save works (check debounce)
  └─ Timestamp updates

✓ Map
  └─ Leaflet loads
  └─ Trail renders
  └─ Markers appear

✓ Responsive
  └─ Mobile layout correct
  └─ Tablet layout correct
  └─ Desktop layout correct

✓ Dark Mode
  └─ Colors invert correctly
  └─ Text readable in both modes
  └─ Theme persists

✓ Accessibility
  └─ Keyboard navigation works
  └─ Screen reader friendly
  └─ ARIA labels present
*/

// ============================================================================
// 📊 MOCK DATA STATISTICS
// ============================================================================

/*
Animals: 3
  • SHEEP_001 (Bella)   - Good
  • SHEEP_002 (Luna)    - Warning
  • SHEEP_003 (Max)     - Critical

Medical Events: 5
  • Vaccination RVT
  • Traitement antiparasitaire
  • Visite de suivi
  • Alerte température
  • Récupération confirmée

Documents: 2
  • Ordonnance_Antibiotique_2024.pdf
  • Certificat_Santé_Animal.pdf

GPS Points: 14 (24 heures simulées)
  • Rayon: ~1.5km
  • Espacement: ~2h
  • Coordonnées: [Latitude, Longitude]
*/

// ============================================================================
// 🎯 DEVELOPMENT CHECKLIST
// ============================================================================

/*
□ Component créé et importé
□ Route ajoutée à App.jsx
□ Tous les sous-composants créés
□ TypeScript compiles sans erreurs
□ npm run dev fonctionne
□ Page accessible à /animal/SHEEP_001
□ Tous les onglets chargent
□ Navigation prev/next fonctionne
□ Dark mode fonctionne
□ Responsivité testée
□ Mock data affiche correctement
□ Pas d'erreurs console
□ Animations fluides
□ Map Leaflet charge
□ Documentation complète

PROCHAINS ÉTAPES:
□ Connecter GET /api/animals/:id
□ Connecter POST /api/animals/:id/notes
□ Implémenter Chart.js
□ Ajouter WebSocket pour temps réel
□ Tester sur appareil réel
□ Déployer en production
*/

export { };
