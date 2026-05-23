/**
 * Performance Monitor Hook
 * Monitors frame rate and performance metrics to ensure 30fps budget is maintained
 * Provides real-time feedback on rendering performance
 * 
 * @module usePerformanceMonitor
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  /** Current frames per second */
  fps: number;
  /** Average frames per second over the monitoring period */
  avgFps: number;
  /** Frame time in milliseconds */
  frameTime: number;
  /** Whether performance is below target (30fps) */
  isBelowTarget: boolean;
  /** Number of dropped frames */
  droppedFrames: number;
  /** Total frames rendered */
  totalFrames: number;
}

/**
 * Performance monitor configuration
 */
interface PerformanceMonitorConfig {
  /** Target FPS threshold (default: 30) */
  targetFps?: number;
  /** Update interval in milliseconds (default: 1000) */
  updateInterval?: number;
  /** Whether to enable monitoring (default: true) */
  enabled?: boolean;
}

/**
 * Performance Monitor Hook
 * Monitors frame rate and provides performance metrics
 * 
 * @param config - Configuration options
 * @returns Performance metrics object
 * 
 * @example
 * ```tsx
 * const { fps, isBelowTarget, droppedFrames } = usePerformanceMonitor({
 *   targetFps: 30,
 *   updateInterval: 1000
 * });
 * 
 * return (
 *   <div>
 *     <p>FPS: {fps.toFixed(1)}</p>
 *     {isBelowTarget && <p className="text-red-500">Performance warning!</p>}
 *   </div>
 * );
 * ```
 */
export const usePerformanceMonitor = (config: PerformanceMonitorConfig = {}) => {
  const {
    targetFps = 30,
    updateInterval = 1000,
    enabled = true,
  } = config;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    avgFps: 0,
    frameTime: 0,
    isBelowTarget: false,
    droppedFrames: 0,
    totalFrames: 0,
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef<number>(performance.now());
  const droppedFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const fpsHistoryRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number>();

  /**
   * Calculate FPS and update metrics
   */
  const calculateMetrics = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    
    frameCountRef.current++;
    totalFramesRef.current++;

    // Check for dropped frames (frame time > 33.33ms for 30fps)
    if (delta > 1000 / targetFps) {
      droppedFramesRef.current++;
    }

    // Update metrics at specified interval
    if (delta >= updateInterval) {
      const fps = (frameCountRef.current * 1000) / delta;
      const frameTime = delta / frameCountRef.current;
      
      // Update FPS history for average calculation
      fpsHistoryRef.current.push(fps);
      if (fpsHistoryRef.current.length > 10) {
        fpsHistoryRef.current.shift();
      }
      
      const avgFps = fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length;
      const isBelowTarget = fps < targetFps;

      setMetrics({
        fps,
        avgFps,
        frameTime,
        isBelowTarget,
        droppedFrames: droppedFramesRef.current,
        totalFrames: totalFramesRef.current,
      });

      // Reset counters
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    if (enabled) {
      animationFrameRef.current = requestAnimationFrame(calculateMetrics);
    }
  }, [targetFps, updateInterval, enabled]);

  /**
   * Start/stop monitoring based on enabled state
   */
  useEffect(() => {
    if (enabled) {
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(calculateMetrics);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, calculateMetrics]);

  /**
   * Reset performance metrics
   */
  const resetMetrics = useCallback(() => {
    frameCountRef.current = 0;
    droppedFramesRef.current = 0;
    totalFramesRef.current = 0;
    fpsHistoryRef.current = [];
    lastTimeRef.current = performance.now();
    setMetrics({
      fps: 0,
      avgFps: 0,
      frameTime: 0,
      isBelowTarget: false,
      droppedFrames: 0,
      totalFrames: 0,
    });
  }, []);

  return {
    ...metrics,
    resetMetrics,
  };
};

/**
 * Performance Budget Hook
 * Checks if a component is within performance budget
 * 
 * @param budget - Maximum allowed frame time in ms
 * @returns Object with budget status
 */
export const usePerformanceBudget = (budget: number = 33.33) => {
  const { frameTime, isBelowTarget } = usePerformanceMonitor();
  
  const isWithinBudget = frameTime <= budget;
  const budgetUtilization = (frameTime / budget) * 100;
  
  return {
    isWithinBudget,
    budgetUtilization,
    frameTime,
    isBelowTarget,
  };
};

export default usePerformanceMonitor;
