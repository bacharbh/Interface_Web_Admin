import { useMemo } from 'react';

interface FarmConfig {
    farmLat: number | null;
    farmLng: number | null;
    farmName: string;
}

const FARM_CONFIG_STORAGE_KEY = 'smartShepherdConfig_v2';

const parseNumber = (value: unknown): number | null => {
    if (value === '' || value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

export const useFarmConfig = (): FarmConfig => {
    return useMemo(() => {
        let stored: Record<string, unknown> = {};

        try {
            const raw = localStorage.getItem(FARM_CONFIG_STORAGE_KEY);
            if (raw) stored = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            stored = {};
        }

        return {
            farmLat: parseNumber(stored.farmLat) ?? parseNumber(import.meta.env.VITE_FARM_LAT) ?? null,
            farmLng: parseNumber(stored.farmLng) ?? parseNumber(import.meta.env.VITE_FARM_LNG) ?? null,
            farmName: String(stored.farmName ?? import.meta.env.VITE_FARM_NAME ?? 'Ferme'),
        };
    }, []);
};
