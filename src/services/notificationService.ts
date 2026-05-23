import { create } from 'zustand';

/**
 * Smart Shepherd - Notification Store
 * Gère les notifications toast globales avec support auto-dismiss
 */

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

// Legacy support for playNotification
export const notificationService = {
    playNotification: (type = 'default') => {
        // Sound notifications are disabled by default
        return;
    },
    // Add compatibility with the new store
    show: (type: Toast['type'], message: string, duration?: number) => useNotification.getState().show(type, message, duration)
};

export default notificationService;
