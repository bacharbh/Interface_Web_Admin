import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Animal {
  id: string | number;
  name?: string;
  species?: string;
  breed?: string;
  battery?: number;
  temperature?: number;
  temp?: number;
  status?: string;
  geofence_exit?: boolean;
  inactivity_hours?: number;
  inactivityHours?: number;
  inactivityMinutes?: number;
  lastUpdate?: string;
  [key: string]: any;
}

export interface AtRiskAnimalsProps {
  animals: Animal[];
  onViewProfile: (animalId: string) => void;
  maxItems?: number;   // default 5
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps breed/species string to a representative emoji. */
function getSpeciesEmoji(animal: Animal): string {
  const raw = (animal.breed ?? animal.species ?? '').toLowerCase();
  if (/vach|bovin|cow/i.test(raw)) return '🐄';
  if (/chèvr|goat|caprin/i.test(raw)) return '🐐';
  if (/porc|pig/i.test(raw)) return '🐷';
  if (/cheval|horse|equin/i.test(raw)) return '🐎';
  return '🐑';
}

function getSpeciesLabel(animal: Animal): string {
  return animal.species ?? animal.breed ?? 'Ovin';
}

function getDisplayId(animal: Animal): string {
  return String(animal.id);
}

function getDisplayName(animal: Animal): string {
  return animal.name ?? `Collier #${getDisplayId(animal)}`;
}

/**
 * Computes a risk score:
 *   battery < 15%     → +40 pts
 *   temp  > 39.5°C    → +35 pts
 *   geofence_exit     → +50 pts
 *   inactivity > 2 h  → +25 pts
 */
function computeRiskScore(animal: Animal): number {
  let score = 0;

  const temp = animal.temp ?? animal.temperature ?? 38.5;
  if (temp > 39.5) score += 35;

  const inactivityH =
    animal.inactivity_hours ??
    animal.inactivityHours ??
    (animal.inactivityMinutes != null ? animal.inactivityMinutes / 60 : 0);
  if (inactivityH > 2) score += 25;

  return score;
}

type AlertInfo = {
  emoji: string;
  text: string;
  pillCls: string;    // Tailwind classes for the pill
  dotCls: string;     // colour dot class
  priority: number;   // lower = higher priority
};

/** Returns the *highest-priority* alert for display in the badge. */
function getPrimaryAlert(animal: Animal): AlertInfo | null {
  const temp = animal.temp ?? animal.temperature ?? 38.5;
  if (temp > 39.5) {
    return {
      emoji: '🟠',
      text: 'Fièvre',
      pillCls:
        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
      dotCls: 'bg-orange-500',
      priority: 0,
    };
  }

  const inactivityH =
    animal.inactivity_hours ??
    animal.inactivityHours ??
    (animal.inactivityMinutes != null ? animal.inactivityMinutes / 60 : 0);
  if (inactivityH > 2) {
    return {
      emoji: '🔵',
      text: 'Inactif',
      pillCls:
        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
      dotCls: 'bg-blue-500',
      priority: 1,
    };
  }

  return null;
}

/** Risk bar colour based on score */
function riskBarCls(score: number): string {
  if (score >= 75) return 'bg-red-500';
  if (score >= 40) return 'bg-orange-500';
  if (score >= 20) return 'bg-yellow-500';
  return 'bg-green-500';
}

// ---------------------------------------------------------------------------
// Shimmer Skeleton
// ---------------------------------------------------------------------------

function ShimmerRow() {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-10 h-10 rounded-full flex-shrink-0"
          style={{
            background:
              'linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s linear infinite',
          }}
        />
        <div className="space-y-2 flex-1 min-w-0">
          <div
            className="h-3 w-32 rounded-md"
            style={{
              background:
                'linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s linear infinite',
            }}
          />
          <div
            className="h-2.5 w-20 rounded-md"
            style={{
              background:
                'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s linear infinite',
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 sm:min-w-[240px] sm:justify-end">
        <div
          className="h-6 w-28 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s linear infinite',
          }}
        />
        <div
          className="h-2 w-28 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s linear infinite',
          }}
        />
        <div
          className="h-8 w-24 rounded-xl"
          style={{
            background:
              'linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.8s linear infinite',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const AtRiskAnimals: React.FC<AtRiskAnimalsProps> = ({
  animals = [],
  onViewProfile,
  maxItems = 5,
  isLoading = false,
}) => {
  // ---- Loading skeleton ----
  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
          <div
            className="h-4 w-36 rounded-md"
            style={{
              background: 'linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s linear infinite',
            }}
          />
          <div
            className="h-5 w-10 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #e5e7eb 25%, #d1d5db 50%, #e5e7eb 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.8s linear infinite',
            }}
          />
        </div>
        {[0, 1, 2].map((i) => (
          <ShimmerRow key={i} />
        ))}
      </div>
    );
  }

  // ---- Compute + sort ----
  const sortedAtRisk = useMemo(() => {
    return animals
      .map((a) => ({
        ...a,
        _riskScore: computeRiskScore(a),
        _alert: getPrimaryAlert(a),
      }))
      .filter((a) => a._riskScore > 0)
      .sort((a, b) => b._riskScore - a._riskScore)
      .slice(0, maxItems);
  }, [animals, maxItems]);

  // ---- Empty state ----
  if (sortedAtRisk.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-10 flex flex-col items-center justify-center text-center">
        {/* SVG Illustration */}
        <div className="w-16 h-16 mb-4 relative">
          <div className="absolute inset-0 bg-green-100 dark:bg-green-500/10 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-green-500" strokeWidth={1.5} />
          </div>
          {/* Decorative rings */}
          <div className="absolute -inset-2 border-2 border-green-200/60 dark:border-green-500/10 rounded-full animate-pulse" />
        </div>
        <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-1">
          Tous les animaux sont en bonne santé ✓
        </h4>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[220px]">
          Aucune anomalie critique ou alerte active détectée sur le troupeau.
        </p>
      </div>
    );
  }

  // ---- Main list ----
  return (
    <div className="w-full bg-white dark:bg-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
        <ul className="divide-y divide-gray-50 dark:divide-gray-800">
          <AnimatePresence initial={false}>
            {sortedAtRisk.map((animal, index) => {
              const MAX_SCORE = 60;
              const pct = Math.min(100, Math.round((animal._riskScore / MAX_SCORE) * 100));
              const barCls = riskBarCls(animal._riskScore);
              const emoji = getSpeciesEmoji(animal);
              const displayId = getDisplayId(animal);

              return (
                <motion.li
                  key={displayId}
                  layout
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10, height: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.04, ease: 'easeOut' }}
                  className="group px-4 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors duration-150"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-sm select-none border border-slate-200/60 dark:border-slate-700/40 shadow-sm">
                          {emoji}
                        </div>
                        {animal._alert && (
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-card-dark ${animal._alert.dotCls}`} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                            {getDisplayName(animal)}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            ID {displayId} · {getSpeciesLabel(animal)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          {animal._alert ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap ${animal._alert.pillCls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${animal._alert.dotCls}`} />
                              {animal._alert.text}
                            </span>
                          ) : null}

                          <div className="flex items-center gap-2 min-w-0 flex-1 sm:max-w-[220px]">
                            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${barCls}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, delay: index * 0.05, ease: 'easeOut' }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 tabular-nums w-12 text-right shrink-0">
                              {animal._riskScore} pts
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      id={`view-profile-${displayId}`}
                      onClick={() => onViewProfile(displayId)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:border-primary/30 dark:hover:border-primary/30 bg-white dark:bg-card-dark shadow-sm transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 whitespace-nowrap cursor-pointer w-full sm:w-auto"
                    >
                      <span>Voir profil →</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      {/* Footer count */}
      {sortedAtRisk.length >= maxItems && (
        <div className="px-4 py-2 border-t border-gray-50 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600 text-center">
          Affichage des {maxItems} animaux les plus à risque
        </div>
      )}
    </div>
  );
};

AtRiskAnimals.displayName = 'AtRiskAnimals';

export default memo(AtRiskAnimals);
