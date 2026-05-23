import React, { Profiler, useCallback, useRef, type ReactNode, type ProfilerOnRenderCallback } from 'react';
import { devLog } from '../../utils/devLogger';

type ProfilerPhase = 'mount' | 'update';

interface ProfilerSample {
    id: string;
    phase: ProfilerPhase;
    actualDuration: number;
    baseDuration: number;
    startTime: number;
    commitTime: number;
}

interface ProfilerSessionStats {
    mountTimeMs: number | null;
    renderCount: number;
    updateCount: number;
    worstRenderDurationMs: number;
    firstCommitTime: number | null;
    lastCommitTime: number | null;
}

interface ProfilerReport {
    id: string;
    generatedAt: string;
    session: {
        mountTimeMs: number | null;
        renderCount: number;
        updateCount: number;
        rerenderFrequencyPerSecond: number;
        worstRenderDurationMs: number;
        sessionDurationMs: number;
    };
    last50Renders: ProfilerSample[];
}

interface ProfilingWrapperProps {
    children: ReactNode;
    id?: string;
}

const MAX_RENDER_SAMPLES = 50;

const downloadJson = (fileName: string, payload: ProfilerReport) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
};

export default function ProfilingWrapper({ children, id = 'RealTimeMap' }: ProfilingWrapperProps) {
    const isDev = import.meta.env.DEV;
    const samplesRef = useRef<ProfilerSample[]>([]);
    const statsRef = useRef<ProfilerSessionStats>({
        mountTimeMs: null,
        renderCount: 0,
        updateCount: 0,
        worstRenderDurationMs: 0,
        firstCommitTime: null,
        lastCommitTime: null,
    });

    const buildReport = useCallback((): ProfilerReport => {
        const last50Renders = samplesRef.current.slice(-MAX_RENDER_SAMPLES);
        const sessionDurationMs = statsRef.current.firstCommitTime !== null && statsRef.current.lastCommitTime !== null
            ? Math.max(0, statsRef.current.lastCommitTime - statsRef.current.firstCommitTime)
            : 0;
        const rerenderFrequencyPerSecond = sessionDurationMs > 0 ? statsRef.current.updateCount / (sessionDurationMs / 1000) : 0;

        return {
            id,
            generatedAt: new Date().toISOString(),
            session: {
                mountTimeMs: statsRef.current.mountTimeMs,
                renderCount: statsRef.current.renderCount,
                updateCount: statsRef.current.updateCount,
                rerenderFrequencyPerSecond,
                worstRenderDurationMs: statsRef.current.worstRenderDurationMs,
                sessionDurationMs,
            },
            last50Renders,
        };
    }, [id]);

    const handleRender: ProfilerOnRenderCallback = useCallback((profilerId, phase, actualDuration, baseDuration, startTime, commitTime) => {
        devLog(`[Profiler] ${profilerId} | ${phase} | ${actualDuration.toFixed(2)}ms`);

        const sample: ProfilerSample = {
            id: profilerId,
            phase: phase as ProfilerPhase,
            actualDuration,
            baseDuration,
            startTime,
            commitTime,
        };

        samplesRef.current = [...samplesRef.current, sample].slice(-MAX_RENDER_SAMPLES);
        statsRef.current.renderCount += 1;
        statsRef.current.lastCommitTime = commitTime;
        statsRef.current.worstRenderDurationMs = Math.max(statsRef.current.worstRenderDurationMs, actualDuration);

        if (statsRef.current.firstCommitTime === null) {
            statsRef.current.firstCommitTime = commitTime;
        }

        if (phase === 'mount' && statsRef.current.mountTimeMs === null) {
            statsRef.current.mountTimeMs = actualDuration;
        }

        if (phase === 'update') {
            statsRef.current.updateCount += 1;
        }
    }, []);

    const handleDownload = useCallback(() => {
        downloadJson(`real-time-map-profiler-${Date.now()}.json`, buildReport());
    }, [buildReport]);

    if (!isDev) {
        return <>{children}</>;
    }

    return (
        <>
            <Profiler id={id} onRender={handleRender}>
                {children}
            </Profiler>
            <button
                type="button"
                onClick={handleDownload}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                data-testid="download-real-time-map-profiler-report"
            >
                Download profiler report
            </button>
        </>
    );
}