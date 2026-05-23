import { useState, useEffect } from 'react';

/**
 * Custom hook to lazy load TensorFlow.js only when needed.
 * This prevents blocking the main thread and heavily reduces the initial JS bundle size.
 */
export const useTensorflow = () => {
  const [tf, setTf] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTensorflow = async () => {
      try {
        // Dynamic import tells Webpack/Vite to split this into a separate chunk
        const tfModule = await import('@tensorflow/tfjs');
        
        if (isMounted) {
          setTf(tfModule);
          setIsLoaded(true);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to load TensorFlow.js asynchronously', err);
          setError(err instanceof Error ? err : new Error('Unknown TensorFlow loading error'));
          setIsLoaded(true); // Stop loading state even on error
        }
      }
    };

    loadTensorflow();

    return () => {
      isMounted = false; // Prevent state updates if component unmounts before loading finishes
    };
  }, []);

  return { tf, isLoaded, error };
};
