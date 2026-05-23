import React from 'react';

/**
 * SkeletonCard — Placeholder for KPI cards during loading.
 */
export const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse">
    <div className="flex justify-between items-start mb-4">
      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl" />
    </div>
    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4" />
    <div className="h-2 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
  </div>
);

/**
 * SkeletonChart — Placeholder for charts.
 */
export const SkeletonChart: React.FC = () => (
  <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse flex flex-col h-[350px]">
    <div className="flex justify-between items-center mb-6">
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
      <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
    </div>
    <div className="flex-1 bg-gray-50 dark:bg-gray-800/20 rounded-xl mb-4" />
    <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full" />
  </div>
);

/**
 * Skeleton — Generic utility for custom placeholders.
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`bg-gray-200 dark:bg-gray-800 rounded animate-pulse ${className}`} />
);
