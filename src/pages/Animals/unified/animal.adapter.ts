import type { AnimalSourceRecord, NormalizedAnimal } from './animal.types';

const toStringId = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    return String(value);
};

export const resolveAnimalIdentity = (animal: AnimalSourceRecord) => {
    const candidates = [
        { source: 'collar_id' as const, value: animal.collar_id },
        { source: 'sheepId' as const, value: animal.sheepId },
        { source: 'tag' as const, value: animal.tag },
        { source: 'currentCollar' as const, value: animal.currentCollar },
        { source: 'fallback' as const, value: animal.id },
    ];

    const resolved = candidates.find((candidate) => candidate.value !== undefined && candidate.value !== null && candidate.value !== '');

    return {
        source: resolved?.source ?? 'fallback',
        value: toStringId(resolved?.value),
    };
};

export const normalizeAnimalRecord = (animal: AnimalSourceRecord): NormalizedAnimal => {
    const identity = resolveAnimalIdentity(animal);
    const historicalCollars = Array.from(
        new Set(
            [animal.collar_id, animal.sheepId, animal.currentCollar, animal.tag]
                .map(toStringId)
                .filter(Boolean)
        )
    );

    return {
        id: identity.value,
        displayId: toStringId(animal.sheepId || animal.collar_id || animal.tag || animal.currentCollar || animal.id || identity.value),
        name: animal.name ? String(animal.name) : 'Animal sans nom',
        breed: animal.breed ? String(animal.breed) : 'Race inconnue',
        age: typeof animal.age === 'number' ? animal.age : undefined,
        weight: typeof animal.weight === 'number' ? animal.weight : undefined,
        sector: animal.sector ? String(animal.sector) : undefined,
        health: animal.health ? String(animal.health) : 'Good',
        battery: typeof animal.battery === 'number' ? animal.battery : undefined,
        temperature: typeof animal.temperature === 'number' ? animal.temperature : undefined,
        heartRate: typeof animal.heartRate === 'number' ? animal.heartRate : undefined,
        activity: typeof animal.activity === 'number' ? animal.activity : undefined,
        speed: typeof animal.speed === 'number' ? animal.speed : undefined,
        rssi: typeof animal.rssi === 'number' ? animal.rssi : undefined,
        heading: typeof animal.heading === 'number' ? animal.heading : undefined,
        lat: typeof animal.lat === 'number' ? animal.lat : undefined,
        lng: typeof animal.lng === 'number' ? animal.lng : undefined,
        lastUpdate: animal.lastUpdate ? String(animal.lastUpdate) : undefined,
        collarId: toStringId(animal.collar_id || animal.currentCollar || animal.tag || animal.sheepId || animal.id),
        historicalCollars,
        source: identity.source,
    };
};

export const findAnimalByIdentifier = (
    animals: AnimalSourceRecord[],
    identifier: string
) => {
    if (!identifier) {
        return undefined;
    }

    return animals.find((animal) => {
        const values = [animal.collar_id, animal.sheepId, animal.tag, animal.currentCollar, animal.id]
            .map(toStringId);

        return values.includes(identifier);
    });
};
