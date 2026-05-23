export type AnimalSourceRecord = Record<string, any> & {
    id?: string | number;
    sheepId?: string | number;
    collar_id?: string | number;
    tag?: string | number;
    currentCollar?: string | number;
    collars?: string[];
    name?: string;
    breed?: string;
    age?: string | number;
    weight?: string | number;
    sector?: string;
    health?: string;
    battery?: number;
    temperature?: number;
    heartRate?: number;
    activity?: number;
    speed?: number;
    rssi?: number;
    heading?: number;
    lat?: number;
    lng?: number;
    lastUpdate?: string;
    notes?: string;
};

export interface NormalizedAnimal {
    id: string;
    displayId: string;
    name: string;
    breed: string;
    age?: number;
    weight?: number;
    sector?: string;
    health: string;
    battery?: number;
    temperature?: number;
    heartRate?: number;
    activity?: number;
    speed?: number;
    rssi?: number;
    heading?: number;
    lat?: number;
    lng?: number;
    lastUpdate?: string;
    collarId?: string;
    historicalCollars: string[];
    source: 'collar_id' | 'sheepId' | 'tag' | 'currentCollar' | 'fallback';
}

export interface AnimalTimelineEntry {
    id: string;
    type: 'vaccine' | 'treatment' | 'visit' | 'alert' | 'recovery';
    date: string;
    title: string;
    description: string;
    veterinarian?: string;
}

export interface AnimalDocumentEntry {
    id: string;
    name: string;
    type: string;
    uploadedAt: string;
    size: number;
    url?: string;
}
