export const FEATURES = {
    AI_RETRAIN: import.meta.env.VITE_FEATURE_AI_RETRAIN === 'true',
    LABELLING: import.meta.env.VITE_FEATURE_LABELLING !== 'false',
    DEV_TOOLS: import.meta.env.DEV,
} as const;