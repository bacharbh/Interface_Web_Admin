import { Request, Response } from 'express'

const Telemetry = require('../../../models/TelemetryData')

export const getAnimalHealth = async (req: Request, res: Response) => {
    const { id } = req.params
    try {
        const latest = await Telemetry.find({ sheepId: id }).sort({ timestamp: -1 }).limit(24).lean()
        if (!latest || latest.length === 0) {
            return res.json({
                riskScore: 0,
                status: 'unknown',
                message: 'Données insuffisantes',
                isSimulated: true
            })
        }

        const avgTemp = latest.reduce((s: number, t: any) => s + (t.temperature ?? 0), 0) / latest.length
        const avgBpm = latest.reduce((s: number, t: any) => s + (t.heartRate ?? 0), 0) / latest.length

        res.json({
            animalId: id,
            riskScore: avgTemp > 40 || avgBpm > 120 ? 75 : 25,
            status: avgTemp > 40 ? 'warning' : 'healthy',
            temperature: avgTemp.toFixed(1),
            heartRate: avgBpm.toFixed(0),
            confidence: 0.82,
            analyzedAt: new Date().toISOString(),
            isSimulated: false
        })
    } catch (err) {
        res.status(500).json({ error: 'Analyse IA indisponible' })
    }
}

export const getBatteryRUL = async (req: Request, res: Response) => {
    const { deviceId } = req.params
    try {
        const history = await Telemetry.find({ collarId: deviceId }).sort({ timestamp: -1 }).limit(72).lean()
        if (!history || history.length < 2) return res.json({ rul: null, message: 'Historique insuffisant' })

        const batteries = history.map((t: any, i: number) => ({ x: i, y: t.battery ?? 0 }))
        const n = batteries.length
        const sumX = batteries.reduce((s: number, p: any) => s + p.x, 0)
        const sumY = batteries.reduce((s: number, p: any) => s + p.y, 0)
        const sumXY = batteries.reduce((s: number, p: any) => s + p.x * p.y, 0)
        const sumX2 = batteries.reduce((s: number, p: any) => s + p.x * p.x, 0)
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
        const current = batteries[0].y
        const hoursToEmpty = slope < 0 ? Math.abs(current / slope) : null

        res.json({
            deviceId,
            currentBattery: current,
            trend: slope.toFixed(3),
            estimatedHoursRemaining: hoursToEmpty?.toFixed(1) || null,
            status: current < 15 ? 'critical' : current < 30 ? 'low' : 'ok',
            analyzedAt: new Date().toISOString()
        })
    } catch (err) {
        res.status(500).json({ error: 'Impossible d\'analyser batterie' })
    }
}
