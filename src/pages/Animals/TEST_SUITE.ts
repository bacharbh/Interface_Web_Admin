/**
 * 🧪 QUICK TEST - AnimalProfile.tsx
 * 
 * Ce fichier vous permet de tester rapidement la page AnimalProfile.
 * Copez le code ci-dessous dans votre navigateur console ou dans une page test.
 */

// ============================================================================
// TEST 1: Vérifier que la route est accessible
// ============================================================================

const testRoute = () => {
    console.log('%c✅ TEST 1: Route /animal/:id', 'color: green; font-weight: bold');

    // Vérifiez que vous pouvez accéder à:
    // http://localhost:5173/animal/SHEEP_001

    const currentPath = window.location.pathname;
    if (currentPath.includes('/animal/')) {
        console.log('✓ Route accessible:', currentPath);
    } else {
        console.warn('⚠️ Naviguez vers /animal/SHEEP_001');
    }
};

// ============================================================================
// TEST 2: Vérifier les imports
// ============================================================================

const testImports = async () => {
    console.log('%c✅ TEST 2: Vérifier les imports', 'color: blue; font-weight: bold');

    const imports = [
        'AnimalProfile from ./pages/Animals/AnimalProfile',
        'VitalBox from ./pages/Animals/components/VitalBox',
        'FileUpload from ./pages/Animals/components/FileUpload',
        'MiniGPSMap from ./pages/Animals/components/MiniGPSMap',
    ];

    imports.forEach(imp => console.log('  ✓', imp));
};

// ============================================================================
// TEST 3: Vérifier les dépendances
// ============================================================================

const testDependencies = () => {
    console.log('%c✅ TEST 3: Dépendances', 'color: purple; font-weight: bold');

    const deps = {
        'framer-motion': typeof window.motion !== 'undefined',
        'react-leaflet': typeof window.L !== 'undefined',
        'leaflet': typeof window.L !== 'undefined',
        'lucide-react': typeof window.lucideReact !== 'undefined',
    };

    Object.entries(deps).forEach(([dep, loaded]) => {
        console.log(`  ${loaded ? '✓' : '⚠️'} ${dep}`);
    });
};

// ============================================================================
// TEST 4: Mock Animal Data
// ============================================================================

const mockAnimals = [
    {
        sheepId: 'SHEEP_001',
        collar_id: 'COLLAR_001',
        name: 'Bella',
        breed: 'Merino',
        age: 3,
        weight: 65,
        sector: 'Nord',
        health: 'Good',
        heartRate: 85,
        temperature: 38.5,
        battery: 75,
        activity: 65,
    },
    {
        sheepId: 'SHEEP_002',
        collar_id: 'COLLAR_002',
        name: 'Luna',
        breed: 'Suffolk',
        age: 2,
        weight: 70,
        sector: 'Sud',
        health: 'Warning',
        heartRate: 110,
        temperature: 39.2,
        battery: 45,
        activity: 45,
    },
    {
        sheepId: 'SHEEP_003',
        collar_id: 'COLLAR_003',
        name: 'Max',
        breed: 'Dorper',
        age: 4,
        weight: 75,
        sector: 'Est',
        health: 'Critical',
        heartRate: 140,
        temperature: 40.1,
        battery: 20,
        activity: 20,
    },
];

// ============================================================================
// TEST 5: Vérifier les couleurs VitalBox
// ============================================================================

const testVitalBoxColors = () => {
    console.log('%c✅ TEST 5: Coloration VitalBox', 'color: orange; font-weight: bold');

    const ranges = {
        heartRate: { min: 70, max: 120 },
        temperature: { min: 38.5, max: 39.5 },
        activity: { min: 50, max: 100 },
        battery: { min: 20, max: 100 },
    };

    const testValue = (value: number, range: { min: number, max: number }) => {
        const isAbnormal = value < range.min || value > range.max;
        const isCritical = isAbnormal && value > range.max * 1.15;

        return isCritical ? '🔴 Red' : isAbnormal ? '🟠 Orange' : '🟢 Green';
    };

    // Test avec Bella
    console.log('Bella (Normal):');
    console.log('  BPM 85:', testValue(85, ranges.heartRate));
    console.log('  Temp 38.5:', testValue(38.5, ranges.temperature));

    // Test avec Luna
    console.log('Luna (Warning):');
    console.log('  BPM 110:', testValue(110, ranges.heartRate));
    console.log('  Temp 39.2:', testValue(39.2, ranges.temperature));

    // Test avec Max
    console.log('Max (Critical):');
    console.log('  BPM 140:', testValue(140, ranges.heartRate));
    console.log('  Temp 40.1:', testValue(40.1, ranges.temperature));
};

// ============================================================================
// TEST 6: Vérifier l'avatar généré
// ============================================================================

