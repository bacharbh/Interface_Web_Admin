import express from 'express';
import axios from 'axios';
import LocalAIAnalysisService from '../services/localAIService.js';

const router = express.Router();

// Rate limiting for API calls (max 100 requests per minute per IP)
const rateLimitMap = new Map();
function normalizeIp(ip) {
    if (!ip) return 'unknown';
    // Remove IPv6 mapped prefix if present
    return ip.replace('::ffff:', '').replace('::1', '127.0.0.1');
}

function isLocalhost(ip) {
    const n = normalizeIp(ip);
    return n === '127.0.0.1' || n === '::1' || n === 'localhost' || n === 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    const clientKey = normalizeIp(ip);

    // Do not apply strict rate limiting for localhost during development
    if (process.env.NODE_ENV !== 'production' && isLocalhost(clientKey)) {
        return true;
    }

    const limit = rateLimitMap.get(clientKey) || { count: 0, resetTime: now + 60000 };

    if (now > limit.resetTime) {
        limit.count = 0;
        limit.resetTime = now + 60000;
    }

    limit.count++;
    rateLimitMap.set(clientKey, limit);

    return limit.count <= 100; // Allow 100 requests per minute
}

/**
 * POST /api/ai/analyze
 * Proxies Anthropic API for comparing multiple animals
 * Falls back to local AI analysis if API key is unavailable
 * Request body: { animals: [{ name, collar_id, bpm, temperature, activity, health, battery, gps_signal }] }
 */
router.post('/analyze', async (req, res) => {
    try {
        const { animals } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;

        // Rate limiting check
        if (!checkRateLimit(clientIp)) {
            console.warn(`⚠️  Rate limit exceeded for IP: ${clientIp}`);
            return res.status(429).json({
                success: false,
                error: 'Too many requests. Please wait before retrying.',
                fallback: false
            });
        }

        if (!animals || !Array.isArray(animals) || animals.length === 0) {
            return res.status(400).json({ error: 'animals array required' });
        }

        // Validate Anthropic API key
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            // Use local AI analysis as fallback. Log once to avoid spamming logs.
            if (!global.__anthropicFallbackLogged) {
                console.log('ℹ️ Anthropic API key not configured. Using local AI analysis.');
                global.__anthropicFallbackLogged = true;
            }
            const analysis = LocalAIAnalysisService.analyzeAnimals(animals);

            return res.json({
                success: true,
                data: analysis,
                fallback: true,
                confidence: 0.85,
                timestamp: new Date().toISOString(),
            });
        }

        // Prevent spam: Skip analysis if data unchanged in last 30 seconds
        const cacheKey = `ai_analysis_${JSON.stringify(animals.map(a => ({ id: a.collar_id, t: a.temperature, b: a.bpm }))).substring(0, 100)}`;
        const lastAnalysisTime = global.aiAnalysisCache || {};
        const now = Date.now();

        if (lastAnalysisTime[cacheKey] && (now - lastAnalysisTime[cacheKey]) < 30000) {
            console.log('⏭️  Skipping duplicate analysis (cache hit, <30s)');
            const analysis = LocalAIAnalysisService.analyzeAnimals(animals);
            return res.json({
                success: true,
                data: analysis,
                fallback: true,
                confidence: 0.85,
                cached: true,
                timestamp: new Date().toISOString(),
            });
        }

        lastAnalysisTime[cacheKey] = now;
        global.aiAnalysisCache = lastAnalysisTime;

        // Build animal summary for prompt
        const animalSummary = animals
            .map(a => `${a.name}#${a.collar_id}: BPM=${a.bpm || '—'}, Temp=${a.temperature || '—'}°C, Activité=${a.activity || '—'}%, Santé=${a.health || 'Unknown'}`)
            .join(' | ');

        // Construct Anthropic API request with JSON-only prompt
        const prompt = `Tu es un vétérinaire expert en santé animale. Analyse ces animaux :
${animalSummary}

Réponds avec UNIQUEMENT un JSON valide (sans markdown, sans texte supplémentaire) avec la structure exacte :
{
  "summary": "Analyse brève en 1-2 phrases des anomalies et causes",
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskAnimalIds": ["collar_id1", "collar_id2"],
  "suggestions": ["action1", "action2", "action3"]
}

Réponds maintenant le JSON uniquement.`;

        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 300,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                timeout: 30000,
            }
        );

        // Extract text from response
        const text = response.data?.content?.[0]?.text || '';

        // Parse JSON response
        let analysisData;
        try {
            // Try direct JSON parse first
            analysisData = JSON.parse(text);
        } catch (parseErr) {
            // Try extracting JSON from markdown code blocks or extra text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    analysisData = JSON.parse(jsonMatch[0]);
                } catch (nestedErr) {
                    console.error('Failed to parse JSON even from extracted block:', nestedErr);
                    throw new Error('Invalid JSON response from AI');
                }
            } else {
                console.error('No JSON found in response:', text);
                throw new Error('AI response is not valid JSON');
            }
        }

        // Validate required fields
        const requiredFields = ['summary', 'riskLevel', 'riskAnimalIds', 'suggestions'];
        const missingFields = requiredFields.filter(f => !(f in analysisData));
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate field types
        if (typeof analysisData.summary !== 'string') {
            throw new Error('summary must be a string');
        }
        if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(analysisData.riskLevel)) {
            throw new Error('riskLevel must be one of: LOW, MEDIUM, HIGH, CRITICAL');
        }
        if (!Array.isArray(analysisData.riskAnimalIds)) {
            throw new Error('riskAnimalIds must be an array');
        }
        if (!Array.isArray(analysisData.suggestions)) {
            throw new Error('suggestions must be an array');
        }

        // Return structured response
        res.json({
            success: true,
            data: analysisData,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('AI Analysis error:', error.response?.data || error.message);

        // Return error response with HTTP status
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to generate analysis';

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString(),
        });
    }
});

export default router;
