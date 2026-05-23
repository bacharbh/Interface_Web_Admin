import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useIoTStore } from '../../hooks/useIoTStore';

// ─── Constants ──────────────────────────────────────────────────────────────
const RADIUS = 26;
const STROKE_WIDTH = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 163.36

type ScoreColor = '#1D9E75' | '#EF9F27' | '#E24B4A';

const getScoreColor = (score: number): ScoreColor => {
  if (score >= 80) return '#1D9E75';
  if (score >= 60) return '#EF9F27';
  return '#E24B4A';
};

// ─── Component ───────────────────────────────────────────────────────────────
const HealthScoreWidget: React.FC = () => {
  const alerts = useIoTStore(state => state.alerts);
  const devices = useIoTStore(state => state.devices);

  const { criticalAlerts, highAlerts, mediumAlerts, totalAnimals, totalAlerts } = useMemo(() => {
    const unread = (alerts || []).filter(a => !a.read);
    return {
      criticalAlerts: unread.filter(a => a.severity === 'CRITICAL').length,
      highAlerts: unread.filter(a => a.severity === 'WARNING').length,
      mediumAlerts: unread.filter(a => a.severity === 'INFO').length,
      totalAnimals: Object.keys(devices || {}).length,
      totalAlerts: unread.length,
    };
  }, [alerts, devices]);

  const computeScore = () => {
    const animalList = Object.values(devices);
    if (!animalList.length) return 0;
    
    return Math.round(animalList.reduce((acc, animal) => acc + (animal.healthScore ?? 50), 0) / animalList.length);
  };

  const [score, setScore]         = useState(computeScore);
  const [elapsed, setElapsed]     = useState(0);           // seconds since last refresh
  const [animated, setAnimated]   = useState(false);       // controls CSS transition
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef                = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recompute on every store change or every 3 seconds
  useEffect(() => {
    const refresh = () => {
      const newScore = computeScore();
      setScore(newScore);
      setElapsed(0);
    };

    refresh(); // Initial
    intervalRef.current = setInterval(refresh, 3000); // 3 seconds refresh as requested
    
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [devices]); // Also watch devices for reactive updates

  // Tick the elapsed counter every second
  useEffect(() => {
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, []);

  // Mount animation: defer so CSS transition fires
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(t);
  }, []);

  const color  = getScoreColor(score);
  const offset = animated ? CIRCUMFERENCE * (1 - score / 100) : CIRCUMFERENCE;

  // ─── Tooltip content ────────────────────────────────────────────────────
  const tooltipLines = [
    `Score : ${score}/100`,
    `${criticalAlerts} critique${criticalAlerts !== 1 ? 's' : ''} (×30)`,
    `${highAlerts} haute${highAlerts !== 1 ? 's' : ''} (×15)`,
    `${mediumAlerts} info${mediumAlerts !== 1 ? 's' : ''} (×5)`,
    `${totalAnimals} animal${totalAnimals !== 1 ? 'aux' : ''} total`,
  ].join('\n');

  return (
    <div
      className="group relative flex items-center gap-3 cursor-default select-none"
      title={tooltipLines}
      aria-label={`Score de santé du troupeau : ${score} sur 100`}
    >
      {/* ── SVG Arc ─────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          {/* Track */}
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress arc */}
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 32 32)"
            style={{
              transition: animated
                ? 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)'
                : 'none',
            }}
          />
        </svg>

        {/* Centred label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            style={{ color, fontSize: 18, fontWeight: 500, lineHeight: 1 }}
          >
            {score}
          </span>
          <span
            className="text-gray-400 dark:text-gray-500"
            style={{ fontSize: 10, lineHeight: 1.2 }}
          >
            / 100
          </span>
        </div>
      </div>

      {/* ── Text block ──────────────────────────────────── */}
      <div className="hidden md:flex flex-col gap-0.5">
        <span
          className="text-gray-800 dark:text-gray-100 leading-tight"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          Santé du troupeau
        </span>
        <span
          className="text-gray-400 dark:text-gray-500 leading-tight"
          style={{ fontSize: 11 }}
        >
          {totalAnimals} animal{totalAnimals !== 1 ? 'aux' : ''}&nbsp;·&nbsp;
          {totalAlerts} alerte{totalAlerts !== 1 ? 's' : ''}&nbsp;·&nbsp;
          Mis à jour il y a {elapsed}s
        </span>
      </div>

      {/* ── Tooltip popover (hover, large screens) ───── */}
      <div
        className="
          pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)]
          w-52 z-50
          bg-white dark:bg-gray-900
          border border-gray-200 dark:border-gray-700
          rounded-xl shadow-lg
          px-3 py-2.5
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          hidden md:block
        "
        role="tooltip"
      >
        <p className="label-sm font-bold text-gray-800 dark:text-white mb-1.5">
          Détail du score
        </p>
        <div className="space-y-1">
          {[
            { label: 'Critiques', count: criticalAlerts, weight: 30, color: '#E24B4A' },
            { label: 'Hautes',    count: highAlerts,     weight: 15, color: '#EF9F27' },
            { label: 'Infos',     count: mediumAlerts,   weight:  5, color: '#3B82F6' },
          ].map(({ label, count, weight, color: c }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="label-xs flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c }}
                />
                {label} (×{weight})
              </span>
              <span className="label-xs font-bold" style={{ color: c }}>
                {count}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="label-xs text-gray-400">Score final</span>
          <span className="label-sm font-black" style={{ color }}>
            {score} / 100
          </span>
        </div>
      </div>
    </div>
  );
};

export default HealthScoreWidget;