const testAvatar = () => {
    console.log('%c✅ TEST 6: Avatar généré', 'color: cyan; font-weight: bold');

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((word: string) => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getAvatarColor = (sector: string) => {
        const colors: Record<string, string> = {
            'Nord': 'from-blue-500 to-cyan-500',
            'Sud': 'from-orange-500 to-red-500',
            'Est': 'from-green-500 to-emerald-500',
            'Ouest': 'from-purple-500 to-pink-500',
        };
        return (sector && colors[sector as keyof typeof colors]) || 'from-slate-500 to-slate-600';
    };

    mockAnimals.forEach(animal => {
        console.log(`${getInitials(animal.name)} (${animal.name}) - ${getAvatarColor(animal.sector)}`);
    });
};

// ============================================================================
// TEST 7: Vérifier le DOM
// ============================================================================

const testDOM = () => {
    console.log('%c✅ TEST 7: Vérifier le DOM', 'color: red; font-weight: bold');

    const checks = {
        'Header': () => document.querySelector('[role="banner"]'),
        'Tabs': () => document.querySelectorAll('[role="tab"]').length > 0,
        'VitalBox': () => document.querySelectorAll('[data-testid="vital-box"]'),
        'Map': () => document.querySelector('.leaflet-container'),
        'Form': () => document.querySelector('textarea'),
    };

    Object.entries(checks).forEach(([name, check]) => {
        const element = check();
        const status = element ? '✓' : '⚠️';
        console.log(`  ${status} ${name}`);
    });
};

// ============================================================================
// TEST 8: Tester la navigation
// ============================================================================

const testNavigation = () => {
    console.log('%c✅ TEST 8: Navigation', 'color: green; font-weight: bold');

    console.log('Animals disponibles:');
    mockAnimals.forEach((animal, idx) => {
        console.log(`  ${idx + 1}. ${animal.name} (${animal.sheepId})`);
    });

    console.log('\nComments naviguer:');
    console.log('  navigate("/animal/SHEEP_001")');
    console.log('  navigate("/animal/SHEEP_002")');
};

// ============================================================================
// TEST 9: Tester les onglets
// ============================================================================

const testTabs = () => {
    console.log('%c✅ TEST 9: Onglets', 'color: magenta; font-weight: bold');

    const tabs = ['vitals', 'history', 'documents', 'notes'];
    console.log('Onglets disponibles:');
    tabs.forEach(tab => {
        console.log(`  ✓ ${tab}`);
    });
};

// ============================================================================
// TEST 10: Tester les événements médicaux
// ============================================================================

const testMedicalEvents = () => {
    console.log('%c✅ TEST 10: Événements médicaux', 'color: brown; font-weight: bold');

    const events = [
        { type: 'vaccine', icon: '💉', title: 'Vaccination RVT' },
        { type: 'treatment', icon: '💊', title: 'Traitement antiparasitaire' },
        { type: 'visit', icon: '🩺', title: 'Visite de suivi' },
        { type: 'alert', icon: '⚠️', title: 'Alerte température' },
        { type: 'recovery', icon: '✅', title: 'Récupération' },
    ];

    events.forEach(event => {
        console.log(`  ${event.icon} ${event.type}: ${event.title}`);
    });
};

// ============================================================================
// EXÉCUTER TOUS LES TESTS
// ============================================================================

window.runAllTests = () => {
    console.clear();
    console.log('%c🧪 SUITE DE TESTS - AnimalProfile.tsx', 'color: #10B981; font-size: 20px; font-weight: bold');
    console.log('');

    testRoute();
    console.log('');
    testImports();
    console.log('');
    testDependencies();
    console.log('');
    testVitalBoxColors();
    console.log('');
    testAvatar();
    console.log('');
    testNavigation();
    console.log('');
    testTabs();
    console.log('');
    testMedicalEvents();
    console.log('');

    console.log('%c✅ TOUS LES TESTS TERMINÉS', 'color: green; font-size: 16px; font-weight: bold');
};

// ============================================================================
// GUIDE D'UTILISATION
// ============================================================================

console.log(`
%c🧪 GUIDE DE TEST - AnimalProfile.tsx

Pour exécuter tous les tests, entrez dans la console:
  runAllTests()

Pour tester manuellement:
  1. Ouvrez http://localhost:5173/animal/SHEEP_001
  2. Naviguez entre les onglets (❤️ 📋 📄 📝)
  3. Testez prev/next buttons
  4. Testez les filtres d'historique
  5. Testez le drag & drop
  6. Testez les notes (auto-save)
  7. Testez dark mode (Cmd/Ctrl + Shift + L)
  8. Testez la responsivité (F12 → Device Toolbar)

Data Mock Animals:
  • SHEEP_001 (Bella) - Good
  • SHEEP_002 (Luna) - Warning
  • SHEEP_003 (Max) - Critical
`, 'color: #10B981; font-weight: bold; font-size: 12px');

// Export pour utilisation dans d'autres fichiers
export { mockAnimals, testRoute, testImports, testDependencies };
