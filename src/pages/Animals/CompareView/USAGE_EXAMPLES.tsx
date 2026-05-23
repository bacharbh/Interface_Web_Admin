// 🎯 USAGE EXAMPLES - CompareView System
// Exemples de code pour utiliser le système de comparaison

// ============================================================================
// EXEMPLE 1: Sélectionner des animaux depuis Animals.jsx
// ============================================================================

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { useIoTStore } from '../../../hooks/useIoTStore';

function AnimalsExample() {
    const navigate = useNavigate();
    const [selected, setSelected] = useState<string[]>([]);
    const animals: any[] = []; // Placeholder for example

    // Toggle animal selection (max 4)
    const toggleSelection = (animalId: string) => {
        setSelected(prev => {
            if (prev.includes(animalId)) {
                return prev.filter(id => id !== animalId);
            }
            if (prev.length < 4) {
                return [...prev, animalId];
            }
            return prev;
        });
    };

    // Navigate to comparison
    const goToCompare = () => {
        if (selected.length >= 2) {
            navigate(`/compare?ids=${selected.join(',')}`);
            setSelected([]); // Reset
        }
    };

    return (
        <div>
        {/* Checkboxes for each animal */ }
      {
        animals.map(animal => (
            <label key= { animal.collar_id } >
            <input
            type="checkbox"
            checked = { selected.includes(animal.collar_id) }
            onChange = {() => toggleSelection(animal.collar_id)}
    disabled = { selected.length >= 4 && !selected.includes(animal.collar_id) }
        />
        { animal.name }
        </label>
      ))
}

{/* Sticky footer when 2+ selected */ }
{
    selected.length >= 2 && (
        <div className="sticky bottom-0 p-4 bg-white border-t" >
            <p>{ selected.length } animals selected </p>
                < button onClick = { goToCompare } >
                    Compare →
    </button>
        </div>
      )
}
</div>
  );
}

// ============================================================================
// EXEMPLE 2: Récupérer les animaux dans CompareView.tsx
// ============================================================================

// Imports already provided at top

function CompareViewExample() {
    const location = useLocation();

    // Parse IDs from URL
    const animalIds = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('ids')?.split(',').filter(Boolean) || [];
    }, [location.search]);

    // Fetch animals from store
    const devicesMap = useIoTStore(state => state.devices);
    const animals = useMemo(() => {
        return animalIds
            .map((id: string) => devicesMap[id])
            .filter(Boolean);
    }, [animalIds, devicesMap]);

    // Example: /compare?ids=SHEEP_001,SHEEP_002,SHEEP_003
    console.log('Animal IDs:', animalIds);
    // Output: ['SHEEP_001', 'SHEEP_002', 'SHEEP_003']

    console.log('Animals:', animals);
    // Output: [
    //   { collar_id: 'SHEEP_001', name: 'Bella', bpm: 85, ... },
    //   { collar_id: 'SHEEP_002', name: 'Luna', bpm: 110, ... },
    //   { collar_id: 'SHEEP_003', name: 'Max', bpm: 140, ... },
    // ]

    return (
        <div>
        <h1>Comparison: { animals.length } animals </h1>
    {
        animals.map(animal => (
            <div key= { animal.collar_id } >
            { animal.name } — BPM: { animal.bpm }
        </div>
        ))
    }
    </div>
  );
}

// ============================================================================
// EXEMPLE 3: Gérer le graphique comparatif
// ============================================================================

// Imports already provided at top

function ComparisonChartExample() {
    const animals = [
        { collar_id: 'SHEEP_001', name: 'Bella', bpm: 85, temperature: 38.5, activity: 65 },
        { collar_id: 'SHEEP_002', name: 'Luna', bpm: 110, temperature: 39.2, activity: 45 },
    ];

    const [metric, setMetric] = useState<'bpm' | 'temperature' | 'activity'>('bpm');
    const [hiddenAnimals, setHiddenAnimals] = useState<string[]>([]);

    // Define colors
    const ANIMAL_COLORS = ['#1D9E75', '#378ADD', '#EF9F27', '#E24B4A'];

    // Build chart data
    const chartData = {
        labels: ['00:00', '06:00', '12:00', '18:00', '23:59'],
        datasets: animals
            .filter(a => !hiddenAnimals.includes(a.collar_id))
            .map((animal, idx) => ({
                label: `${animal.name} #${animal.collar_id}`,
                data: [70, 75, 80, 85, 90], // Mock data
                borderColor: ANIMAL_COLORS[idx],
                backgroundColor: ANIMAL_COLORS[idx] + '18', // 18 = 10% opacity
                tension: 0.3,
                fill: true,
            })),
    };

    // Handle legend click to toggle visibility
    const handleToggleAnimal = (collarId: string) => {
        setHiddenAnimals(prev =>
            prev.includes(collarId)
                ? prev.filter(id => id !== collarId)
                : [...prev, collarId]
        );
    };

    return (
        <div>
        {/* Metric selector */ }
        <div>
        {
        (['bpm', 'temperature', 'activity'] as const).map(m => (
            <button
            key= { m }
            onClick = {() => setMetric(m)}
    className = { metric === m ? 'active' : ''
}
          >
    { m }
    </button>
        ))}
</div>

{/* Chart */ }
<Line
        data={ chartData }
options = {{
    plugins: {
        legend: {
            onClick: (e: any) => {
                const index = e.datasetIndex;
                const collarId = animals[index]?.collar_id;
                if (collarId) handleToggleAnimal(collarId);
            },
            },
    },
}}
      />

{/* Show hidden count */ }
{
    hiddenAnimals.length > 0 && (
        <p>{ hiddenAnimals.length } animal(s) hidden </p>
      )
}
</div>
  );
}

