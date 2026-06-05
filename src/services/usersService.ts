import axios from 'axios';
import api from './api';

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

const normalizeRole = (role: unknown): UserRole => {
    const value = String(role ?? '').toLowerCase();
    if (value === 'operator' || value === 'vet') return 'operator';
    if (value === 'viewer' || value === 'farmer') return 'viewer';
    return 'admin';
};

const createId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

export const fetchUsers = async (): Promise<UserRecord[]> => {
    try {
        const response = await api.get('/users');
        const payload = response.data?.data ?? response.data?.users ?? response.data;
        return Array.isArray(payload) ? payload.map(normalizeUser) : [];
    } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Impossible de charger les utilisateurs.'));
    }
};

export const createUser = async (input: UserInput): Promise<UserRecord> => {
    try {
        const response = await api.post('/users', input);
        return normalizeUser(response.data?.data ?? response.data?.user ?? response.data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "Impossible de créer l'utilisateur."));
    }
};

export const updateUser = async (id: string, input: UserInput): Promise<UserRecord> => {
    try {
        const response = await api.put(`/users/${id}`, input);
        return normalizeUser(response.data?.data ?? response.data?.user ?? response.data);
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "Impossible de mettre à jour l'utilisateur."));
    }
};

export const deleteUser = async (id: string): Promise<{ success: boolean }> => {
    try {
        const response = await api.delete(`/users/${id}`);
        return response.data?.data ?? response.data?.result ?? response.data ?? { success: true };
    } catch (error) {
        throw new Error(getApiErrorMessage(error, "Impossible de supprimer l'utilisateur."));
    }
};
