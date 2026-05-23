/**
 * EXEMPLE D'UTILISATION - AnimalProfile.tsx
 * 
 * Cette page peut être accédée via:
 * 1. Navigation programmatique: navigate('/animal/SHEEP_001')
 * 2. URL directe: http://localhost:5173/animal/SHEEP_001
 * 3. Lien depuis la liste: <a href="/animal/sheep-id">View Profile</a>
 */

// ============================================================================
// EXEMPLE 1: Intégration dans un composant existant
// ============================================================================
import { useNavigate } from 'react-router-dom';

export function AnimalListItem({ animal }: { animal: any }) {
    const navigate = useNavigate();

    const handleViewProfile = () => {
        // Naviguer vers le profil détaillé
        navigate(`/animal/${animal.sheepId}`);
    };

    return (
        <button onClick= { handleViewProfile } >
      👁️ Voir profil complet
        </button>
  );
}

// ============================================================================
// EXEMPLE 2: Données Mock pour tester
// ============================================================================
export const MOCK_ANIMAL = {
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
    lastUpdate: new Date().toISOString(),
};

// ============================================================================
// EXEMPLE 3: Structure des données IoT
// ============================================================================
interface IotAnimal {
    sheepId: string;              // ID unique
    collar_id: string;            // ID du collar IoT
    name: string;
    breed: string;                // Race: Merino, Suffolk, etc.
    age: number;                  // Ans
    weight?: number;              // Kg
    sector?: string;              // Nord, Sud, Est, Ouest
    health?: 'Good' | 'Warning' | 'Critical';
    heartRate?: number;           // BPM (70-120 normal)
    temperature?: number;         // °C (38.5-39.5 normal)
    battery?: number;             // % (20-100)
    activity?: number;            // % (50-100)
    rssi?: number;                // Signal RSSI
    speed?: number;               // km/h
    lastUpdate?: string;          // ISO timestamp
}

// ============================================================================
// EXEMPLE 4: Requêtes API à implémenter
// ============================================================================

/**
 * GET /api/animals/:id
 * Récupère les données détaillées d'un animal
 */
async function fetchAnimalDetails(animalId: string) {
    const response = await fetch(`/api/animals/${animalId}`);
    const data = await response.json();
    return data as IotAnimal;
}

/**
 * GET /api/animals/:id/medical-history
 * Récupère l'historique médical
 */
async function fetchMedicalHistory(animalId: string) {
    const response = await fetch(`/api/animals/${animalId}/medical-history`);
    const data = await response.json();
    return data as MedicalEvent[];
}

/**
 * POST /api/animals/:id/notes
 * Sauvegarde les notes de l'animal
 */
async function saveAnimalNotes(animalId: string, notes: string) {
    const response = await fetch(`/api/animals/${animalId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: notes }),
    });
    return response.json();
}

/**
 * POST /api/animals/:id/documents
 * Upload un document
 */
async function uploadDocument(animalId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/animals/${animalId}/documents`, {
        method: 'POST',
        body: formData,
    });
    return response.json();
}

/**
 * GET /api/animals/:id/gps-trail
 * Récupère le tracé GPS des 24 dernières heures
 */
async function fetchGpsTrail(animalId: string) {
    const response = await fetch(
        `/api/animals/${animalId}/gps-trail?hours=24`
    );
    const data = await response.json();
    return data as Array<{ lat: number; lng: number; timestamp: string }>;
}

// ============================================================================
// EXEMPLE 5: Types TypeScript Complets
// ============================================================================

interface MedicalEvent {
    id: string;
    date: string;                                  // ISO timestamp
    type: 'vaccine' | 'treatment' | 'visit' | 'alert' | 'recovery';
    title: string;
    description: string;
    veterinarian?: string;
}

interface Document {
    id: string;
    name: string;
    type: string;                                  // "pdf", "jpg", etc.
    uploadedAt: string;                            // ISO timestamp
    size: number;                                  // bytes
    url?: string;
}

