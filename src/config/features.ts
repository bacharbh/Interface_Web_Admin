export const FEATURES = {
    AI_RETRAIN: import.meta.env.VITE_FEATURE_AI_RETRAIN === 'true',
    LABELLING: import.meta.env.VITE_FEATURE_LABELLING === 'true',
    SIMULATION: import.meta.env.VITE_FEATURE_SIMULATION === 'true',
    DEV_TOOLS: import.meta.env.DEV,
} as const;