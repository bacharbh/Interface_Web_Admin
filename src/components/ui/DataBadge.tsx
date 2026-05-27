import React from 'react';

export type DataSource = 'live' | 'fallback' | 'derived' | 'simulated';

const SOURCE_CONFIG = {
    live: { label: 'En direct', color: '#1D9E75', dot: true },
    fallback: { label: 'Fallback', color: '#EF9F27', dot: false },
    derived: { label: 'Calculé', color: '#378ADD', dot: false },
    simulated: { label: 'Simulé', color: '#888', dot: false },
} as const;

export const DataBadge = ({ source }: { source: DataSource }) => {
    const config = SOURCE_CONFIG[source];

    return (
        <span style={{
            fontSize: 10,
            fontWeight: 500,
            color: config.color,
            border: `1px solid ${config.color}`,
            borderRadius: 4,
            padding: '1px 6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
        }}>
            {config.dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: config.color }} />}
            {config.label}
        </span>
    );
};