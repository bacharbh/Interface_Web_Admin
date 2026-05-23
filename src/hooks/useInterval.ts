import { useEffect, useRef } from 'react';

/**
 * A custom React hook that sets up an interval and clears it when unmounting.
 * It is resilient to dynamic changes in the callback and delay.
 * 
 * @param callback The function to execute on each tick.
 * @param delay The interval delay in milliseconds. If null, the interval is paused.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default useInterval;
