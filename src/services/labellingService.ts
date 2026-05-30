import api from './api'

export type LabellingOutcome = 'Healthy' | 'Fever' | 'Respiratory illness' | 'Digestive disorder' | 'Injury' | 'Unknown'

export interface LabellingDiagnosisInput {
    animalId: string
    outcome: LabellingOutcome
    confirmedByVet: boolean
    symptomOnsetTime?: number | null
    notes?: string
    anomalyDate?: string
    severity?: string
    type?: string
    windowStart?: string
    windowEnd?: string
}

export interface LabellingDiagnosisResult {
    id: string
    animalId: string
    outcome: LabellingOutcome
    confirmedByVet: boolean
    labelledAt: string
}

const labellingService = {
    diagnose: async (payload: LabellingDiagnosisInput) => {
        const response = await api.post('/labelling/submit-diagnostic', payload)
        return response.data as LabellingDiagnosisResult
    },
}

export default labellingService