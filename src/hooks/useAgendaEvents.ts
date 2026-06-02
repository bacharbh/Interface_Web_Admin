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
                return events;
            } catch {
                return [];
            }
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