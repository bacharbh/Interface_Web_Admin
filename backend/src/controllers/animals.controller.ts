import { Request, Response } from 'express'

// Telemetry model is in backend/models/TelemetryData.js (CommonJS). Require it.
const Telemetry = require('../../../models/TelemetryData')

export const getAnimalTelemetry = async (req: Request, res: Response) => {
    const { id } = req.params
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const limit = Number((req.query.limit as string) ?? '100')

    try {
        const timeFilter: Record<string, any> = {}
        if (from) timeFilter.$gte = new Date(from)
        if (to) timeFilter.$lte = new Date(to)

        const query: Record<string, any> = { sheepId: id }
        if (Object.keys(timeFilter).length) query.timestamp = timeFilter

        const telemetry = await Telemetry.find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean()

        res.json(telemetry)
    } catch (err) {
        res.status(500).json({ error: 'Erreur récupération télémétrie' })
    }
}
