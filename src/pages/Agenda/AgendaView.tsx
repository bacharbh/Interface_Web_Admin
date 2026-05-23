import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { addDays, addMinutes, endOfMonth, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AddEventModal from './AddEventModal';
import Button from '../../components/ui/Button';
import api from '../../services/api';
import { createEvent, deleteEvent, updateEvent, type AgendaEvent, type NewAgendaEvent, type AgendaEventType } from '../../services/agendaService';
import { agendaQueryKey, useAgendaEvents } from '../../hooks/useAgendaEvents';

type ViewMode = 'month' | 'week' | 'list';

interface AnimalOption {
    id: string;
    label: string;
    hint?: string;
}

const EVENT_COLORS: Record<AgendaEventType, string> = {
    vaccine: '#1D9E75',
    checkup: '#378ADD',
    treatment: '#EF9F27',
    other: '#7F77DD',
};

const formatAnimalLabel = (animal: Record<string, unknown>) => {
    const sheepId = typeof animal.sheepId === 'string' ? animal.sheepId : typeof animal.collar_id === 'string' ? animal.collar_id : String(animal.id ?? 'animal');
    const breed = typeof animal.breed === 'string' ? animal.breed : 'Race inconnue';
    const name = typeof animal.name === 'string' ? animal.name.trim() : '';
    return {
        id: sheepId,
        label: name ? `${name} · ${sheepId}` : sheepId,
        hint: breed,
    };
};

const sortByStart = (events: AgendaEvent[]) => [...events].sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());

const overlapsVetAppointment = (draft: NewAgendaEvent | AgendaEvent, existingEvents: AgendaEvent[], ignoreId?: string) => {
    const draftStart = new Date(draft.startAt).getTime();
    const draftEnd = new Date(draft.endAt).getTime();
    return existingEvents.filter((event) => {
        if (ignoreId && event.id === ignoreId) return false;
        if (event.status === 'cancelled') return false;
        if (!['vaccine', 'checkup', 'treatment'].includes(event.type)) return false;
        const start = new Date(event.startAt).getTime();
        const end = new Date(event.endAt).getTime();
        return start < draftEnd && end > draftStart;
    });
};

const toMonthGrid = (month: Date) => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    return Array.from({ length: 35 }, (_, index) => addDays(start, index));
};

