const TOKEN_KEY = 'token';

export const getStoredToken = () => {
    if (typeof window === 'undefined') return null;

    // Prefer sessionStorage so auth disappears when the tab closes.
    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    if (sessionToken) return sessionToken;

    // Migrate legacy localStorage tokens once so existing users are not forced to re-login immediately.
    const legacyToken = localStorage.getItem(TOKEN_KEY);
    if (legacyToken) {
        sessionStorage.setItem(TOKEN_KEY, legacyToken);
        localStorage.removeItem(TOKEN_KEY);
    }

    return legacyToken;
};

export const setStoredToken = (token: string) => {
    if (typeof window === 'undefined') return;

    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
};

export const clearStoredToken = () => {
    if (typeof window === 'undefined') return;

    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
};

