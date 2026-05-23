const TOKEN_KEY = 'token';
const DEV_MOCK_USER_KEY = 'DEV_MOCK_USER';

const isDev = process.env.NODE_ENV === 'development';

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

export const enableDevMockUser = () => {
    if (!isDev || typeof window === 'undefined') return;

    // This backdoor is DEV-only and intentionally kept in sessionStorage so it never persists across browser restarts.
    sessionStorage.setItem(DEV_MOCK_USER_KEY, '1');
    clearStoredToken();
};

export const disableDevMockUser = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(DEV_MOCK_USER_KEY);
};

export const isDevMockUserActive = () => {
    if (!isDev || typeof window === 'undefined') return false;
    return sessionStorage.getItem(DEV_MOCK_USER_KEY) === '1';
};
