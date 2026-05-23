import api from './apiClient'

const notesService = {
    getNotes: async (animalId: string) => {
        const res = await api.get(`/animals/${animalId}/notes`)
        return res.data
    },

    addNote: async (animalId: string, payload: { content: string; type?: string }) => {
        const res = await api.post(`/animals/${animalId}/notes`, payload)
        return res.data
    }
}

export default notesService