// ============================================================================
// EXEMPLE 4: Tableau comparatif avec coloration
// ============================================================================

interface Animal {
    collar_id: string;
    name: string;
    bpm?: number;
    temperature?: number;
    activity?: number;
}

const RANGES = {
    bpm: { min: 70, max: 120 },
    temperature: { min: 38.5, max: 39.5 },
    activity: { min: 50, max: 100 },
};

function ComparisonTableExample() {
    const animals: Animal[] = [
        { collar_id: 'SHEEP_001', name: 'Bella', bpm: 85, temperature: 38.5, activity: 65 },
        { collar_id: 'SHEEP_002', name: 'Luna', bpm: 110, temperature: 39.2, activity: 45 },
    ];
    const metric = 'bpm';
    const range = RANGES[metric as keyof typeof RANGES];

    // Get color based on value
    const getValueColor = (value: number) => {
        if (value < range.min || value > range.max) {
            if (value > range.max * 1.15) {
                return { color: 'text-red-600', bg: 'bg-red-50' };
            }
            return { color: 'text-amber-600', bg: 'bg-amber-50' };
        }
        return { color: 'text-green-600', bg: 'bg-green-50' };
    };

    // Calculate stats
    const values = animals.map(a => (a[metric as keyof Animal] as number) || 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const gap = maxValue - minValue;

    return (
        <table>
        <thead>
        <tr>
        <th>Animal </th>
          {
        animals.map(a => (
            <th key= { a.collar_id } > { a.name } </th>
        ))
    }
    <th>Gap </th>
        </tr>
        </thead>
        < tbody >
        <tr>
        <td>Normal Range </td>
    {
        animals.map(a => (
            <td key= { a.collar_id } >
            { range.min }–{ range.max }
        </td>
        ))
    }
    <td>—</td>
        </tr>
        < tr >
        <td>Current Value </td>
    {
        animals.map(a => {
            const value = (a[metric as keyof Animal] as number) || 0;
            const styles = getValueColor(value);
            return (
                <td key= { a.collar_id } className = {`${styles.bg} ${styles.color}`
        }>
        { value }
        </td>
        );
    })
}
<td className="font-bold" > { gap } </td>
    </tr>
    </tbody>
    </table>
  );
}

// ============================================================================
// EXEMPLE 5: Appel API Anthropic pour analyse IA
// ============================================================================

async function callAnthropicAPI(animals: Animal[]) {
    const prompt = `Tu es un vétérinaire expert. Analyse ces animaux :
${animals.map(a => `${a.name}#${a.collar_id}: BPM=${a.bpm}, Temp=${a.temperature}°C, Activité=${a.activity}%`).join(' | ')}

Fournis 2-3 phrases identifiant :
1. Les anomalies partagées
2. L'animal le plus à risque
3. Une cause commune possible`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY || '',
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 300,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const analysis = data.content[0]?.text || '';
        return analysis;
    } catch (error) {
        console.error('API error:', error);
        // Fallback to mock
        return 'Bella et Luna montrent une température normale. Max présente les signes les plus critiques avec BPM 140 et Temp 40.1°C. Vérifiez l\'isolement et consultez un vétérinaire.';
    }
}

// ============================================================================
// EXEMPLE 6: Intégration complète dans React component
// ============================================================================

// Imports already provided at top

function AIAnalysisExample({ animals }: { animals: Animal[] }) {
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalysis = async () => {
            setLoading(true);
            try {
                const result = await callAnthropicAPI(animals);
                setAnalysis(result);
            } catch (err) {
                console.error(err);
                setAnalysis('Erreur lors de l\'analyse');
            } finally {
                setLoading(false);
            }
        };

        if (animals.length > 0) {
            fetchAnalysis();
        }
    }, [animals]);

    if (loading) return <div>Analyse en cours...</div>;
    if (!analysis) return <div>Pas d'analyse disponible</div>;

    return (
        <div className= "p-4 bg-purple-50 rounded-lg" >
        <h3>Analyse IA </h3>
            < p > { analysis } </p>
            </div>
  );
}

// ============================================================================
// EXEMPLE 7: URL Construction & Parsing
// ============================================================================

// Construire une URL de comparaison
function buildCompareURL(animalIds: string[]): string {
    if (animalIds.length < 2) {
        throw new Error('At least 2 animals required');
    }
    if (animalIds.length > 4) {
        console.warn('Max 4 animals allowed, truncating');
        animalIds = animalIds.slice(0, 4);
    }
    return `/compare?ids=${animalIds.join(',')}`;
}

// Parser une URL de comparaison
function parseCompareURL(url: string): string[] {
    const params = new URLSearchParams(url.split('?')[1]);
    return params.get('ids')?.split(',').filter(Boolean) || [];
}

// Examples
console.log(buildCompareURL(['SHEEP_001', 'SHEEP_002']));
// Output: /compare?ids=SHEEP_001,SHEEP_002

console.log(parseCompareURL('/compare?ids=SHEEP_001,SHEEP_002,SHEEP_003'));
// Output: ['SHEEP_001', 'SHEEP_002', 'SHEEP_003']

// ============================================================================
// EXEMPLE 8: Coloration basée sur plages normales
// ============================================================================

const metricRanges = {
    bpm: { min: 70, max: 120, unit: 'bpm' },
    temperature: { min: 38.5, max: 39.5, unit: '°C' },
    activity: { min: 50, max: 100, unit: '%' },
};

function getColorStatus(value: number, metric: keyof typeof metricRanges) {
    const range = metricRanges[metric];

    if (value < range.min || value > range.max) {
        if (value > range.max * 1.15) {
            return {
                status: 'critical',
                color: 'red-600',
                bg: 'red-50',
                icon: '⛔',
            };
        }
        return {
            status: 'warning',
            color: 'amber-600',
            bg: 'amber-50',
            icon: '⚠️',
        };
    }

    return {
        status: 'good',
        color: 'green-600',
        bg: 'green-50',
        icon: '✓',
    };
}

// Examples
console.log(getColorStatus(85, 'bpm'));
// Output: { status: 'good', color: 'green-600', ... }

console.log(getColorStatus(140, 'bpm'));
// Output: { status: 'warning', color: 'amber-600', ... }

console.log(getColorStatus(200, 'bpm'));
// Output: { status: 'critical', color: 'red-600', ... }

// ============================================================================
// EXEMPLE 9: Données Mock pour Testing
// ============================================================================

const mockAnimalsForComparison = [
    {
        collar_id: 'SHEEP_001',
        name: 'Bella',
        breed: 'Merino',
        health: 'Good',
        bpm: 85,
        temperature: 38.5,
        activity: 65,
        battery: 75,
    },
    {
        collar_id: 'SHEEP_002',
        name: 'Luna',
        breed: 'Suffolk',
        health: 'Warning',
        bpm: 110,
        temperature: 39.2,
        activity: 45,
        battery: 45,
    },
    {
        collar_id: 'SHEEP_003',
        name: 'Max',
        breed: 'Dorper',
        health: 'Critical',
        bpm: 140,
        temperature: 40.1,
        activity: 20,
        battery: 20,
    },
];

// Mock history for chart
const mockHistory = Array.from({ length: 96 }, (_, i) => ({
    timestamp: new Date(Date.now() - (96 - i) * 15 * 60 * 1000).toISOString(),
    value: Math.random() * 40 + 70,
}));

// ============================================================================
// EXEMPLE 10: Types TypeScript
// ============================================================================

interface Animal {
    collar_id: string;
    name: string;
    breed?: string;
    health?: 'Good' | 'Warning' | 'Critical';
    bpm?: number;
    temperature?: number;
    activity?: number;
    battery?: number;
    [key: string]: any;
}

interface HistoryPoint {
    timestamp: string;
    value: number;
}

interface MetricInfo {
    label: string;
    unit: string;
    min: number;
    max: number;
}

interface CompareProps {
    animals: Animal[];
    metric: 'bpm' | 'temperature' | 'activity';
    period: '1h' | '6h' | '24h' | '7j';
}

export { buildCompareURL, parseCompareURL, getColorStatus, mockAnimalsForComparison };
