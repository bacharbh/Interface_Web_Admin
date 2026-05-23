import api from './api';

export type AgendaPersistenceMode = 'local' | 'api';
export const PERSISTENCE_MODE: AgendaPersistenceMode = (import.meta.env.VITE_AGENDA_PERSISTENCE_MODE === 'local' ? 'local' : 'api');

export type AgendaEventType = 'vaccine' | 'checkup' | 'treatment' | 'other';
export type AgendaEventStatus = 'upcoming' | 'done' | 'cancelled';
export type AgendaRecurrence = 'none' | 'monthly' | 'annual';

export interface AgendaEvent {
    id: string;
    title: string;
    type: AgendaEventType;
    startAt: string;
    endAt: string;
    animalIds: string[];
    veterinarian?: string;
    notes?: string;
    recurrence: AgendaRecurrence;
    reminderMinutes: number;
    status: AgendaEventStatus;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string | null;
    updatedBy?: string | null;
}

export interface NewAgendaEvent {
    title: string;
    type: AgendaEventType;
    startAt: string;
    endAt: string;
    animalIds: string[];
    veterinarian?: string;
    notes?: string;
    recurrence: AgendaRecurrence;
    reminderMinutes: number;
    status: AgendaEventStatus;
}

export interface AgendaConflict {
    id: string;
    title: string;
    type: AgendaEventType;
    startAt: string;
    endAt: string;
}

const STORAGE_KEY = 'agendaEvents_v1';

const readLocalEvents = (): AgendaEvent[] => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as AgendaEvent[];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('[agendaService] Failed to read local events', error);
        return [];
    }
};

const writeLocalEvents = (events: AgendaEvent[]) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
};

const normalizeEvent = (event: any): AgendaEvent => ({
    id: String(event.id ?? event._id ?? `evt_${Date.now()}`),
    title: String(event.title ?? ''),
    type: (event.type ?? 'other') as AgendaEventType,
    startAt: new Date(event.startAt).toISOString(),
    endAt: new Date(event.endAt).toISOString(),
    animalIds: Array.isArray(event.animalIds) ? event.animalIds.map(String) : [],
    veterinarian: event.veterinarian ?? '',
    notes: event.notes ?? '',
    recurrence: (event.recurrence ?? 'none') as AgendaRecurrence,
    reminderMinutes: Number(event.reminderMinutes ?? 60),
    status: (event.status ?? 'upcoming') as AgendaEventStatus,
    createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : undefined,
    updatedAt: event.updatedAt ? new Date(event.updatedAt).toISOString() : undefined,
    createdBy: event.createdBy ?? null,
    updatedBy: event.updatedBy ?? null,
});

const normalizeRangeResponse = (payload: any): AgendaEvent[] => {
    if (Array.isArray(payload)) {
        return payload.map(normalizeEvent);
    }

    if (Array.isArray(payload?.data)) {
        return payload.data.map(normalizeEvent);
    }

    if (Array.isArray(payload?.events)) {
        return payload.events.map(normalizeEvent);
    }

    return [];
};

const localRangeFilter = (events: AgendaEvent[], from: Date, to: Date) => {
    const fromTime = from.getTime();
    const toTime = to.getTime();
    return events.filter((event) => {
        const start = new Date(event.startAt).getTime();
        const end = new Date(event.endAt).getTime();
        return start < toTime && end > fromTime;
    }).sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
};

const localCreate = (event: NewAgendaEvent) => {
    const now = new Date().toISOString();
    const nextEvent: AgendaEvent = {
        ...event,
        id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        createdAt: now,
        updatedAt: now,
        createdBy: 'local',
        updatedBy: 'local',
    };

    const events = [...readLocalEvents(), nextEvent];
    writeLocalEvents(events);
    return nextEvent;
};

const localUpdate = (id: string, updates: Partial<AgendaEvent>) => {
    const now = new Date().toISOString();
    const events = readLocalEvents();
    const index = events.findIndex((event) => event.id === id);

    if (index === -1) {
        throw new Error('Événement introuvable');
    }

    const updatedEvent = { ...events[index], ...updates, id, updatedAt: now };
    events[index] = updatedEvent;
    writeLocalEvents(events);
    return updatedEvent;
};

const localDelete = (id: string) => {
    writeLocalEvents(readLocalEvents().filter((event) => event.id !== id));
};

export const fetchEvents = async (from: Date, to: Date): Promise<AgendaEvent[]> => {
    if (PERSISTENCE_MODE === 'local') {
        return localRangeFilter(readLocalEvents(), from, to);
    }

    const response = await api.get('/agenda/events', {
        params: {
            from: from.toISOString(),
            to: to.toISOString(),
        },
    });

    return normalizeRangeResponse(response.data);
};

export const createEvent = async (event: NewAgendaEvent): Promise<AgendaEvent> => {
    if (PERSISTENCE_MODE === 'local') {
        return localCreate(event);
    }

    const response = await api.post('/agenda/events', event);
    return normalizeEvent(response.data?.data ?? response.data?.event ?? response.data);
};

export const updateEvent = async (id: string, updates: Partial<AgendaEvent>): Promise<AgendaEvent> => {
    if (PERSISTENCE_MODE === 'local') {
        return localUpdate(id, updates);
    }

    const response = await api.put(`/agenda/events/${id}`, updates);
    return normalizeEvent(response.data?.data ?? response.data?.event ?? response.data);
};

export const deleteEvent = async (id: string): Promise<void> => {
    if (PERSISTENCE_MODE === 'local') {
        localDelete(id);
        return;
    }

    await api.delete(`/agenda/events/${id}`);
};

export const normalizeAgendaEvent = normalizeEvent;