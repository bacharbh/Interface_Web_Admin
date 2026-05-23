/**
 * AI Analysis Integration Guide
 * 
 * === LSTM ANOMALY DETECTION (NEW) ===
 * Real-time red alert banner at top of dashboard:
 * - Triggers automatically when lstm_score > 75
 * - Shows animal ID, anomaly type, score, vital signs
 * - Disappears without reload when score drops below 75
 * - Dismissible with X button (manual dismiss)
 * - Synced with simulation every ~3 seconds
 * Anomaly types: ARRHYTHMIA, FEVER, LETHARGY, ABNORMAL_MOVEMENT, STRESS
 * 
 * === AI ANALYSIS COMPONENT ===
 * The AIAnalysis component automatically:
 * - Polls every 30 seconds
 * - Triggers immediately when critical animals are detected
 * - Sends structured animal data to /api/ai/analyze
 * - Receives JSON with { summary, riskLevel, riskAnimalIds, suggestions }
 * - Updates the Zustand store in real-time
 * 
 * Dashboard Integration Pattern:
 * 
 * import { useIoTStore } from '../../hooks/useIoTStore';
 * 
 * function Dashboard() {
 *   const aiAlerts = useIoTStore(state => state.aiAlerts);
 *   
 *   // Real-time update: re-render when aiAlerts changes
 *   const latestAIAnalysis = aiAlerts.find(a => a.type === 'ai-analysis');
 * 
 *   return (
 *     <>
 *       {latestAIAnalysis && (
 *         <div className="alert-banner">
 *           <p>Risk Level: {latestAIAnalysis.riskLevel}</p>
 *           <p>Summary: {latestAIAnalysis.message}</p>
 *           <ul>
 *             {latestAIAnalysis.suggestions?.map((s, i) => (
 *               <li key={i}>{s}</li>
 *             ))}
 *           </ul>
 *         </div>
 *       )}
 *     </>
 *   );
 * }
 * 
 * API Response Structure:
 * {
 *   success: true,
 *   data: {
 *     summary: "Tous les animaux présentent une température normale...",
 *     riskLevel: "LOW|MEDIUM|HIGH|CRITICAL",
 *     riskAnimalIds: ["collar_id1", "collar_id2"],
 *     suggestions: ["Augmenter surveillance", "Vérifier alimentation", ...]
 *   },
 *   timestamp: "2026-05-04T10:30:00Z"
 * }
 * 
 * UI Status Banners:
 * - BLUE (spinning): "Analyse du troupeau en cours…"
 * - ORANGE: "Mode dégradé - Analyse locale utilisée" (API failed)
 * - GREEN: "Analyse IA mise à jour" (success, auto-hides after 5s)
 * - RED (top): LSTM Alert Banner (animals with score > 75)
 * 
 * === DASHBOARD INTEGRATION ===
 * import LSTMAlertBanner from '../../components/alerts/LSTMAlertBanner';
 * <LSTMAlertBanner /> // Place at top of page for red alerts
 * Already added to AppLayout.jsx - visible on all pages
 */
export { };
