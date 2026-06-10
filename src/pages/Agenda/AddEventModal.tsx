import React, { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { type AgendaEvent, type AgendaEventType, type AgendaRecurrence, type NewAgendaEvent } from '../../services/agendaService';

interface AnimalOption {
    id: string;
    label: string;
    hint?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: NewAgendaEvent) => void;
    onDelete?: () => void;
    prefillAnimalId?: string | null;
    initialEvent?: AgendaEvent | null;
    animals: AnimalOption[];
}

const EVENT_TYPES: Array<{ id: AgendaEventType; label: string; description: string }> = [
    { id: 'checkup', label: 'Contrôle vétérinaire', description: 'Visite de suivi ou examen clinique' },
    { id: 'vaccine', label: 'Vaccination', description: 'Injection ou campagne vaccinale' },
    { id: 'treatment', label: 'Traitement', description: 'Soins, médicaments ou intervention' },
    { id: 'other', label: 'Autre', description: 'Tâche vétérinaire ponctuelle' },
];

const DEFAULT_START_TIME = '09:00';

const toLocalDateTime = (isoValue?: string) => {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localTime.toISOString().slice(0, 16);
};

const rangeFromForm = (date: string, time: string, durationMinutes: number) => {
    const startAt = new Date(`${date}T${time}:00`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    return { startAt, endAt };
};

const durationFromRange = (startAt?: string, endAt?: string) => {
    if (!startAt || !endAt) return 60;
    const duration = (new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000;
    return Math.max(15, Math.round(duration));
};

const formatDateField = (value?: string) => (value ? toLocalDateTime(value).slice(0, 10) : '');
const formatTimeField = (value?: string) => (value ? toLocalDateTime(value).slice(11, 16) : DEFAULT_START_TIME);

const AddEventModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    prefillAnimalId,
    initialEvent,
    animals,
}) => {
    const [type, setType] = useState<AgendaEventType>('checkup');
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState(DEFAULT_START_TIME);
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
    const [veterinarian, setVeterinarian] = useState('');
    const [recurrence, setRecurrence] = useState<AgendaRecurrence>('none');
    const [reminderMinutes, setReminderMinutes] = useState(24);
    const [notes, setNotes] = useState('');
    const [animalSearch, setAnimalSearch] = useState('');
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) return;

        if (initialEvent) {
            setType(initialEvent.type);
            setTitle(initialEvent.title);
            setDate(formatDateField(initialEvent.startAt));
            setTime(formatTimeField(initialEvent.startAt));
            setDurationMinutes(durationFromRange(initialEvent.startAt, initialEvent.endAt));
            setSelectedAnimalIds(initialEvent.animalIds ?? []);
            setVeterinarian(initialEvent.veterinarian ?? '');
            setRecurrence(initialEvent.recurrence ?? 'none');
            setReminderMinutes(initialEvent.reminderMinutes ?? 24);
            setNotes(initialEvent.notes ?? '');
            setAnimalSearch('');
            setErrors([]);
            return;
        }

        setType('checkup');
        setTitle('');
        setDate('');
        setTime(DEFAULT_START_TIME);
        setDurationMinutes(60);
        setSelectedAnimalIds(prefillAnimalId ? [prefillAnimalId] : []);
        setVeterinarian('');
        setRecurrence('none');
        setReminderMinutes(24);
        setNotes('');
        setAnimalSearch('');
        setErrors([]);
    }, [initialEvent, isOpen, prefillAnimalId]);

    const filteredAnimals = useMemo(() => {
        const query = animalSearch.trim().toLowerCase();
        if (!query) return animals;
        return animals.filter((animal) => {
            const haystack = `${animal.id} ${animal.label} ${animal.hint ?? ''}`.toLowerCase();
            return haystack.includes(query);
        });
    }, [animalSearch, animals]);

    const selectedAnimalOptions = useMemo(() => {
        return selectedAnimalIds.map((id) => animals.find((animal) => animal.id === id) ?? { id, label: id });
    }, [animals, selectedAnimalIds]);

    const addAnimal = (animalId: string) => {
        setSelectedAnimalIds((current) => (current.includes(animalId) ? current : [...current, animalId]));
        setAnimalSearch('');
    };

    const removeAnimal = (animalId: string) => {
        setSelectedAnimalIds((current) => current.filter((id) => id !== animalId));
    };

    const validate = () => {
        const nextErrors: string[] = [];
        const trimmedTitle = title.trim();

        if (!trimmedTitle) nextErrors.push('Le titre est obligatoire.');
        if (!date || !time) nextErrors.push('La date et l’heure sont obligatoires.');

        const { startAt, endAt } = rangeFromForm(date, time, durationMinutes);
        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
            nextErrors.push('La plage horaire est invalide.');
        } else if (endAt <= startAt) {
            nextErrors.push('La fin de l’événement doit être après le début.');
        }

        if (type === 'vaccine' && startAt < new Date()) {
            nextErrors.push('Une vaccination ne peut pas être planifiée dans le passé.');
        }

        setErrors(nextErrors);
        return nextErrors.length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        const { startAt, endAt } = rangeFromForm(date, time, durationMinutes);
        onSave({
            title: title.trim(),
            type,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            animalIds: selectedAnimalIds,
            veterinarian,
            notes,
            recurrence,
            reminderMinutes,
            status: initialEvent?.status ?? 'upcoming',
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <form
                onSubmit={handleSubmit}
                className="relative z-10 flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900"
                style={{ maxHeight: 'min(90vh, 760px)' }}
            >
                {/* ── Header fixe ─────────────────────────────────────── */}
                <div className="flex-shrink-0 border-b border-gray-100 px-6 pb-4 pt-6 dark:border-gray-800">
                    <h3 className="title-sm">{initialEvent ? 'Modifier un événement' : 'Ajouter un événement vétérinaire'}</h3>

                    {errors.length > 0 && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
                            {errors.map((error) => (
                                <div key={error}>{error}</div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Corps scrollable ─────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <label className="col-span-2">
                            Type
                            <Select className="mt-1" value={type} onChange={(event) => setType(event.target.value as AgendaEventType)}>
                                {EVENT_TYPES.map((eventType) => (
                                    <option key={eventType.id} value={eventType.id}>
                                        {eventType.label}
                                    </option>
                                ))}
                            </Select>
                        </label>

                        <label className="col-span-2">
                            Titre
                            <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
                        </label>

                        <label>
                            Date
                            <Input type="date" className="mt-1" value={date} onChange={(event) => setDate(event.target.value)} required />
                        </label>
                        <label>
                            Heure
                            <Input type="time" className="mt-1" value={time} onChange={(event) => setTime(event.target.value)} required />
                        </label>

                        <label>
                            Durée
                            <Select className="mt-1" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                                <option value={30}>30 minutes</option>
                                <option value={60}>1 heure</option>
                                <option value={120}>2 heures</option>
                                <option value={1440}>Toute la journée</option>
                            </Select>
                        </label>

                        <div className="col-span-2">
                            <label>Animaux concernés</label>
                            <Input
                                className="mt-1"
                                value={animalSearch}
                                onChange={(event) => setAnimalSearch(event.target.value)}
                                placeholder="Rechercher un animal par ID, nom ou race"
                            />
                            <div className="mt-2 max-h-32 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-950">
                                {filteredAnimals.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-gray-500">Aucun animal trouvé.</div>
                                ) : (
                                    filteredAnimals.map((animal) => (
                                        <button
                                            key={animal.id}
                                            type="button"
                                            onClick={() => addAnimal(animal.id)}
                                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-white dark:hover:bg-gray-900"
                                        >
                                            <span className="font-medium text-gray-800 dark:text-gray-100">{animal.label}</span>
                                            <span className="text-xs text-gray-500">Ajouter</span>
                                        </button>
                                    ))
                                )}
                            </div>
                            {selectedAnimalOptions.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {selectedAnimalOptions.map((animal) => (
                                        <button
                                            key={animal.id}
                                            type="button"
                                            onClick={() => removeAnimal(animal.id)}
                                            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                                        >
                                            {animal.label} ×
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label>
                            Vétérinaire
                            <Input className="mt-1" value={veterinarian} onChange={(event) => setVeterinarian(event.target.value)} />
                        </label>

                        <label>
                            Récurrence
                            <Select className="mt-1" value={recurrence} onChange={(event) => setRecurrence(event.target.value as AgendaRecurrence)}>
                                <option value="none">Aucune</option>
                                <option value="monthly">Mensuelle</option>
                                <option value="annual">Annuelle</option>
                            </Select>
                        </label>

                        <label>
                            Rappel
                            <Select className="mt-1" value={reminderMinutes} onChange={(event) => setReminderMinutes(Number(event.target.value))}>
                                <option value={60}>1 heure avant</option>
                                <option value={24 * 60}>24h avant</option>
                                <option value={48 * 60}>48h avant</option>
                                <option value={7 * 24 * 60}>1 semaine avant</option>
                            </Select>
                        </label>

                        <label className="col-span-2">
                            Notes
                            <textarea
                                className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                rows={3}
                            />
                        </label>
                    </div>
                </div>

                {/* ── Footer fixe ─────────────────────────────────────── */}
                <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
                    <Button variant="ghost" type="button" onClick={onClose}>Annuler</Button>
                    {initialEvent && onDelete && (
                        <Button variant="danger" type="button" onClick={onDelete}>Supprimer</Button>
                    )}
                    <Button variant="primary" type="submit">{initialEvent ? 'Enregistrer' : 'Ajouter'}</Button>
                </div>
            </form>
        </div>
    );
};

export default AddEventModal;
