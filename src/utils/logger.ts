const isDev = process.env.NODE_ENV === 'development';

// Keep runtime diagnostics out of production bundles and only emit them in DEV.
const logger = {
    log: (...args: unknown[]) => {
        if (isDev) {
            console.log(...args);
        }
    },
    warn: (...args: unknown[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },
};

export default logger;
