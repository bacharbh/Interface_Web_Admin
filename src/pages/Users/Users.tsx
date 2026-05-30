import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Users as UsersIcon,
  Plus,
  Edit2,
  Trash2,
  User,
  Mail,
  ShieldCheck,
  Filter,
  X,
  Loader2,
  AlertTriangle,
  UserPlus,
  Phone,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type UserInput,
  type UserRecord,
  type UserRole,
} from '../../services/usersService';

const USER_QUERY_KEY = ['users'] as const;

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; description: string }> = [
  { value: 'admin', label: 'Administrateur', description: 'Accès complet à la plateforme' },
  { value: 'operator', label: 'Opérateur', description: 'Pilotage opérationnel et suivi terrain' },
  { value: 'vet', label: 'Vétérinaire', description: 'Accès vétérinaire et validations cliniques' },
  { value: 'viewer', label: 'Lecteur', description: 'Consultation en lecture seule' },
];

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  operator: 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20',
  vet: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
  viewer: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrateur',
  operator: 'Opérateur',
  vet: 'Vétérinaire',
  viewer: 'Lecteur',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

interface UserFormValues {
  name: string;
  email: string;
  role: UserRole;
  phone: string;
}

type UserItem = UserRecord & {
  status: 'Actif' | 'Inactif';
};

const EMPTY_FORM: UserFormValues = {
  name: '',
  email: '',
  role: 'admin',
  phone: '',
};

const SkeletonRows = () => (
  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
    {Array.from({ length: 4 }).map((_, index) => (
      <tr key={index} className="animate-pulse">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-3 w-52 rounded bg-gray-50 dark:bg-gray-900/60" />
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-2">
            <div className="h-4 w-44 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-3 w-32 rounded bg-gray-50 dark:bg-gray-900/60" />
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="h-7 w-28 rounded-full bg-gray-100 dark:bg-gray-800" />
        </td>
        <td className="px-6 py-4">
          <div className="h-4 w-16 rounded bg-gray-100 dark:bg-gray-800" />
        </td>
        <td className="px-6 py-4 text-right">
          <div className="ml-auto flex items-center justify-end gap-2">
            <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        </td>
      </tr>
    ))}
  </tbody>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 text-primary">
      <UsersIcon className="h-8 w-8" />
    </div>
    <h3 className="title-md text-gray-900 dark:text-white">Aucun utilisateur</h3>
    <p className="mt-2 max-w-md body-md text-gray-500 dark:text-gray-400">
      Créez un premier compte pour votre équipe. Les administrateurs, opérateurs et lecteurs peuvent être ajoutés depuis ce panneau.
    </p>
    <Button variant="primary" className="mt-6" onClick={onCreate}>
      <UserPlus className="h-4 w-4" /> Créer un utilisateur
    </Button>
  </div>
);

