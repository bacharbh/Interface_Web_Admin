/**
 * Smart Shepherd — CORRECTIONS IA (3 fichiers)
 *
 * ══════════════════════════════════════════════════════════
 * FICHIER 1 : src/config/features.ts
 * PROBLÈME : AI_RETRAIN toujours false → bouton désactivé
 * ══════════════════════════════════════════════════════════
 */

// Remplace intégralement src/config/features.ts par :
export const FEATURES = {
  // Activer en mettant VITE_FEATURE_AI_RETRAIN=true dans .env.development
  AI_RETRAIN:  import.meta.env.VITE_FEATURE_AI_RETRAIN === 'true',
  LABELLING:   import.meta.env.VITE_FEATURE_LABELLING !== 'false',   // true par défaut
  SIMULATION:  import.meta.env.VITE_FEATURE_SIMULATION !== 'false',  // true par défaut
  DEV_TOOLS:   import.meta.env.DEV,
} as const;

// Dans .env.development, changer :
//   VITE_FEATURE_AI_RETRAIN=false  →  VITE_FEATURE_AI_RETRAIN=true


/**
 * ══════════════════════════════════════════════════════════
 * FICHIER 2 : src/pages/Animals/CompareView/AIAnalysis.tsx
 * PROBLÈME : fetch('/api/ai/analyze') → 500 car chemin relatif
 * ══════════════════════════════════════════════════════════
 *
 * Ligne 50, remplace TOUT le bloc fetch par :
 */

// AVANT (cassé) :
// const res = await fetch('/api/ai/analyze', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ animals }),
//   signal: controller.signal,
// });
// if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
// const data: AnalysisResponse = await res.json();

// APRÈS (corrigé) :
// import api from '../../../services/api';
//
// const { data } = await api.post<AnalysisResponse>(
//   '/ai/analyze',
//   { animals },
//   { signal: controller.signal, timeout: 20000 }
// );

// Ajouter l'import api en haut du fichier (ligne 3) :
// import api from '../../../services/api';

// Et dans le catch, remplacer le message d'erreur brut par :
// } catch (err: any) {
//   if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
//   const status = err?.response?.status;
//   const msg = status === 500
//     ? 'Service IA indisponible. Vérifiez que le backend FastAPI est démarré.'
//     : status === 404
//       ? "Endpoint /api/ai/analyze introuvable. Vérifiez server.js."
//       : err?.message || "Erreur lors de l'analyse IA";
//   setError(msg);
//   setAnalysis(null);
// }


/**
 * ══════════════════════════════════════════════════════════
 * FICHIER 3 : src/components/AnomalyRegistry.tsx
 * PROBLÈME : "En attente..." permanent, timeout 30s trop long
 * ══════════════════════════════════════════════════════════
 *
 * Ligne 138, réduire le timeout de 30s à 12s :
 */

// AVANT :
// const response = await api.post('/ai/analyze', payload, { timeout: 30000 });

// APRÈS :
// const response = await api.post('/ai/analyze', payload, { timeout: 12000 });

// Dans le bloc catch (après ligne 153), remplacer :
// AVANT :
// } catch (error) {
//   console.error('[AnomalyRegistry] AI analysis failed:', error);
// }

// APRÈS :
// } catch (error: any) {
//   const isNetwork = !error.response;
//   const status = error?.response?.status;
//   console.error('[AnomalyRegistry] AI analysis failed:', error?.message);
//
//   setAiAnalysis({
//     riskLevel: 'N/A',
//     riskScore: 0,
//     summary: isNetwork
//       ? 'Service IA hors ligne — vérifiez la connexion backend.'
//       : status === 500
//         ? 'Erreur interne du service IA.'
//         : 'Analyse IA indisponible.',
//     recommendations: [],
//     fallback: true,
//   });
//   setLastAIUpdate(new Date()); // ← sortir définitivement de "En attente..."
// }

// Ligne 245, remplacer l'affichage :
// AVANT : {lastAIUpdate?.toLocaleTimeString('fr-FR') || 'En attente...'}
// APRÈS : {lastAIUpdate?.toLocaleTimeString('fr-FR') || 'Non disponible'}

export {};
