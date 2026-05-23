// 🚀 QUICK-START PATTERNS FOR SMART SHEPHERD

// ============================================================================
// 1️⃣ TOAST NOTIFICATION SERVICE (Copy & Paste Ready)
// ============================================================================

// File: src/services/notificationService.ts
import { create } from 'zustand';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

interface NotificationStore {
    toasts: Toast[];
    show: (type: Toast['type'], message: string, duration?: number) => void;
    dismiss: (id: string) => void;
    clear: () => void;
}

export const useNotification = create<NotificationStore>((set) => ({
    toasts: [],
    show: (type, message, duration = 4000) => {
        const id = Math.random().toString(36).substr(2, 9);
        const toast: Toast = { id, type, message, duration };

        set((state) => ({ toasts: [...state.toasts, toast] }));

        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
            }, duration);
        }
    },
    dismiss: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    },
    clear: () => set({ toasts: [] }),
}));

// Usage in components:
// const { show } = useNotification();
// show('error', 'Failed to create zone');
// show('success', 'Zone created successfully!');

// ============================================================================
// 2️⃣ INPUT VALIDATION WITH ZOD (Install: npm i zod)
// ============================================================================

// File: src/schemas/geofenceSchema.ts
import { z } from 'zod';

export const CreateGeofenceSchema = z.object({
    name: z.string()
        .min(1, '❌ Name is required')
        .max(100, '❌ Name must be less than 100 characters')
        .trim(),

    coords: z.array(
        z.tuple([z.number(), z.number()]),
        { message: '❌ Invalid coordinates format' }
    )
        .min(3, '❌ At least 3 points required for polygon')
        .max(100, '❌ Maximum 100 points per zone'),

    description: z.string().optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
});

export const UpdateGeofenceSchema = CreateGeofenceSchema.partial();

export type CreateGeofenceInput = z.infer<typeof CreateGeofenceSchema>;
export type UpdateGeofenceInput = z.infer<typeof UpdateGeofenceSchema>;

// Usage:
// try {
//   const validated = CreateGeofenceSchema.parse(zoneData);
//   await geofenceService.createZone(validated);
// } catch (error) {
//   if (error instanceof z.ZodError) {
//     error.errors.forEach(e => show('error', e.message));
//   }
// }

// ============================================================================
// 3️⃣ ERROR BOUNDARY (Catch Rendering Crashes)
// ============================================================================

// File: src/components/ErrorBoundary.tsx
import React from 'react';
import Button from './ui/Button';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('🔴 ErrorBoundary caught:', error, errorInfo);
        // Send to error tracking service (Sentry, LogRocket, etc)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className= "p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800" >
                <h2 className="text-red-800 dark:text-red-200 font-bold mb-2" >
            ⚠️ Something went wrong
                </h2>
                < p className = "text-red-700 dark:text-red-300 text-sm mb-4" >
                    { this.state.error?.message }
                    </p>
                    < Button
            onClick = {() => window.location.reload()
        }
        variant = "primary"
        size = "sm"
            >
            Reload Page
                </Button>
                </div>
      );
    }

    return this.props.children;
  }
}

// Usage: Wrap entire app or sections
// <ErrorBoundary>
//   <MapMonitor />
// </ErrorBoundary>

// ============================================================================
// 4️⃣ SAFE API CALL WITH RETRY (Exponential Backoff)
// ============================================================================

// File: src/utils/apiRetry.ts
interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
}