const AgendaView: React.FC = () => {
    const location = useLocation();
    const queryClient = useQueryClient();
    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const prefill = params.get('prefill');

    const [view, setView] = useState<ViewMode>('month');
    const [isModalOpen, setModalOpen] = useState(false);
    const [prefillAnimal, setPrefillAnimal] = useState<string | null>(prefill);
    const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
    const [monthAnchor] = useState(() => new Date());

    useEffect(() => {
        if (prefill) setPrefillAnimal(prefill);
    }, [prefill]);

    const { events } = useAgendaEvents(monthAnchor);

    const animalsQuery = useQuery<AnimalOption[]>({
        queryKey: ['agenda-animals'],
        queryFn: async () => {
            const response = await api.get('/sheep');
            const payload = Array.isArray(response.data)
                ? response.data
                : Array.isArray(response.data?.data)
                    ? response.data.data
                    : Array.isArray(response.data?.sheep)
                        ? response.data.sheep
                        : [];

            return payload.map((animal: Record<string, unknown>) => formatAnimalLabel(animal));
        },
        staleTime: 5 * 60 * 1000,
    });

    const monthGrid = useMemo(() => toMonthGrid(monthAnchor), [monthAnchor]);
    const eventsByDate = useMemo(() => {
        const grouped: Record<string, AgendaEvent[]> = {};
        events.forEach((event) => {
            const dateKey = format(parseISO(event.startAt), 'yyyy-MM-dd');
            grouped[dateKey] = grouped[dateKey] ?? [];
            grouped[dateKey].push(event);
        });
        return grouped;
    }, [events]);

    const upcomingEvents = useMemo(() => {
        const now = new Date();
        return sortByStart(events.filter((event) => new Date(event.startAt) > now)).slice(0, 2);
    }, [events]);

    const saveMutation = useMutation({
        mutationFn: async (payload: { id?: string; event: NewAgendaEvent }) => {
            if (payload.id) {
                return updateEvent(payload.id, payload.event);
            }
            return createEvent(payload.event);
        },
        onMutate: async ({ id, event }) => {
            const queryKey = agendaQueryKey(monthAnchor);
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<AgendaEvent[]>(queryKey) ?? [];
            const optimisticEvent: AgendaEvent = {
                id: id ?? `temp-${Date.now()}`,
                ...event,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<AgendaEvent[]>(queryKey, (current = []) => {
                const withoutCurrent = current.filter((item) => item.id !== optimisticEvent.id);
                return sortByStart([...withoutCurrent, optimisticEvent]);
            });

            return { previous, optimisticId: optimisticEvent.id };
        },
        onError: (error, _payload, context) => {
            if (context?.previous) {
                queryClient.setQueryData(agendaQueryKey(monthAnchor), context.previous);
            }
            toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer l’événement.');
        },
        onSuccess: (saved, payload) => {
            const queryKey = agendaQueryKey(monthAnchor);
            queryClient.setQueryData<AgendaEvent[]>(queryKey, (current = []) => {
                const filtered = current.filter((item) => item.id !== payload.id && item.id !== saved.id);
                return sortByStart([...filtered, saved]);
            });
            void queryClient.invalidateQueries({ queryKey: ['agenda-events'] });
            toast.success(payload.id ? 'Événement mis à jour.' : 'Événement créé.');
        },
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => deleteEvent(id),
        onMutate: async (id) => {
            const queryKey = agendaQueryKey(monthAnchor);
            await queryClient.cancelQueries({ queryKey });
            const previous = queryClient.getQueryData<AgendaEvent[]>(queryKey) ?? [];
            queryClient.setQueryData<AgendaEvent[]>(queryKey, (current = []) => current.filter((event) => event.id !== id));
            return { previous };
        },
        onError: (error, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(agendaQueryKey(monthAnchor), context.previous);
            }
            toast.error(error instanceof Error ? error.message : 'Impossible de supprimer l’événement.');
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['agenda-events'] });
            toast.success('Événement supprimé.');
        },
    });

    const openCreateModal = useCallback((prefillId?: string | null) => {
        setSelectedEvent(null);
        setPrefillAnimal(prefillId ?? null);
        setModalOpen(true);
    }, []);

    const openEditModal = useCallback((event: AgendaEvent) => {
        setSelectedEvent(event);
        setModalOpen(true);
    }, []);

    const handleSave = useCallback((payload: NewAgendaEvent) => {
        const overlapping = overlapsVetAppointment(payload, events, selectedEvent?.id);
        if (overlapping.length > 0) {
            toast(`Attention: chevauchement avec ${overlapping.length} rendez-vous vétérinaire${overlapping.length > 1 ? 's' : ''}.`);
        }

        saveMutation.mutate({ id: selectedEvent?.id, event: payload });
    }, [events, saveMutation, selectedEvent]);

    const handleDelete = useCallback(() => {
        if (!selectedEvent) return;
        const confirmed = window.confirm(`Supprimer "${selectedEvent.title}" ?`);
        if (!confirmed) return;
        removeMutation.mutate(selectedEvent.id);
        setModalOpen(false);
        setSelectedEvent(null);
    }, [removeMutation, selectedEvent]);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setSelectedEvent(null);
    }, []);

    return (
        <div className="mx-auto max-w-7xl space-y-6 p-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="title-lg">Agenda vétérinaire</h1>
                    <p className="label-sm text-gray-500">Planifiez et suivez les visites, vaccinations et traitements</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl bg-white p-2 dark:bg-card-dark">
                        <Button variant={view === 'month' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('month')}>Mois</Button>
                        <Button variant={view === 'week' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('week')}>Semaine</Button>
                        <Button variant={view === 'list' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('list')}>Liste</Button>
                    </div>
                    <Button variant="primary" onClick={() => openCreateModal(prefillAnimal)}>Ajouter</Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {upcomingEvents.map((event) => (
                    <button
                        key={event.id}
                        type="button"
                        onClick={() => openEditModal(event)}
                        className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-card-dark"
                    >
                        <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ background: EVENT_COLORS[event.type] }} />
                            <div className="text-xs uppercase tracking-wide text-gray-500">Prochain événement</div>
                        </div>
                        <div className="mt-3 font-semibold text-gray-900 dark:text-white">{event.title}</div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{format(parseISO(event.startAt), 'dd MMM yyyy • HH:mm')}</div>
                    </button>
                ))}
            </div>

            {view === 'month' && (
                <div className="grid grid-cols-7 gap-2">
                    {monthGrid.map((day) => {
                        const dayKey = format(day, 'yyyy-MM-dd');
                        const dayEvents = eventsByDate[dayKey] ?? [];

                        return (
                            <div key={dayKey} className={`rounded-lg border p-3 ${isSameMonth(day, monthAnchor) ? '' : 'opacity-40'}`}>
                                <div className="flex items-start justify-between">
                                    <div className="text-sm font-bold">{format(day, 'd')}</div>
                                </div>
                                <div className="mt-2 space-y-1">
                                    {dayEvents.slice(0, 3).map((event) => (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={() => openEditModal(event)}
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            <span className="h-2 w-2 rounded-full" style={{ background: EVENT_COLORS[event.type] }} />
                                            <div className="min-w-0 flex-1 truncate text-xs">{event.title} • {format(parseISO(event.startAt), 'HH:mm')}</div>
                                        </button>
                                    ))}
                                    {dayEvents.length > 3 && <div className="text-xs text-gray-400">+ {dayEvents.length - 3} autres</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {view === 'week' && (
                <div className="rounded-2xl border bg-white p-4 dark:bg-card-dark">
                    <h3 className="title-sm mb-3">Semaine</h3>
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 7 }).map((_, index) => {
                            const day = addDays(startOfWeek(monthAnchor, { weekStartsOn: 1 }), index);
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const dayEvents = eventsByDate[dayKey] ?? [];

                            return (
                                <div key={dayKey} className="rounded-lg border p-2">
                                    <div className="text-xs font-bold">{format(day, 'EEEE d')}</div>
                                    <div className="mt-2 space-y-1">
                                        {dayEvents.map((event) => (
                                            <button key={event.id} type="button" onClick={() => openEditModal(event)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                                                <span className="h-2 w-2 rounded-full" style={{ background: EVENT_COLORS[event.type] }} />
                                                <div className="truncate">{format(parseISO(event.startAt), 'HH:mm')} • {event.title}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {view === 'list' && (
                <div className="space-y-4">
                    {['Aujourd\'hui', 'Cette semaine', 'Mois prochain'].map((section) => (
                        <div key={section} className="rounded-2xl border bg-white p-4 dark:bg-card-dark">
                            <h3 className="title-sm mb-3">{section}</h3>
                            {sortByStart(events).map((event) => (
                                <div key={event.id} className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
                                    <button type="button" onClick={() => openEditModal(event)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: EVENT_COLORS[event.type] }} />
                                        <div className="min-w-0">
                                            <div className="font-bold text-gray-900 dark:text-white">{event.title}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {format(parseISO(event.startAt), 'dd/MM/yyyy • HH:mm')} • {event.animalIds.length} animaux
                                            </div>
                                        </div>
                                    </button>
                                    <span className={`rounded-full px-2 py-1 text-xs ${event.status === 'upcoming' ? 'bg-blue-50 text-blue-700' : event.status === 'done' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {event.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            <AddEventModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onSave={handleSave}
                onDelete={selectedEvent ? handleDelete : undefined}
                prefillAnimalId={prefillAnimal}
                initialEvent={selectedEvent}
                animals={animalsQuery.data ?? []}
            />
        </div>
    );
};

export default AgendaView;
