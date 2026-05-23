export const devLog = (...args: unknown[]) => {
    if (import.meta.env.DEV) console.log('[DEV]', ...args);
};