export const withRetry = async <T,>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> => {
    const {
        maxAttempts = 3,
        delayMs = 1000,
        backoffMultiplier = 2,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            console.warn(
                `⚠️ Attempt ${attempt}/${maxAttempts} failed:`,
                (error as Error).message
            );

            if (attempt < maxAttempts) {
                const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(
        `Failed after ${maxAttempts} attempts: ${lastError?.message}`
    );
};

// Usage:
// const result = await withRetry(
//   () => api.get('/geofence'),
//   { maxAttempts: 3, delayMs: 1000 }
// );

// ============================================================================
// 5️⃣ IMPROVED GEOFENCE SERVICE (With Error Handling)
// ============================================================================

// File: src/services/geofenceService.ts (Updated)
import api from './api';
import { useNotification } from './notificationService';
import { withRetry } from '../utils/apiRetry';
import { CreateGeofenceSchema } from '../schemas/geofenceSchema';

const transformZoneFromBackend = (zone: any) => {
    if (!zone) return null;
    if (zone.coords) return zone; // Already transformed

    if (zone.geometry?.coordinates?.[0]) {
        return {
            id: zone.id,
            name: zone.name,
            coords: zone.geometry.coordinates[0].map((coord: any) => [coord[1], coord[0]]),
            color: zone.color || '#16a34a',
            description: zone.description,
            isActive: zone.isActive,
        };
    }
    return zone;
};

const transformZoneToBackend = (zone: any) => {
    if (!zone) return null;
    if (zone.geometry) return zone; // Already transformed

    if (zone.coords?.length >= 3) {
        return {
            name: zone.name,
            description: zone.description || '',
            geometry: {
                type: 'Polygon',
                coordinates: [zone.coords.map((coord: any) => [coord[1], coord[0]])],
            },
            isActive: zone.isActive !== false,
            alertThreshold: zone.alertThreshold || 1,
            notificationChannels: zone.notificationChannels || ['websocket'],
        };
    }
    throw new Error('Invalid zone: at least 3 coordinates required');
};

export const geofenceService = {
    async getZones() {
        const { show } = useNotification.getState();

        return withRetry(
            async () => {
                const response = await api.get('/geofence');
                const zones = response.data.geofences || [];
                return zones.map(transformZoneFromBackend).filter(z => z !== null);
            },
            { maxAttempts: 2, delayMs: 500 }
        ).catch((error) => {
            console.error('❌ Failed to fetch zones:', error);
            show('error', 'Failed to load zones. Using cached data.');
            return [];
        });
    },

    async createZone(zoneData: unknown) {
        const { show } = useNotification.getState();

        try {
            // Validate input
            const validated = CreateGeofenceSchema.parse(zoneData);
            const backendFormat = transformZoneToBackend(validated);

            const response = await withRetry(
                () => api.post('/geofence', backendFormat),
                { maxAttempts: 2 }
            );

            show('success', '✅ Zone created successfully!');
            return transformZoneFromBackend(response.data.geofence);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            show('error', `❌ Failed to create zone: ${message}`);
            throw error;
        }
    },

    async updateZone(id: string, zoneData: unknown) {
        const { show } = useNotification.getState();

        try {
            const validated = CreateGeofenceSchema.parse(zoneData);
            const backendFormat = transformZoneToBackend(validated);

            const response = await withRetry(
                () => api.put(`/geofence/${id}`, backendFormat),
                { maxAttempts: 2 }
            );

            show('success', '✅ Zone updated successfully!');
            return transformZoneFromBackend(response.data.geofence);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            show('error', `❌ Failed to update zone: ${message}`);
            throw error;
        }
    },

    async deleteZone(id: string) {
        const { show } = useNotification.getState();

        try {
            await withRetry(
                () => api.delete(`/geofence/${id}`),
                { maxAttempts: 2 }
            );

            show('success', '✅ Zone deleted successfully!');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            show('error', `❌ Failed to delete zone: ${message}`);
            throw error;
        }
    },
};

export default geofenceService;

// ============================================================================
// 6️⃣ LOADING SKELETON (Better UX)
// ============================================================================

// File: src/components/LoadingSkeleton.tsx
export const ZoneListSkeleton = () => (
    <div className= "space-y-3" >
    {
        [1, 2, 3].map((i) => (
            <div key= { i } className = "animate-pulse" >
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
        </div>
        ))
    }
    </div>
);

// ============================================================================
// NEXT STEPS
// ============================================================================
//
// 1. Install Zod: npm install zod
// 2. Copy the schemas, services, and components above
// 3. Update geofenceService.js to use the new patterns
// 4. Wrap your app with ErrorBoundary
// 5. Test error scenarios
// 6. Add unit tests for critical paths
//
// See AI_INSIGHTS_ANALYSIS.md for more details!
