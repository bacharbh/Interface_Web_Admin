import React from 'react'
import { isDevMockUserActive } from '../utils/authStorage'

const DevBanner: React.FC = () => {
    // Only render in dev builds and when mock user is enabled
    if (!import.meta.env.DEV || !isDevMockUserActive() || import.meta.env.VITE_SHOW_DEV_BANNER === 'false') return null

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '32px',
                background: '#fff3cd',
                borderBottom: '1px solid #f0c040',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 500,
                color: '#856404',
                zIndex: 50,
                flexShrink: 0,
            }}
            aria-hidden
        >
            DEV MODE - MOCK USER ACTIVE; TOKENS STAY OUT OF LOCALSTORAGE AND THIS BANNER NEVER SHIPS TO PRODUCTION.
        </div>
    )
}

export default DevBanner