export default function Users() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, isError, error, refetch } = useQuery<UserItem[]>({
    queryKey: USER_QUERY_KEY,
    queryFn: async () => fetchUsers().then((items) => items.map((item) => ({
      ...item,
      status: item.status ?? 'Actif',
    }))),
    retry: false,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [formValues, setFormValues] = useState<UserFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormValues, string>>>({});
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

  useEffect(() => {
    if (!isFormOpen) {
      setFormErrors({});
    }
  }, [isFormOpen]);

  const isEditing = mode === 'edit';

  const openCreate = () => {
    setMode('create');
    setSelectedUser(null);
    setFormValues(EMPTY_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (user: UserItem) => {
    setMode('edit');
    setSelectedUser(user);
    setFormValues({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone ?? '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openDelete = (user: UserItem) => {
    setDeleteTarget(user);
    setIsDeleteOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
    setFormValues(EMPTY_FORM);
    setFormErrors({});
  };

  const closeDelete = () => {
    setIsDeleteOpen(false);
    setDeleteTarget(null);
  };

  const validate = (values: UserFormValues) => {
    const nextErrors: Partial<Record<keyof UserFormValues, string>> = {};
    const trimmedName = values.name.trim();
    const trimmedEmail = values.email.trim();

    if (!trimmedName) nextErrors.name = 'Le nom est requis.';
    if (!trimmedEmail) nextErrors.email = "L'email est requis.";
    else if (!EMAIL_REGEX.test(trimmedEmail)) nextErrors.email = 'Adresse email invalide.';

    if (users.some((user) => user.email.toLowerCase() === trimmedEmail.toLowerCase() && user.id !== selectedUser?.id)) {
      nextErrors.email = 'Un utilisateur avec cet email existe déjà.';
    }

    if (!values.role) nextErrors.role = 'Le rôle est requis.';

    return nextErrors;
  };

  const createMutation = useMutation({
    mutationFn: createUser,
    onMutate: async (newUser) => {
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEY });
      const previousUsers = queryClient.getQueryData<UserItem[]>(USER_QUERY_KEY);
      const tempUser: UserItem = {
        id: `temp-${Date.now()}`,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        status: 'Actif',
        animalCount: 0,
        collarCount: 0,
      };
      queryClient.setQueryData<UserItem[]>(USER_QUERY_KEY, (current = []) => [tempUser, ...current]);
      return { previousUsers };
    },
    onError: (mutationError, _input, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(USER_QUERY_KEY, context.previousUsers);
      }
      toast.error(mutationError instanceof Error ? mutationError.message : "Impossible de créer l'utilisateur.");
    },
    onSuccess: () => {
      toast.success('Utilisateur créé avec succès.');
      closeForm();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserInput }) => updateUser(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEY });
      const previousUsers = queryClient.getQueryData<UserItem[]>(USER_QUERY_KEY);
      queryClient.setQueryData<UserItem[]>(USER_QUERY_KEY, (current = []) =>
        current.map((user) => (user.id === id ? { ...user, ...input, phone: input.phone || undefined, status: user.status ?? 'Actif' } : user))
      );
      return { previousUsers };
    },
    onError: (mutationError, _input, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(USER_QUERY_KEY, context.previousUsers);
      }
      toast.error(mutationError instanceof Error ? mutationError.message : "Impossible de mettre à jour l'utilisateur.");
    },
    onSuccess: () => {
      toast.success('Utilisateur mis à jour.');
      closeForm();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: USER_QUERY_KEY });
      const previousUsers = queryClient.getQueryData<UserItem[]>(USER_QUERY_KEY);
      queryClient.setQueryData<UserItem[]>(USER_QUERY_KEY, (current = []) => current.filter((user) => user.id !== id));
      return { previousUsers };
    },
    onError: (mutationError, _id, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(USER_QUERY_KEY, context.previousUsers);
      }
      toast.error(mutationError instanceof Error ? mutationError.message : "Impossible de supprimer l'utilisateur.");
    },
    onSuccess: () => {
      toast.success('Utilisateur supprimé.');
      closeDelete();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEY });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(formValues);
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: UserInput = {
      name: formValues.name.trim(),
      email: formValues.email.trim(),
      role: formValues.role,
      phone: formValues.phone.trim() || undefined,
    };

    if (isEditing && selectedUser) {
      updateMutation.mutate({ id: selectedUser.id, input: payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const deleteWarning = useMemo(() => {
    if (!deleteTarget) return '';
    const animalCount = deleteTarget.animalCount ?? 0;
    const collarCount = deleteTarget.collarCount ?? 0;
    return `Ce compte est associé à ${animalCount} animal${animalCount > 1 ? 'aux' : ''} et ${collarCount} collier${collarCount > 1 ? 's' : ''}.`;
  }, [deleteTarget]);

  if (isError) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
        <div>
          <h1 className="title-lg text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-primary" /> Gestion des utilisateurs
          </h1>
          <p className="body-md text-gray-500 dark:text-gray-400 mt-1">Gérez les accès et les rôles de votre équipe d'administration.</p>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-red-100 dark:border-red-500/20 p-6">
          <div className="flex flex-col items-center justify-center text-center gap-4 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <h3 className="title-md text-gray-900 dark:text-white">Impossible de charger les utilisateurs</h3>
              <p className="body-md text-gray-500 dark:text-gray-400 mt-1">{error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'}</p>
            </div>
            <Button variant="secondary" onClick={() => refetch()}>
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="title-lg text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-primary" /> Gestion des utilisateurs
          </h1>
          <p className="body-md text-gray-500 dark:text-gray-400 mt-1">Gérez les accès et les rôles de votre équipe d'administration.</p>
        </div>

        <Button variant="primary" className="flex items-center gap-2" onClick={openCreate}>
          <Plus className="w-5 h-5" /> Nouvel utilisateur
        </Button>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 dark:border-gray-800">
                <th className="px-6 py-4 label-xs font-bold text-gray-400 tracking-wider">Utilisateur</th>
                <th className="px-6 py-4 label-xs font-bold text-gray-400 tracking-wider">Contact</th>
                <th className="px-6 py-4 label-xs font-bold text-gray-400 tracking-wider">Rôle</th>
                <th className="px-6 py-4 label-xs font-bold text-gray-400 tracking-wider">Statut</th>
                <th className="px-6 py-4 label-xs font-bold text-gray-400 tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            {isLoading ? (
              <SkeletonRows />
            ) : users.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={5} className="px-6 py-10">
                    <EmptyState onCreate={openCreate} />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/5 dark:bg-primary/10 flex items-center justify-center border border-primary/10">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="title-sm text-gray-900 dark:text-white">{u.name}</p>
                          <p className="label-xs text-gray-400">ID {u.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 body-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{u.email}</span>
                        </div>
                        {u.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full label-xs font-black border ${ROLE_BADGE[u.role]}`}>
                          {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Filter className="w-3 h-3" />} {ROLE_LABEL[u.role]}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${u.status === 'Actif' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
                        <span className="body-sm text-gray-700 dark:text-gray-300">{u.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2"
                          aria-label={`Modifier l'utilisateur ${u.name}`}
                          title="Modifier"
                          onClick={() => openEdit(u)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-2 text-red-600"
                          aria-label={`Supprimer l'utilisateur ${u.name}`}
                          title="Supprimer"
                          onClick={() => openDelete(u)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} aria-label="Fermer le formulaire" />
          <div className="relative w-full max-w-xl bg-white dark:bg-card-dark h-full shadow-2xl overflow-y-auto flex flex-col" onClick={(event) => event.stopPropagation()} style={{ animation: 'slideInRight 0.3s ease-out' }}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between sticky top-0 bg-white dark:bg-card-dark z-10">
              <div>
                <p className="label-xs text-primary uppercase tracking-[0.2em]">{isEditing ? 'Modifier un utilisateur' : 'Créer un utilisateur'}</p>
                <h2 className="title-md text-gray-900 dark:text-white mt-1">{isEditing ? selectedUser?.name : 'Nouvel utilisateur'}</h2>
                <p className="body-sm text-gray-500 dark:text-gray-400 mt-1">Le formulaire valide les champs requis et empêche les emails dupliqués.</p>
              </div>
              <Button variant="ghost" size="sm" className="p-2" onClick={closeForm} aria-label="Fermer">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form className="p-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="label-xs mb-2 block">Nom complet *</label>
                <input
                  value={formValues.name}
                  onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Jean Dupont"
                />
                {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
              </div>

              <div>
                <label className="label-xs mb-2 block">Email *</label>
                <input
                  type="email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="jean.dupont@smartshepherd.com"
                />
                {formErrors.email && <p className="mt-1 text-xs text-red-500">{formErrors.email}</p>}
              </div>

              <div>
                <label className="label-xs mb-2 block">Rôle *</label>
                <select
                  value={formValues.role}
                  onChange={(event) => setFormValues((current) => ({ ...current, role: event.target.value as UserRole }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 space-y-1">
                  {ROLE_OPTIONS.map((option) => (
                    <p key={option.value} className={`text-xs ${formValues.role === option.value ? 'text-primary' : 'text-gray-400'}`}>
                      {option.label} - {option.description}
                    </p>
                  ))}
                </div>
                {formErrors.role && <p className="mt-1 text-xs text-red-500">{formErrors.role}</p>}
              </div>

              <div>
                <label className="label-xs mb-2 block">Téléphone (optionnel)</label>
                <input
                  value={formValues.phone}
                  onChange={(event) => setFormValues((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="+33 6 00 00 00 00"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={closeForm}>
                  Annuler
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isEditing ? 'Enregistrer les modifications' : 'Créer l’utilisateur'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeDelete} aria-label="Fermer la confirmation" />
          <div className="relative w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-500/30 dark:bg-card-dark" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="title-md text-gray-900 dark:text-white">Êtes-vous sûr ?</h3>
                <p className="mt-2 body-md text-gray-600 dark:text-gray-300">Vous êtes sur le point de supprimer <strong>{deleteTarget.name}</strong>.</p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{deleteWarning}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={closeDelete}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