interface VitalRange {
    min: number;
    max: number;
}

interface AnimalVitals {
    heartRate: number;                             // BPM
    temperature: number;                           // °C
    activity: number;                              // %
    battery: number;                               // %
}

// ============================================================================
// EXEMPLE 6: Colors & Status Mapping
// ============================================================================

export const HEALTH_COLORS = {
    Good: { text: '#1D9E75', bg: '#1D9E750A', border: '#1D9E751A' },
    Warning: { text: '#F59E0B', bg: '#F59E0B0A', border: '#F59E0B1A' },
    Critical: { text: '#E24B4A', bg: '#E24B4A0A', border: '#E24B4A1A' },
};

export const SECTOR_COLORS: Record<string, string> = {
    'Nord': 'from-blue-500 to-cyan-500',
    'Sud': 'from-orange-500 to-red-500',
    'Est': 'from-green-500 to-emerald-500',
    'Ouest': 'from-purple-500 to-pink-500',
};

export const VITAL_RANGES: Record<string, VitalRange> = {
    heartRate: { min: 70, max: 120 },
    temperature: { min: 38.5, max: 39.5 },
    activity: { min: 50, max: 100 },
    battery: { min: 20, max: 100 },
};

// ============================================================================
// EXEMPLE 7: Composant Parent pour Tester
// ============================================================================
import React from 'react';

export function TestAnimalProfile() {
    return (
        <div className= "p-8 space-y-4" >
        <h2>Test AnimalProfile Navigation </h2>

            < button
    onClick = {() => {
        // Simule une navigation depuis la liste d'animaux
        window.location.href = '/animal/SHEEP_001';
    }
}
className = "px-4 py-2 bg-primary text-white rounded-lg"
    >
    Voir profil SHEEP_001
        </button>

        < button
onClick = {() => {
    window.location.href = '/animal/SHEEP_002';
}}
className = "px-4 py-2 bg-primary text-white rounded-lg"
    >
    Voir profil SHEEP_002
        </button>
        </div>
  );
}

// ============================================================================
// EXEMPLE 8: Structur des requêtes WebSocket pour mises à jour temps réel
// ============================================================================

/**
 * WebSocket pour les mises à jour temps réel des vitaux
 * 
 * Message reçu:
 * {
 *   type: 'VITAL_UPDATE',
 *   animalId: 'SHEEP_001',
 *   heartRate: 92,
 *   temperature: 39.2,
 *   battery: 68,
 *   activity: 75,
 *   timestamp: '2024-05-04T12:00:00Z'
 * }
 */

export function setupVitalsWs(animalId: string) {
    const ws = new WebSocket(`wss://api.smartshepherd.com/vitals/${animalId}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Vitals Update:', data);
        // Mettre à jour le composant ici
    };

    return ws;
}

// ============================================================================
// EXEMPLE 9: Tests unitaires (Jest/Vitest)
// ============================================================================
/*
describe('AnimalProfile', () => {
  it('should render animal profile with correct data', () => {
    const { getByText } = render(
      <AnimalProfile />,
      { wrapper: createMemoryRouter(['/animal/SHEEP_001']) }
    );
    expect(getByText('Bella')).toBeInTheDocument();
  });

  it('should navigate to next animal when clicking next button', () => {
    const { getByRole } = render(<AnimalProfile />, {
      wrapper: createMemoryRouter(['/animal/SHEEP_001'], { animals: [MOCK_ANIMAL] })
    });
    
    fireEvent.click(getByRole('button', { name: /next/i }));
    expect(window.location.pathname).toBe('/animal/SHEEP_002');
  });

  it('should filter medical events by type', () => {
    const { getByRole } = render(<AnimalProfile />);
    fireEvent.click(getByRole('button', { name: /vaccine/i }));
    // Vérifier que seuls les vaccins sont affichés
  });
});
*/
