import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchUsers, createUser as apiCreateUser } from '../services/usersService'

export const useUsers = (params?: Record<string, any>) => {
    return useQuery({ queryKey: ['users', params], queryFn: () => fetchUsers() })
}

export const useCreateUser = () => {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (payload: any) => apiCreateUser(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] })
    })
}

export default useUsers
