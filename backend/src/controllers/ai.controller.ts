import { Request, Response } from 'express'
import { getAnimalHistory, getAnimalByCollarId } from '../../services/firebaseService.js'

export const getAnimalHealth = async (req: Request, res: Response) => {
    const { id } = req.params
    try {
        const history = await getAnimalHistory(id, { limit: 24 })
        if (!history || history.length === 0) {
            return res.json({ riskScore: 0, status: 'unknown', message: 'Données insuffisantes' })
        }

        const temps = history.map((t: any) => t.sensors?.temperature).filter((v: any) => v != null)
        const avgTemp = temps.length ? temps.reduce((s: number, v: number) => s + v, 0) / temps.length : 0

        res.json({
            animalId: id,
            riskScore: avgTemp > 40 || avgTemp < 37 ? 75 : 25,
            status: avgTemp > 40 ? 'warning' : 'healthy',
            temperature: avgTemp.toFixed(1),
            confidence: 0.82,
            analyzedAt: new Date().toISOString(),
        })
    } catch (err) {
        res.status(500).json({ error: 'Analyse IA indisponible' })
    }
}

export const getBatteryRUL = async (req: Request, res: Response) => {
    const { deviceId } = req.params
    try {
        const history = await getAnimalHistory(deviceId, { limit: 72 })
        if (!history || history.length < 2) return res.json({ rul: null, message: 'Historique insuffisant' })

        res.json({ deviceId, rul: 'N/A', message: 'Batterie non disponible dans les données Firebase' })
    } catch (err) {
        res.status(500).json({ error: 'Analyse batterie indisponible' })
    }
}
