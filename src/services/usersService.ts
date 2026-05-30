import axios from 'axios';
import api from './api';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK_USERS === 'true';

export type UserRole = 'admin' | 'operator' | 'viewer' | 'vet';
export type UserStatus = 'Actif' | 'Inactif';

export interface UserRecord {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
    status?: UserStatus;
    animalCount?: number;
    collarCount?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface UserInput {
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
}

const MOCK_STORAGE_KEY = 'smart_shepherd_users_mock_v1';

const DEFAULT_USERS: UserRecord[] = [
    {
        id: 'u-1',
        name: 'Bachar Admin',
        email: 'admin@smartshepherd.com',
        role: 'admin',
        phone: '+33 6 00 00 00 01',
        status: 'Actif',
        animalCount: 24,
        collarCount: 24,
    },
    {
        id: 'u-2',
        name: 'Jean Opérateur',
        email: 'jean.vet@smartshepherd.com',
        role: 'operator',
        phone: '+33 6 00 00 00 02',
        status: 'Actif',
        animalCount: 8,
        collarCount: 8,
    },
    {
        id: 'u-3',
        name: 'Marie Lectrice',
        email: 'marie@smartshepherd.com',
        role: 'viewer',
        phone: '+33 6 00 00 00 03',
        status: 'Inactif',
        animalCount: 12,
        collarCount: 12,
    },
];

const now = () => new Date().toISOString();

const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeRole = (role: unknown): UserRole => {
    const value = String(role ?? '').toLowerCase();
    // Accept legacy role names from older payloads/storage and map them.
    if (value === 'operator' || value === 'vet') return 'operator';
    if (value === 'viewer' || value === 'farmer') return 'viewer';
    return 'admin';
};

const normalizeUser = (user: any): UserRecord => ({
    id: String(user.id ?? user._id ?? createId()),
    name: String(user.name ?? user.fullName ?? 'Utilisateur'),
    email: String(user.email ?? ''),
    role: normalizeRole(user.role),
    phone: user.phone ? String(user.phone) : undefined,
    status: user.status === 'Inactif' ? 'Inactif' : 'Actif',
    animalCount: typeof user.animalCount === 'number' ? user.animalCount : typeof user.animalsCount === 'number' ? user.animalsCount : undefined,
    collarCount: typeof user.collarCount === 'number' ? user.collarCount : typeof user.collarsCount === 'number' ? user.collarsCount : undefined,
    createdAt: user.createdAt ? String(user.createdAt) : undefined,
    updatedAt: user.updatedAt ? String(user.updatedAt) : undefined,
});

const loadMockUsers = (): UserRecord[] => {
    if (typeof window === 'undefined') return DEFAULT_USERS;

    try {
        const raw = localStorage.getItem(MOCK_STORAGE_KEY);
        if (!raw) {
            localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
            return DEFAULT_USERS;
        }

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(normalizeUser);
        }
    } catch {
        // Fall back to defaults if storage is unavailable or corrupted.
    }

    return DEFAULT_USERS;
};

const saveMockUsers = (users: UserRecord[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(users));
};

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
    if (axios.isAxiosError(error)) {
        const responseMessage = error.response?.data?.message || error.response?.data?.error;
        if (typeof responseMessage === 'string' && responseMessage.trim()) {
            return responseMessage;
        }
    }

    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return fallbackMessage;
};

const mockCreateUser = async (input: UserInput): Promise<UserRecord> => {
    const users = loadMockUsers();
    const createdUser: UserRecord = {
        id: createId(),
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        role: normalizeRole(input.role),
        phone: input.phone?.trim() || undefined,
        status: 'Actif',
        animalCount: 0,
        collarCount: 0,
        createdAt: now(),
        updatedAt: now(),
    };

    users.unshift(createdUser);
    saveMockUsers(users);
    return createdUser;
};

const mockUpdateUser = async (id: string, input: UserInput): Promise<UserRecord> => {
    const users = loadMockUsers();
    const nextUsers = users.map((user) =>
        user.id === id
            ? {
                ...user,
                name: input.name.trim(),
                email: input.email.trim().toLowerCase(),
                role: normalizeRole(input.role),
                phone: input.phone?.trim() || undefined,
                updatedAt: now(),
            }
            : user
    );

    const updated = nextUsers.find((user) => user.id === id);
    saveMockUsers(nextUsers);
    if (!updated) throw new Error('Utilisateur introuvable.');
    return updated;
};

const mockDeleteUser = async (id: string): Promise<{ success: boolean }> => {
    const users = loadMockUsers();
    saveMockUsers(users.filter((user) => user.id !== id));
    return { success: true };
};

export const fetchUsers = async (): Promise<UserRecord[]> => {
    if (USE_MOCK) {
        return loadMockUsers();
    }

    try {
        const response = await api.get('/users');
        const payload = response.data?.data ?? response.data?.users ?? response.data;
        return Array.isArray(payload) ? payload.map(normalizeUser) : [];
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return DEFAULT_USERS;
        }

        throw new Error(getApiErrorMessage(error, 'Impossible de charger les utilisateurs.'));
    }
};

export const createUser = async (input: UserInput): Promise<UserRecord> => {
    if (USE_MOCK) {
        return mockCreateUser(input);
    }

    try {
        const response = await api.post('/users', input);
        return normalizeUser(response.data?.data ?? response.data?.user ?? response.data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "Impossible de créer l'utilisateur."));
    }
};

export const updateUser = async (id: string, input: UserInput): Promise<UserRecord> => {
    if (USE_MOCK) {
        return mockUpdateUser(id, input);
    }

    try {
        const response = await api.put(`/users/${id}`, input);
        return normalizeUser(response.data?.data ?? response.data?.user ?? response.data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "Impossible de mettre à jour l'utilisateur."));
    }
};

export const deleteUser = async (id: string): Promise<{ success: boolean }> => {
    if (USE_MOCK) {
        return mockDeleteUser(id);
    }

    try {
        const response = await api.delete(`/users/${id}`);
        return response.data?.data ?? response.data?.result ?? response.data ?? { success: true };
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "Impossible de supprimer l'utilisateur."));
    }
};
