import api from './apiClient'

const aiService = {
    getAnimalHealth: async (id: string) => {
        const res = await api.get(`/ai/health/${id}`)
        return res.data
    },

    getBattery: async (deviceId: string) => {
        const res = await api.get(`/ai/battery/${deviceId}`)
        return res.data
    }
}

export default aiService
