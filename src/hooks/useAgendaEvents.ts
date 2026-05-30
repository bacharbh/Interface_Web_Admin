import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, startOfMonth, subDays, addDays } from 'date-fns';
import { connectSocket, socket } from '../services/socket.js';
import { getStoredToken } from '../utils/authStorage';
import { fetchEvents, normalizeAgendaEvent, type AgendaEvent } from '../services/agendaService';

const getRangeForMonth = (month: Date) => ({
    from: subDays(startOfMonth(month), 7),
    to: addDays(endOfMonth(month), 7),
});

export const agendaQueryKey = (month: Date) => ['agenda-events', month.getFullYear(), month.getMonth()] as const;

export const useAgendaEvents = (month: Date) => {
    const queryClient = useQueryClient();
    const { from, to } = getRangeForMonth(month);

    const query = useQuery<AgendaEvent[]>({
        queryKey: agendaQueryKey(month),
        queryFn: async () => {
            try {
                const events = await fetchEvents(from, to);
                if (events.length > 0) {
                    return events;
                }
            } catch {
                // Fall back below.
            }

            if (import.meta.env.DEV) {
                const base = new Date();
                return [
                    {
                        id: 'mock-agenda-1',
                        title: 'Visite vétérinaire',
                        type: 'checkup',
                        startAt: new Date(base.getTime() + 2 * 60 * 60 * 1000).toISOString(),
                        endAt: new Date(base.getTime() + 3 * 60 * 60 * 1000).toISOString(),
                        animalIds: ['C001'],
                        veterinarian: 'Dr. Martin',
                        notes: 'Contrôle de routine',
                        recurrence: 'none',
                        reminderMinutes: 60,
                        status: 'upcoming',
                    },
                    {
                        id: 'mock-agenda-2',
                        title: 'Vaccination troupeau',
                        type: 'vaccine',
                        startAt: new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                        endAt: new Date(base.getTime() + 25 * 60 * 60 * 1000).toISOString(),
                        animalIds: ['C045', 'C089'],
                        veterinarian: 'Dr. Martin',
                        notes: 'Lot principal',
                        recurrence: 'none',
                        reminderMinutes: 120,
                        status: 'upcoming',
                    },
                    {
                        id: 'mock-agenda-3',
                        title: 'Traitement localisé',
                        type: 'treatment',
                        startAt: new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                        endAt: new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
                        animalIds: ['C012'],
                        veterinarian: 'Dr. Martin',
                        notes: 'Suivi post-anomalie',
                        recurrence: 'none',
                        reminderMinutes: 30,
                        status: 'upcoming',
                    },
                ];
            }

            return [];
        },
        staleTime: 30_000,
        refetchInterval: 60_000,
        refetchIntervalInBackground: true,
    });

    useEffect(() => {
        const token = getStoredToken();
        if (token && !socket.connected) {
            connectSocket(token);
        }

        const handleAgendaUpdate = () => {
            void queryClient.invalidateQueries({ queryKey: ['agenda-events'] });
        };

        socket.on('agenda:updated', handleAgendaUpdate);

        return () => {
            socket.off('agenda:updated', handleAgendaUpdate);
        };
    }, [queryClient]);

    return {
        ...query,
        events: (query.data ?? []).map(normalizeAgendaEvent),
    };
};