/**
 * Local AI Service - Intelligent Health Analysis without External API
 * Provides high-confidence analysis when Anthropic API is unavailable
 */

class LocalAIAnalysisService {
    /**
     * Generate risk level based on telemetry data
     */
    static calculateRiskLevel(animal) {
        const issues = [];
        let riskScore = 0;

        // Temperature analysis (normal: 38.5-39.5°C for sheep)
        // Ignore 0 or near-0 values — they are missing data, not real readings
        const temp = animal.temperature;
        if (temp && temp > 10) {
            if (temp > 40.5) {
                issues.push('FEVER_HIGH');
                riskScore += 35;
            } else if (temp > 39.8) {
                issues.push('FEVER_MILD');
                riskScore += 15;
            } else if (temp < 37.5) {
                issues.push('HYPOTHERMIA');
                riskScore += 25;
            }
        }

        // Heart rate analysis (normal: 70-80 bpm for sheep)
        // Ignore 0 bpm — sensor not reading, not cardiac arrest
        const bpm = animal.bpm;
        if (bpm && bpm > 0) {
            if (bpm > 100) {
                issues.push('TACHYCARDIA');
                riskScore += 20;
            } else if (bpm < 50) {
                issues.push('BRADYCARDIA');
                riskScore += 20;
            }
        }

        // Activity level (0-100% after normalization)
        const activity = animal.activity;
        if (activity != null) {
            if (activity > 80) {
                issues.push('HIGH_ACTIVITY');
                riskScore += 10;
            } else if (activity < 10) {
                issues.push('LOW_ACTIVITY');
                riskScore += 15;
            }
        }

        // Battery status
        const battery = animal.battery;
        if (battery != null && battery > 0 && battery < 15) {
            issues.push('LOW_BATTERY');
            riskScore += 5;
        }

        // GPS status
        const gps = animal.gps_signal;
        if (gps != null && gps < 3) {
            issues.push('GPS_WEAK');
            riskScore += 3;
        }

        // Determine risk level
        if (riskScore >= 50) return 'CRITICAL';
        if (riskScore >= 30) return 'HIGH';
        if (riskScore >= 15) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Generate human-readable analysis summary
     */
    static generateSummary(animals) {
        if (!animals || animals.length === 0) {
            return 'Aucune donnée d\'animal disponible pour l\'analyse.';
        }

        const criticalAnimals = animals.filter(
            (a) => this.calculateRiskLevel(a) === 'CRITICAL'
        );
        const highRiskAnimals = animals.filter(
            (a) => this.calculateRiskLevel(a) === 'HIGH'
        );

        // Exclude 0 / missing values to avoid skewing averages
        const validTemps = animals.filter(a => a.temperature && a.temperature > 10);
        const avgTemp = validTemps.length > 0
            ? validTemps.reduce((sum, a) => sum + a.temperature, 0) / validTemps.length
            : null;

        const validBpm = animals.filter(a => a.bpm && a.bpm > 0);
        const avgBpm = validBpm.length > 0
            ? validBpm.reduce((sum, a) => sum + a.bpm, 0) / validBpm.length
            : null;

        const validActivity = animals.filter(a => a.activity != null);
        const avgActivity = validActivity.length > 0
            ? validActivity.reduce((sum, a) => sum + a.activity, 0) / validActivity.length
            : null;

        let summary = '';

        // Critical analysis
        if (criticalAnimals.length > 0) {
            summary += `⚠️ ${criticalAnimals.length} animal(aux) en état critique : ${criticalAnimals
                .map((a) => a.name)
                .join(', ')}. `;
            summary += `Intervention urgente recommandée. `;
        }

        // High risk analysis
        if (highRiskAnimals.length > 0) {
            summary += `⚠️ ${highRiskAnimals.length} animal(aux) à surveiller : ${highRiskAnimals
                .map((a) => a.name)
                .join(', ')}. `;
        }

        // Temperature analysis
        if (avgTemp !== null) {
            if (avgTemp > 39.8) {
                summary += `🌡️ Température moyenne élevée (${avgTemp.toFixed(1)}°C) : possible fièvre collective. `;
            } else if (avgTemp < 37.8) {
                summary += `❄️ Température moyenne basse (${avgTemp.toFixed(1)}°C) : vérifier conditions environnementales. `;
            } else {
                summary += `✅ Températures normales (${avgTemp.toFixed(1)}°C). `;
            }
        }

        // Heart rate analysis
        if (avgBpm !== null) {
            if (avgBpm > 90) {
                summary += `💓 Fréquence cardiaque élevée (${Math.round(avgBpm)} bpm) : stress possible. `;
            } else if (avgBpm < 60) {
                summary += `💓 Fréquence cardiaque basse (${Math.round(avgBpm)} bpm) : état de repos. `;
            }
        }

        // Activity analysis
        if (avgActivity !== null) {
            if (avgActivity > 70) {
                summary += `🏃 Activité élevée : surveillance recommandée. `;
            } else if (avgActivity < 20) {
                summary += `😴 Activité basse : comportement normal ou léthargie. `;
            }
        }

        if (summary.length === 0) {
            summary = '✅ Troupeau en bonne santé. Continuer le suivi régulier.';
        }

        return summary;
    }

    /**
     * Identify which animals are at risk
     */
    static identifyRiskAnimals(animals) {
        const riskMap = {};
        const riskAnimals = [];

        animals.forEach((animal) => {
            const level = this.calculateRiskLevel(animal);
            if (level !== 'LOW') {
                riskAnimals.push(animal.collar_id);
                riskMap[animal.collar_id] = level;
            }
        });

        return riskAnimals;
    }

    /**
     * Generate actionable recommendations
     */
    static generateSuggestions(animals) {
        const suggestions = [];
        const issues = new Set();

        animals.forEach((animal) => {
            const temp = animal.temperature;
            const bpm = animal.bpm;
            const battery = animal.battery;
            const gps = animal.gps_signal;
            const activity = animal.activity;

            if (temp && temp > 10 && temp > 40.5) issues.add('FEVER');
            if (temp && temp > 10 && temp < 37.5) issues.add('HYPOTHERMIA');
            if (bpm && bpm > 0 && bpm > 100) issues.add('TACHYCARDIA');
            if (battery != null && battery > 0 && battery < 15) issues.add('BATTERY');
            if (gps != null && gps < 3) issues.add('GPS');
            if (activity != null && activity > 80) issues.add('STRESS');
            if (activity != null && activity < 10) issues.add('LETHARGY');
        });

        // Generate specific suggestions
        if (issues.has('FEVER')) {
            suggestions.push(
                '🏥 Vérifier la température rectale des animaux fébriles et consulter un vétérinaire si persistance'
            );
            suggestions.push(
                '💧 Assurer hydratation adéquate et accès à l\'ombre pour thermorégulation'
            );
        }

        if (issues.has('HYPOTHERMIA')) {
            suggestions.push(
                '🔥 Fournir abri supplémentaire et isolation thermique pour animaux hypothermiques'
            );
            suggestions.push(
                '👨‍⚕️ Surveiller signes de détresse respiratoire'
            );
        }

        if (issues.has('TACHYCARDIA')) {
            suggestions.push(
                '😰 Identifier sources de stress (prédateurs, changements environnementaux) et éliminer'
            );
            suggestions.push(
                '🧘 Laisser période calme pour normalisation FC'
            );
        }

        if (issues.has('STRESS')) {
            suggestions.push(
                '📍 Vérifier comportement - activité élevée peut indiquer fuite ou prédateur'
            );
            suggestions.push(
                '🔔 Activer alertes de géofence'
            );
        }

        if (issues.has('LETHARGY')) {
            suggestions.push(
                '⚕️ Apathie peut indiquer maladie : observation rapprochée recommandée'
            );
        }

        if (issues.has('BATTERY')) {
            suggestions.push(
                '🔋 Colliers faible batterie détectés : planifier recharge ou remplacement urgent'
            );
        }

        if (issues.has('GPS')) {
            suggestions.push(
                '📡 Signal GPS faible : vérifier ligne de vue ou recalibrer antenne'
            );
        }

        // Default suggestions if no specific issues
        if (suggestions.length === 0) {
            suggestions.push(
                '✅ Continuer suivi de santé régulier'
            );
            suggestions.push(
                '📊 Consulter tendances historiques pour détection anomalies précoces'
            );
            suggestions.push(
                '🔔 Activer alertes intelligentes pour notifications proactives'
            );
        }

        return suggestions.slice(0, 5); // Return max 5 suggestions
    }

    /**
     * Main analysis method - matches Anthropic API response format
     */
    static analyzeAnimals(animals) {
        if (!animals || animals.length === 0) {
            return {
                summary: 'Aucune donnée disponible.',
                riskLevel: 'LOW',
                riskAnimalIds: [],
                suggestions: [],
            };
        }

        const riskAnimalIds = this.identifyRiskAnimals(animals);

        // Global risk level = worst level across all animals
        const levelOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        let worstLevel = 'LOW';
        for (const animal of animals) {
            const level = this.calculateRiskLevel(animal);
            if (levelOrder.indexOf(level) > levelOrder.indexOf(worstLevel)) {
                worstLevel = level;
            }
        }

        return {
            summary: this.generateSummary(animals),
            riskLevel: worstLevel,
            riskAnimalIds,
            suggestions: this.generateSuggestions(animals),
        };
    }
}

export default LocalAIAnalysisService;
