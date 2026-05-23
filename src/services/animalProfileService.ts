import axios from 'axios';
import api from './api';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK_ANIMAL_PROFILE === 'true';

export type MedicalHistoryType = 'vaccine' | 'treatment' | 'exam';
export type DocumentFileType = 'pdf' | 'jpg' | 'png';

export interface MedicalHistoryRecord {
    id: string;
    date: string;
    type: MedicalHistoryType;
    notes: string;
    vetName: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface MedicalHistoryInput {
    date: string;
    type: MedicalHistoryType;
    notes: string;
    vetName: string;
}

export interface AnimalDocumentRecord {
    id: string;
    name: string;
    date: string;
    type: DocumentFileType | string;
    size: number;
    url?: string;
    mimeType?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface NotesResponse {
    content: string;
    updatedAt: string;
}

interface ApiEnvelope<T> {
    data?: T;
    message?: string;
    error?: string;
}

type MockStore = {
    medicalHistory: Record<string, MedicalHistoryRecord[]>;
    documents: Record<string, AnimalDocumentRecord[]>;
    notes: Record<string, NotesResponse>;
};

const MOCK_STORAGE_KEY = 'smart_shepherd_animal_profile_v1';

const nowIso = () => new Date().toISOString();

const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `animal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const DEFAULT_MEDICAL_HISTORY: MedicalHistoryRecord[] = [
    {
        id: 'mh-1',
        date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'vaccine',
        notes: 'Vaccination de rappel réalisée sans incident.',
        vetName: 'Dr. Bernard',
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
    {
        id: 'mh-2',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'treatment',
        notes: 'Traitement antiparasitaire interne et externe.',
        vetName: 'Dr. Dupont',
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
    {
        id: 'mh-3',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'exam',
        notes: 'Examen clinique normal, aucun signe d’alerte.',
        vetName: 'Dr. Martin',
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
];

const DEFAULT_DOCUMENTS: AnimalDocumentRecord[] = [
    {
        id: 'doc-1',
        name: 'Certificat_sante_2026.pdf',
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'pdf',
        size: 243_000,
        url: '#',
        mimeType: 'application/pdf',
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
    {
        id: 'doc-2',
        name: 'Photo_identification.jpg',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'jpg',
        size: 1_120_000,
        url: '#',
        mimeType: 'image/jpeg',
        createdAt: nowIso(),
        updatedAt: nowIso(),
    },
];

const getDefaultNotes = (): NotesResponse => ({
    content: 'Bonne santé générale. Surveiller l’appétit et l’activité.',
    updatedAt: nowIso(),
});

const getDefaultMockStore = (): MockStore => ({
    medicalHistory: {},
    documents: {},
    notes: {},
});

const getMockStore = (): MockStore => {
    if (typeof window === 'undefined') {
        return getDefaultMockStore();
    }

    try {
        const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
        if (!raw) {
            return getDefaultMockStore();
        }

        const parsed = JSON.parse(raw) as Partial<MockStore>;
        return {
            medicalHistory: parsed.medicalHistory ?? {},
            documents: parsed.documents ?? {},
            notes: parsed.notes ?? {},
        };
    } catch {
        return getDefaultMockStore();
    }
};

const saveMockStore = (store: MockStore) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(store));
};

const getMockEntries = (animalId: string) => {
    const store = getMockStore();
    return {
        store,
        medicalHistory: store.medicalHistory[animalId] ?? DEFAULT_MEDICAL_HISTORY,
        documents: store.documents[animalId] ?? DEFAULT_DOCUMENTS,
        notes: store.notes[animalId] ?? getDefaultNotes(),
    };
};

const setMockEntries = (animalId: string, next: Partial<MockStore>) => {
    const store = getMockStore();
    const merged: MockStore = {
        medicalHistory: {
            ...store.medicalHistory,
            ...(next.medicalHistory ?? {}),
        },
        documents: {
            ...store.documents,
            ...(next.documents ?? {}),
        },
        notes: {
            ...store.notes,
            ...(next.notes ?? {}),
        },
    };

    saveMockStore(merged);
};

const normalizeHistoryRecord = (value: any): MedicalHistoryRecord => ({
    id: String(value?.id ?? createId()),
    date: String(value?.date ?? value?.createdAt ?? nowIso()),
    type: value?.type === 'vaccine' || value?.type === 'treatment' || value?.type === 'exam' ? value.type : 'exam',
    notes: String(value?.notes ?? value?.description ?? ''),
    vetName: String(value?.vetName ?? value?.veterinarian ?? ''),
    createdAt: value?.createdAt ? String(value.createdAt) : undefined,
    updatedAt: value?.updatedAt ? String(value.updatedAt) : undefined,
});

const normalizeDocumentRecord = (value: any): AnimalDocumentRecord => ({
    id: String(value?.id ?? createId()),
    name: String(value?.name ?? value?.filename ?? 'Document'),
    date: String(value?.date ?? value?.uploadedAt ?? value?.createdAt ?? nowIso()),
    type: String(value?.type ?? value?.mimeType?.split?.('/')?.[1] ?? 'pdf').toLowerCase(),
    size: typeof value?.size === 'number' ? value.size : Number(value?.size ?? 0),
    url: value?.url ? String(value.url) : undefined,
    mimeType: value?.mimeType ? String(value.mimeType) : undefined,
    createdAt: value?.createdAt ? String(value.createdAt) : undefined,
    updatedAt: value?.updatedAt ? String(value.updatedAt) : undefined,
});

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
        const response = error.response?.data as ApiEnvelope<unknown> | undefined;
        const responseMessage = response?.message || response?.error;
        if (typeof responseMessage === 'string' && responseMessage.trim()) {
            return responseMessage;
        }
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return fallbackMessage;
};

const getAnimalResponse = <T,>(response: { data?: ApiEnvelope<T> | T }) => {
    const payload = response.data as ApiEnvelope<T> | T | undefined;
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as ApiEnvelope<T>).data as T;
    }
    return payload as T;
};

export async function fetchMedicalHistory(animalId: string): Promise<MedicalHistoryRecord[]> {
    if (USE_MOCK) {
        return [...getMockEntries(animalId).medicalHistory]
            .map(normalizeHistoryRecord)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    try {
        const response = await api.get(`/animals/${animalId}/medical-history`);
        const payload = getAnimalResponse<any[]>(response) ?? [];
        return Array.isArray(payload)
            ? payload.map(normalizeHistoryRecord).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            : [];
    } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Impossible de charger l’historique médical.'));
    }
}

export async function createMedicalHistoryRecord(animalId: string, input: MedicalHistoryInput): Promise<MedicalHistoryRecord> {
    if (USE_MOCK) {
        const entries = getMockEntries(animalId);
        const created: MedicalHistoryRecord = {
            id: createId(),
            date: input.date,
            type: input.type,
            notes: input.notes.trim(),
            vetName: input.vetName.trim(),
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        const nextHistory = [created, ...entries.medicalHistory];
        setMockEntries(animalId, { medicalHistory: { [animalId]: nextHistory } });
        return created;
    }

    try {
        const response = await api.post(`/animals/${animalId}/medical-history`, input);
        return normalizeHistoryRecord(getAnimalResponse(response) ?? response.data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Impossible d’ajouter l’entrée médicale.'));
    }
}

export async function fetchAnimalDocuments(animalId: string): Promise<AnimalDocumentRecord[]> {
    if (USE_MOCK) {
        return [...getMockEntries(animalId).documents]
            .map(normalizeDocumentRecord)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    try {
        const response = await api.get(`/animals/${animalId}/documents`);
        const payload = getAnimalResponse<any[]>(response) ?? [];
        return Array.isArray(payload)
            ? payload.map(normalizeDocumentRecord).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            : [];
    } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Impossible de charger les documents.'));
    }
}

export async function uploadAnimalDocument(animalId: string, file: File): Promise<AnimalDocumentRecord> {
    if (USE_MOCK) {
        const entries = getMockEntries(animalId);
        const type = getDocumentTypeFromFile(file);
        const created: AnimalDocumentRecord = {
            id: createId(),
            name: file.name,
            date: nowIso(),
            type,
            size: file.size,
            url: typeof window !== 'undefined' ? window.URL.createObjectURL(file) : undefined,
            mimeType: file.type || undefined,
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        const nextDocuments = [created, ...entries.documents];
        setMockEntries(animalId, { documents: { [animalId]: nextDocuments } });
        return created;
    }

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post(`/animals/${animalId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        return normalizeDocumentRecord(getAnimalResponse(response) ?? response.data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Impossible d’uploader le document.'));
    }
}

export async function deleteAnimalDocument(animalId: string, documentId: string): Promise<{ success: boolean }> {
    if (USE_MOCK) {
        const entries = getMockEntries(animalId);
        const nextDocuments = entries.documents.filter((document) => document.id !== documentId);
        setMockEntries(animalId, { documents: { [animalId]: nextDocuments } });
        return { success: true };
    }

    try {
        const response = await api.delete(`/animals/${animalId}/documents/${documentId}`);
        const payload = getAnimalResponse<{ success: boolean }>(response) ?? response.data;
        return payload ?? { success: true };
    } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Impossible de supprimer le document.'));
    }
}

export async function patchAnimalNotes(animalId: string, content: string): Promise<NotesResponse> {
    if (USE_MOCK) {
        const saved = { content, updatedAt: nowIso() };
        setMockEntries(animalId, { notes: { [animalId]: saved } });
        return saved;
    }

    try {
        const response = await api.patch(`/animals/${animalId}/notes`, { content });
        const payload = getAnimalResponse<NotesResponse>(response) ?? response.data;
        return {
            content: String(payload?.content ?? content),
            updatedAt: String(payload?.updatedAt ?? nowIso()),
        };
    } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Impossible de sauvegarder les notes.'));
    }
}

export const getDocumentTypeFromFile = (file: File): DocumentFileType => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        return 'pdf';
    }
    if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        return 'png';
    }
    return 'jpg';
};

export const allowedDocumentMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const allowedDocumentExtensions = ['.pdf', '.jpg', '.jpeg', '.png'] as const;
export const maxDocumentSizeBytes = 5 * 1024 * 1024;
